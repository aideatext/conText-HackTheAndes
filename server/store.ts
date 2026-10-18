/**
 * Persistencia por sesion. En memoria siempre; ademas en Azure Table Storage
 * cuando AZURE_TABLES_ENDPOINT esta definido (con Managed Identity, sin cadenas de conexion).
 */
import { randomUUID } from 'node:crypto';
import { DefaultAzureCredential } from '@azure/identity';
import { TableClient } from '@azure/data-tables';
import type { ChatMessage, Graph, SessionSnapshot } from '../shared/types.js';
import { computeMetrics } from './graph.js';
import { deleteMaterial } from './blob.js';

export interface Session {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  graph: Graph;
  summary: string;
  materialName: string | null;
  /** Nombre del blob con el archivo original, para seguir mostrandolo en la conversacion. */
  materialBlob: string | null;
  materialMime: string | null;
  turns: number;
}

const MAX_MESSAGES = 60;
const PARTITION = 'session';

const memory = new Map<string, Session>();

let table: TableClient | null = null;
let tableReady: Promise<void> | null = null;

const endpoint = process.env.AZURE_TABLES_ENDPOINT?.trim();
if (endpoint) {
  table = new TableClient(endpoint, 'sessions', new DefaultAzureCredential());
  tableReady = table
    .createTable()
    .catch((err: any) => {
      if (err?.statusCode !== 409) {
        console.warn('[store] no se pudo crear la tabla, se sigue en memoria:', err?.message);
        table = null;
      }
    })
    .then(() => {
      if (table) console.log('[store] Azure Table Storage activo');
    });
} else {
  console.log('[store] sin AZURE_TABLES_ENDPOINT: las sesiones viven solo en memoria');
}

export function newSession(): Session {
  const now = new Date().toISOString();
  const session: Session = {
    sessionId: randomUUID(),
    createdAt: now,
    updatedAt: now,
    messages: [],
    graph: { nodes: [], links: [] },
    summary: '',
    materialName: null,
    materialBlob: null,
    materialMime: null,
    turns: 0,
  };
  memory.set(session.sessionId, session);
  void persist(session);
  return session;
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const cached = memory.get(sessionId);
  if (cached) return cached;

  if (!table) return null;
  try {
    await tableReady;
    const entity = await table.getEntity<{ payload: string }>(PARTITION, sessionId);
    const session = JSON.parse(entity.payload) as Session;
    memory.set(sessionId, session);
    return session;
  } catch {
    return null;
  }
}

export async function persist(session: Session): Promise<void> {
  session.updatedAt = new Date().toISOString();
  if (session.messages.length > MAX_MESSAGES) {
    session.messages = session.messages.slice(-MAX_MESSAGES);
  }
  memory.set(session.sessionId, session);

  if (!table) return;
  try {
    await tableReady;
    await table.upsertEntity(
      {
        partitionKey: PARTITION,
        rowKey: session.sessionId,
        payload: JSON.stringify(session),
        turns: session.turns,
        nodes: session.graph.nodes.length,
        updatedAt: session.updatedAt,
      },
      'Replace',
    );
  } catch (err: any) {
    console.warn('[store] fallo al persistir la sesion:', err?.message);
  }
}

export function snapshot(session: Session): SessionSnapshot {
  return {
    sessionId: session.sessionId,
    messages: session.messages,
    graph: session.graph,
    summary: session.summary,
    materialName: session.materialName,
    materialMime: session.materialMime,
    // El archivo se sirve por la API, no por una URL publica del blob.
    materialUrl: session.materialBlob ? `/api/material/${session.sessionId}/archivo` : null,
    metrics: computeMetrics(session.graph, session.turns),
  };
}

/**
 * Borra la sesion entera: conversacion, grafo y archivo. Es lo que sostiene la
 * promesa de "Borrar todo": si no se puede cumplir, no se puede prometer.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const session = memory.get(sessionId) ?? (await getSession(sessionId));
  if (session?.materialBlob) await deleteMaterial(session.materialBlob);
  memory.delete(sessionId);

  if (!table) return;
  try {
    await tableReady;
    await table.deleteEntity(PARTITION, sessionId);
  } catch (err: any) {
    if (err?.statusCode !== 404) {
      console.warn('[store] no se pudo borrar la sesion:', err?.message);
    }
  }
}

/**
 * Caducidad: las sesiones que nadie toca en 7 dias se borran solas, igual que
 * los archivos. Sin esto, "no guardamos nada" seria mentira para quien se va
 * sin pulsar el boton.
 */
const DIAS_DE_VIDA = 7;

export async function sweepExpired(): Promise<number> {
  const limite = Date.now() - DIAS_DE_VIDA * 24 * 60 * 60 * 1000;
  let borradas = 0;

  for (const [id, s] of memory) {
    if (Date.parse(s.updatedAt) < limite) {
      await deleteSession(id);
      borradas++;
    }
  }

  if (table) {
    try {
      await tableReady;
      for await (const e of table.listEntities<{ updatedAt?: string }>({
        queryOptions: { select: ['RowKey', 'updatedAt'] },
      })) {
        if (Date.parse(e.updatedAt ?? '') < limite) {
          await deleteSession(String(e.rowKey));
          borradas++;
        }
      }
    } catch (err: any) {
      console.warn('[store] fallo la limpieza de sesiones viejas:', err?.message);
    }
  }

  if (borradas) console.log(`[store] ${borradas} sesiones caducadas borradas`);
  return borradas;
}

/** Contador publico de uso (evidencia de traccion). */
export async function stats() {
  let sesiones = 0;
  let turnos = 0;
  let nodos = 0;
  let sesionesConTurnos = 0;

  const counted = new Set<string>();
  if (table) {
    try {
      await tableReady;
      for await (const e of table.listEntities<{
        turns?: number;
        nodes?: number;
      }>({ queryOptions: { select: ['RowKey', 'turns', 'nodes'] } })) {
        counted.add(String(e.rowKey));
        sesiones++;
        turnos += e.turns ?? 0;
        nodos += e.nodes ?? 0;
        if ((e.turns ?? 0) > 0) sesionesConTurnos++;
      }
    } catch (err: any) {
      console.warn('[store] fallo al leer estadisticas:', err?.message);
    }
  }

  for (const s of memory.values()) {
    if (counted.has(s.sessionId)) continue;
    sesiones++;
    turnos += s.turns;
    nodos += s.graph.nodes.length;
    if (s.turns > 0) sesionesConTurnos++;
  }

  return {
    sesiones,
    sesionesConTurnos,
    turnos,
    nodos,
    persistencia: table ? 'azure-table-storage' : 'memoria',
  };
}
