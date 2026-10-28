import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { AUTH, claude, friendlyError, MODEL, textOf } from './claude.js';
import { tutorSystem } from './prompts.js';
import { extractDelta } from './extract.js';
import { computeMetrics, mergeDelta, normalizeDelta, sesionExportadaSchema } from './graph.js';
import {
  MAX_BYTES,
  readMaterial,
  tipoDeMaterial,
  toContentBlocks,
  UnsupportedMaterial,
} from './material.js';
import { invitaAEscribir, MAX_TURNOS } from '../shared/limites.js';
import { idiomaDe, MENSAJES } from './mensajes.js';
import { anota, guardiaUso, limpiaRef, resumenDeUso, totalesPublicos } from './uso.js';
import { loadMaterial, saveMaterial } from './blob.js';
import { synthesize, voiceEnabled, VoiceUnavailable } from './voice.js';
import { contrato, entradaSchema, extraerGrafo, guardia, qatomEnabled } from './qatom.js';
import {
  deleteSession,
  getSession,
  newSession,
  persist,
  snapshot,
  stats,
  sweepExpired,
} from './store.js';

const PORT = Number(process.env.PORT ?? 3000);
const isProd = process.env.NODE_ENV === 'production';

async function start() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: isProd
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              // Las letras se sirven desde este dominio (public/fonts), asi que
              // no hay que abrirle la puerta a Google Fonts: nadie que visite
              // conText es filtrado hacia un tercero.
              styleSrc: ["'self'", "'unsafe-inline'"],
              fontSrc: ["'self'", 'data:'],
              imgSrc: ["'self'", 'data:', 'blob:'],
              connectSrc: ["'self'"],
              objectSrc: ["'none'"],
              mediaSrc: ["'self'", 'blob:'],
              workerSrc: ["'self'", 'blob:'],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  const turnLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: (req: express.Request) => ({ error: MENSAJES[idiomaDe(req)].demasiadosMensajes }),
  });

  app.get('/healthz', (_req, res) => {
    res.json({
      ok: true,
      model: MODEL,
      auth: AUTH,
      voz: voiceEnabled,
      qatom: qatomEnabled,
      uptime: Math.round(process.uptime()),
    });
  });

  const vozLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: 80,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Demasiadas peticiones de voz seguidas.' },
  });

  /** Voz del tutor. Si falla, 503 y el navegador usa su propia voz. */
  app.post('/api/voz', vozLimiter, async (req, res) => {
    const texto = req.body?.text;
    if (typeof texto !== 'string' || !texto.trim()) {
      return res.status(400).json({ error: 'Falta el texto.' });
    }
    try {
      const audio = await synthesize(texto);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'private, max-age=600');
      res.send(audio);
    } catch (err) {
      if (!(err instanceof VoiceUnavailable)) console.error('[voz]', err);
      res.status(503).json({ error: 'La voz no esta disponible ahora.' });
    }
  });

  /**
   * Contador publico. Sale de la medicion perpetua y no de contar sesiones
   * vivas: las sesiones caducan a los 7 dias y el numero bajaba solo.
   */
  app.get('/api/stats', async (_req, res) => {
    const vivas = await stats();
    res.json({
      ...(await totalesPublicos()),
      // Cuantas sesiones siguen sin caducar ahora mismo. Util para ver que el
      // olvido a 7 dias funciona, y distinto de lo que mide el contador.
      sesionesVivas: vivas.sesiones,
      persistencia: vivas.persistencia,
    });
  });

  /**
   * El detalle de uso, con el desglose por ?ref. No es publico: los ref son
   * nombres de campana y decir a quien se invito seria contar de mas.
   * Sin USO_TOKEN la ruta responde 404, igual que la de Qatom.
   */
  app.get('/api/uso', guardiaUso, async (_req, res) => {
    res.json(await resumenDeUso());
  });

  /**
   * ── Lo que conText vende en Qatom ──────────────────────────────────
   * El escaparate es publico; la mercancia, solo para quien pago.
   */
  app.get('/api/qatom/contrato', (_req, res) => {
    res.json({ ...contrato, disponible: qatomEnabled });
  });

  const qatomLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  });

  app.post('/api/qatom/grafo', qatomLimiter, guardia, async (req, res) => {
    const parsed = entradaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({
        error: 'Entrada inválida',
        detalle: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      });
    }
    try {
      const grafo = await extraerGrafo(parsed.data.texto, parsed.data.nodosExistentes);
      res.json(grafo);
    } catch (err) {
      console.error('[qatom]', err);
      res.status(502).json({ error: 'No se pudo analizar el texto. Intenta de nuevo.' });
    }
  });

  app.post('/api/session', (req, res) => {
    // El ?ref del enlace de invitacion: dice de que campana vino alguien, no quien es.
    const session = newSession(limpiaRef(req.body?.ref));
    void anota('inicio', { ref: session.ref });
    res.json(snapshot(session));
  });

  /** Borrar todo: la conversacion, el grafo y el archivo desaparecen del servidor. */
  app.delete('/api/session/:id', async (req, res) => {
    const session = await getSession(req.params.id);
    void anota('borrado', { ref: session?.ref ?? null });
    await deleteSession(req.params.id);
    res.status(204).end();
  });

  /**
   * Retomar una sesion desde el JSON que el estudiante se llevo. Crea una
   * sesion nueva en el servidor: el archivo original no vuelve, porque ese
   * JSON no lo lleva.
   */
  app.post('/api/session/retomar', async (req, res) => {
    const parsed = sesionExportadaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: MENSAJES[idiomaDe(req)].noEsSesion });
    }

    const session = newSession();
    session.messages = parsed.data.messages.slice(-60);
    session.summary = parsed.data.summary;
    session.materialName = parsed.data.materialName;
    session.turns = parsed.data.turns;
    // El grafo se revalida: no confiamos en un archivo que viene de fuera.
    // Sin el tope de 8: esto no es un turno nuevo, es un grafo entero que vuelve.
    mergeDelta(
      session.graph,
      normalizeDelta(parsed.data.graph, session.graph, 0, {
        hasMaterial: Boolean(parsed.data.materialName),
        maxNuevos: 500,
      }),
    );
    await persist(session);

    res.json(snapshot(session));
  });

  app.get('/api/session/:id', async (req, res) => {
    const session = await getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Sesion no encontrada' });
    res.json(snapshot(session));
  });

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_BYTES, files: 1 },
  });

  const materialLimiter = rateLimit({
    // Holgado a proposito: en un colegio muchos estudiantes comparten la misma IP.
    windowMs: 10 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: (req: express.Request) => ({ error: MENSAJES[idiomaDe(req)].demasiadosArchivos }),
  });

  /** Devuelve el archivo original de la sesion (el contenedor de blobs es privado). */
  app.get('/api/material/:sessionId/archivo', async (req, res) => {
    const session = await getSession(req.params.sessionId);
    if (!session?.materialBlob) return res.status(404).json({ error: 'Sin material' });

    const archivo = await loadMaterial(session.materialBlob);
    if (!archivo) return res.status(404).json({ error: 'El material ya no esta disponible' });

    res.setHeader('Content-Type', archivo.mime);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Content-Disposition', 'inline');
    res.send(archivo.buffer);
  });

  app.post('/api/material', materialLimiter, (req, res) => {
    const idioma = idiomaDe(req);
    const m = MENSAJES[idioma];
    upload.single('file')(req, res, async (uploadErr: any) => {
      if (uploadErr) {
        const tooBig = uploadErr.code === 'LIMIT_FILE_SIZE';
        return res.status(tooBig ? 413 : 400).json({
          error: tooBig ? m.archivoPesado : m.noRecibiArchivo,
        });
      }

      const sessionId = req.body?.sessionId;
      const file = req.file;
      if (typeof sessionId !== 'string' || !file) {
        return res.status(400).json({ error: 'Faltan sessionId o el archivo.' });
      }

      const session = await getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: m.sesionNoEncontrada });
      }

      try {
        const blocks = await toContentBlocks(file, idioma);
        const { summary, delta } = await readMaterial(blocks, session.graph, 0, idioma);

        mergeDelta(session.graph, delta);
        session.summary = summary;
        session.materialName = file.originalname.slice(0, 120);

        // Guardamos el archivo para que siga visible durante toda la conversacion.
        const guardado = await saveMaterial(
          session.sessionId,
          file.buffer,
          file.mimetype.split(';')[0].trim().toLowerCase(),
          file.originalname,
        );
        session.materialBlob = guardado.blobName;
        session.materialMime = guardado.mime;

        await persist(session);
        void anota('material', { ref: session.ref, detalle: tipoDeMaterial(file.mimetype) });

        res.json({
          summary,
          materialName: session.materialName,
          materialMime: session.materialMime,
          materialUrl: `/api/material/${session.sessionId}/archivo`,
          graph_delta: delta,
          metrics: computeMetrics(session.graph, session.turns),
        });
      } catch (err) {
        if (err instanceof UnsupportedMaterial) {
          if (err.tope) void anota('tope', { ref: session.ref, detalle: err.tope });
          return res.status(415).json({ error: err.message });
        }
        console.error('[material]', err);
        res.status(502).json({ error: friendlyError(err, idioma) });
      }
    });
  });

  app.post('/api/turn', turnLimiter, async (req, res) => {
    const idioma = idiomaDe(req);
    const m = MENSAJES[idioma];
    const { sessionId, text } = req.body ?? {};
    if (typeof sessionId !== 'string' || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Faltan sessionId o text.' });
    }
    if (text.length > 4000) {
      return res.status(413).json({ error: m.mensajeLargo });
    }

    const session = await getSession(sessionId);
    if (!session) return res.status(404).json({ error: m.sesionNoEncontrada });

    // Se responde antes de abrir el SSE: asi el error llega como JSON y el
    // cliente lo muestra tal cual, sin tener que inventar un evento de error.
    if (session.turns >= MAX_TURNOS) {
      void anota('tope', { ref: session.ref, detalle: 'turnos' });
      return res.status(403).json({
        error: invitaAEscribir(m.topeTurnos, idioma),
      });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const studentText = text.trim();
    session.messages.push({ role: 'user', content: studentText });

    let tutorText = '';
    try {
      const stream = claude.messages.stream({
        model: MODEL,
        max_tokens: 400,
        system: tutorSystem(session.summary),
        // El system del tutor solo pesa ~445 tokens, por debajo del minimo de
        // 512: cachearlo a solas no haria nada. Lo que si crece es la
        // conversacion, y se reenvia entera en cada turno. Con el cache_control
        // de nivel superior, cada turno deja cacheado lo dicho hasta ahi y el
        // siguiente lo lee en vez de volver a pagarlo. La ganancia crece con la
        // conversacion, que es justo donde estaba el gasto.
        cache_control: { type: 'ephemeral' },
        messages: session.messages.map((m) => ({ role: m.role, content: m.content })),
      });

      stream.on('text', (chunk: string) => {
        tutorText += chunk;
        send('token', { text: chunk });
      });

      const final = await stream.finalMessage();
      tutorText = textOf(final.content as any) || tutorText;
    } catch (err) {
      console.error('[turn] tutor:', err);
      send('error', { message: friendlyError(err, idioma) });
      session.messages.pop();
      send('done', {});
      return res.end();
    }

    session.messages.push({ role: 'assistant', content: tutorText });
    // Se mide antes de incrementar: turns===0 es el primer turno de esta sesion,
    // y eso -no la carga de la pagina- es alguien usando conText de verdad.
    if (session.turns === 0) void anota('conversa', { ref: session.ref });
    session.turns += 1;

    // Paso 2: extraer el grafo de este turno. Si falla, la conversacion sigue igual.
    const delta = await extractDelta(
      session.graph,
      studentText,
      tutorText,
      session.turns,
      Boolean(session.materialName),
    );
    mergeDelta(session.graph, delta);

    await persist(session);
    void anota('turno', { ref: session.ref, nodos: delta.nodes.length });

    send('graph_delta', delta);
    send('metrics', computeMetrics(session.graph, session.turns));
    send('done', { reply: tutorText });
    res.end();
  });

  if (isProd) {
    app.use(express.static('dist', { maxAge: '1h' }));
    app.get('/{*splat}', (_req, res) => res.sendFile('index.html', { root: 'dist' }));
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`conText escuchando en http://localhost:${PORT} (modelo ${MODEL}, credencial ${AUTH})`);
  });

  // Caducidad de las sesiones: al arrancar y cada seis horas.
  void sweepExpired();
  setInterval(() => void sweepExpired(), 6 * 60 * 60 * 1000).unref();
}

start().catch((err) => {
  console.error('No se pudo iniciar el servidor:', err);
  process.exit(1);
});
