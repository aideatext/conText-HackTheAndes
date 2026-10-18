import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { claude, friendlyError, MODEL, textOf } from './claude.js';
import { tutorSystem } from './prompts.js';
import { extractDelta } from './extract.js';
import { computeMetrics, mergeDelta } from './graph.js';
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
    res.json({ ok: true, model: MODEL, uptime: Math.round(process.uptime()) });
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
