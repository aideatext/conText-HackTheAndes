import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { claude, friendlyError, MODEL, textOf } from './claude.js';
import { tutorSystem } from './prompts.js';
import { extractDelta } from './extract.js';
import { computeMetrics, mergeDelta } from './graph.js';
import { MAX_BYTES, readMaterial, toContentBlocks, UnsupportedMaterial } from './material.js';
import { loadMaterial, saveMaterial } from './blob.js';
import { synthesize, voiceEnabled, VoiceUnavailable } from './voice.js';
import { getSession, newSession, persist, snapshot, stats } from './store.js';

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
              styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
              fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
              imgSrc: ["'self'", 'data:', 'blob:'],
              connectSrc: ["'self'"],
              objectSrc: ["'none'"],
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
    message: { error: 'Demasiados mensajes seguidos. Espera unos minutos.' },
  });

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, model: MODEL, voz: voiceEnabled, uptime: Math.round(process.uptime()) });
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

  app.get('/api/stats', async (_req, res) => {
    res.json(await stats());
  });

  app.post('/api/session', (_req, res) => {
    const session = newSession();
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
    message: { error: 'Subiste muchos archivos seguidos. Espera unos minutos.' },
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
    upload.single('file')(req, res, async (uploadErr: any) => {
      if (uploadErr) {
        const tooBig = uploadErr.code === 'LIMIT_FILE_SIZE';
        return res.status(tooBig ? 413 : 400).json({
          error: tooBig
            ? 'Ese archivo pesa mas de 10 MB. Prueba con una foto mas liviana o un PDF mas corto.'
            : 'No pude recibir el archivo. Intenta de nuevo.',
        });
      }

      const sessionId = req.body?.sessionId;
      const file = req.file;
      if (typeof sessionId !== 'string' || !file) {
        return res.status(400).json({ error: 'Faltan sessionId o el archivo.' });
      }

      const session = await getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Sesion no encontrada. Recarga la pagina.' });
      }

      try {
        const blocks = toContentBlocks(file);
        const { summary, delta } = await readMaterial(blocks, session.graph, 0);

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
          return res.status(415).json({ error: err.message });
        }
        console.error('[material]', err);
        res.status(502).json({ error: friendlyError(err) });
      }
    });
  });

  app.post('/api/turn', turnLimiter, async (req, res) => {
    const { sessionId, text } = req.body ?? {};
    if (typeof sessionId !== 'string' || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Faltan sessionId o text.' });
    }
    if (text.length > 4000) {
      return res.status(413).json({ error: 'Tu mensaje es demasiado largo.' });
    }

    const session = await getSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Sesion no encontrada. Recarga la pagina.' });

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
      send('error', { message: friendlyError(err) });
      session.messages.pop();
      send('done', {});
      return res.end();
    }

    session.messages.push({ role: 'assistant', content: tutorText });
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
    console.log(`conText escuchando en http://localhost:${PORT} (modelo ${MODEL})`);
  });
}

start().catch((err) => {
  console.error('No se pudo iniciar el servidor:', err);
  process.exit(1);
});
