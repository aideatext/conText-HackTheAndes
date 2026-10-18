import type { GraphDelta, Metrics, SessionSnapshot } from '../shared/types';

const SESSION_KEY = 'context.sessionId';

async function jsonOrThrow(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Error ${res.status}`);
  }
  return res.json();
}

export async function createSession(): Promise<SessionSnapshot> {
  const snap = (await jsonOrThrow(await fetch('/api/session', { method: 'POST' }))) as SessionSnapshot;
  localStorage.setItem(SESSION_KEY, snap.sessionId);
  return snap;
}

/** Reanuda la sesion guardada en localStorage; si ya no existe en el servidor, crea una nueva. */
export async function resumeOrCreateSession(): Promise<SessionSnapshot> {
  const saved = localStorage.getItem(SESSION_KEY);
  if (saved) {
    const res = await fetch(`/api/session/${encodeURIComponent(saved)}`);
    if (res.ok) return (await res.json()) as SessionSnapshot;
  }
  return createSession();
}

export interface MaterialResult {
  summary: string;
  materialName: string;
  graph_delta: GraphDelta;
  metrics: Metrics;
}

/** Sube foto, PDF o texto. El servidor valida tipo y tamano. */
export async function uploadMaterial(sessionId: string, file: File): Promise<MaterialResult> {
  const form = new FormData();
  form.append('sessionId', sessionId);
  form.append('file', file);
  const res = await fetch('/api/material', { method: 'POST', body: form });
  return (await jsonOrThrow(res)) as MaterialResult;
}

export interface TurnHandlers {
  onToken?: (text: string) => void;
  onGraphDelta?: (delta: GraphDelta) => void;
  onMetrics?: (metrics: Metrics) => void;
  onError?: (message: string) => void;
  onDone?: (reply: string) => void;
}

/** POST /api/turn leyendo la respuesta SSE del servidor. */
export async function sendTurn(sessionId: string, text: string, h: TurnHandlers): Promise<void> {
  const res = await fetch('/api/turn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, text }),
  });

  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}));
    h.onError?.(body.error ?? 'No pude enviar tu mensaje. Intenta de nuevo.');
    h.onDone?.('');
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      let event = 'message';
      let data = '';
      for (const line of frame.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7).trim();
        else if (line.startsWith('data: ')) data += line.slice(6);
      }
      if (!data) continue;

      let payload: any;
      try {
        payload = JSON.parse(data);
      } catch {
        continue;
      }

      if (event === 'token') h.onToken?.(payload.text ?? '');
      else if (event === 'graph_delta') h.onGraphDelta?.(payload as GraphDelta);
      else if (event === 'metrics') h.onMetrics?.(payload as Metrics);
      else if (event === 'error') h.onError?.(payload.message ?? 'Algo fallo.');
      else if (event === 'done') h.onDone?.(payload.reply ?? '');
    }
  }
}
