import type { ChatMessage, Graph, GraphDelta, Metrics, SessionSnapshot } from '../shared/types';
import { CABECERA_IDIOMA } from '../shared/idioma';
import { idiomaActual } from './i18n';

const SESSION_KEY = 'context.sessionId';

/** El idioma de la interfaz viaja en cada peticion: el servidor contesta los errores en el. */
function conIdioma(extra: Record<string, string> = {}): Record<string, string> {
  return { ...extra, [CABECERA_IDIOMA]: idiomaActual() };
}

async function jsonOrThrow(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Error ${res.status}`);
  }
  return res.json();
}

/**
 * La etiqueta del enlace de invitacion: context.aideatext.ai/?ref=plan-negocio.
 * Sirve para saber si una campana trajo gente, no para saber quien es nadie.
 */
function refDeLaUrl(): string | null {
  try {
    return new URLSearchParams(window.location.search).get('ref');
  } catch {
    return null;
  }
}

export async function createSession(): Promise<SessionSnapshot> {
  const snap = (await jsonOrThrow(
    await fetch('/api/session', {
      method: 'POST',
      headers: conIdioma({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ ref: refDeLaUrl() }),
    }),
  )) as SessionSnapshot;
  localStorage.setItem(SESSION_KEY, snap.sessionId);
  return snap;
}

// React StrictMode ejecuta el efecto dos veces en desarrollo: sin esto se crearian
// sesiones vacias duplicadas, que ademas ensuciarian /api/stats.
let inFlight: Promise<SessionSnapshot> | null = null;

/** Reanuda la sesion guardada en localStorage; si ya no existe en el servidor, crea una nueva. */
export function resumeOrCreateSession(): Promise<SessionSnapshot> {
  inFlight ??= (async () => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
      const res = await fetch(`/api/session/${encodeURIComponent(saved)}`);
      if (res.ok) return (await res.json()) as SessionSnapshot;
    }
    return createSession();
  })().catch((err) => {
    inFlight = null;
    throw err;
  });
  return inFlight;
}

/** El JSON que el estudiante se lleva para volver despues. */
export interface SesionExportada {
  version: number;
  exportadaEl: string;
  messages: ChatMessage[];
  graph: Graph;
  summary: string;
  materialName: string | null;
  turns: number;
}

/** Borra del servidor la conversacion, el grafo y el archivo. */
export async function borrarSesion(sessionId: string): Promise<void> {
  await fetch(`/api/session/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
  localStorage.removeItem(SESSION_KEY);
}

/** Retoma una sesion a partir del JSON guardado. */
export async function retomarSesion(datos: unknown): Promise<SessionSnapshot> {
  const snap = (await jsonOrThrow(
    await fetch('/api/session/retomar', {
      method: 'POST',
      headers: conIdioma({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(datos),
    }),
  )) as SessionSnapshot;
  localStorage.setItem(SESSION_KEY, snap.sessionId);
  inFlight = Promise.resolve(snap);
  return snap;
}

export interface Stats {
  /** Acumulado que no caduca: cuenta lo que paso, no lo que sigue guardado. */
  sesiones: number;
  sesionesConTurnos: number;
  turnos: number;
  nodos: number;
  /** Las que siguen sin caducar ahora mismo. */
  sesionesVivas: number;
  persistencia: string;
}

export async function getStats(): Promise<Stats> {
  return (await jsonOrThrow(await fetch('/api/stats'))) as Stats;
}

export interface MaterialResult {
  summary: string;
  materialName: string;
  materialMime: string | null;
  materialUrl: string;
  graph_delta: GraphDelta;
  metrics: Metrics;
}

/** Sube foto, PDF o texto. El servidor valida tipo y tamano. */
export async function uploadMaterial(sessionId: string, file: File): Promise<MaterialResult> {
  const form = new FormData();
  form.append('sessionId', sessionId);
  form.append('file', file);
  const res = await fetch('/api/material', { method: 'POST', body: form, headers: conIdioma() });
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
    headers: conIdioma({ 'Content-Type': 'application/json' }),
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
