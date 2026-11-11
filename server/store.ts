/**
 * Persistencia por sesion. En memoria siempre (cache) y ademas en:
 *   - DynamoDB, cuando DYNAMODB_TABLE esta definido (AWS; credenciales por las
 *     variables AWS_* estandar). Es lo que usa conText en Render: un reinicio o
 *     un despliegue ya NO borra las sesiones abiertas.
 *   - Azure Table Storage, cuando AZURE_TABLES_ENDPOINT esta definido.
 */
import { randomUUID } from 'node:crypto';
import { DefaultAzureCredential } from '@azure/identity';
import { TableClient } from '@azure/data-tables';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
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
  /** Etiqueta del enlace de invitacion (?ref=...). No es un dato de la persona. */
  ref: string | null;
}

const MAX_MESSAGES = 60;
/** Una hora sin actividad y la sesion se borra (ver sweepExpired). */
const VIDA_MS = 60 * 60 * 1000;
const PARTITION = 'session';

const memory = new Map<string, Session>();

let table: TableClient | null = null;
let tableReady: Promise<void> | null = null;

// ── DynamoDB (AWS) ───────────────────────────────────────────────────────
// Clave: sessionId. `expiraEn` (epoch en segundos) es el TTL nativo: DynamoDB
// borra solo la fila a la hora sin actividad, aunque la app este dormida.
const tablaDynamo = process.env.DYNAMODB_TABLE?.trim() || null;
const dynamo = tablaDynamo ? DynamoDBDocumentClient.from(new DynamoDBClient({})) : null;
if (tablaDynamo) console.log(`[store] DynamoDB activo (${tablaDynamo})`);

const endpoint = process.env.AZURE_TABLES_ENDPOINT?.trim();
if (tablaDynamo) {
  // DynamoDB manda; Azure no se abre aunque quede la variable.
} else if (endpoint) {
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
  console.log('[store] sin DYNAMODB_TABLE ni AZURE_TABLES_ENDPOINT: las sesiones viven solo en memoria');
}

export function newSession(ref: string | null = null): Session {
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
    ref,
  };
  memory.set(session.sessionId, session);
  void persist(session);
  return session;
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const cached = memory.get(sessionId);
  if (cached) return cached;

  if (dynamo && tablaDynamo) {
    try {
      const r = await dynamo.send(new GetCommand({ TableName: tablaDynamo, Key: { sessionId } }));
      const item = r.Item as { payload?: string; expiraEn?: number } | undefined;
      // El TTL de DynamoDB borra con retraso: lo vencido no se devuelve.
      if (!item?.payload || (item.expiraEn ?? 0) * 1000 < Date.now()) return null;
      const session = JSON.parse(item.payload) as Session;
      memory.set(sessionId, session);
      return session;
    } catch (err: any) {
      console.warn('[store] DynamoDB: no se pudo leer la sesion:', err?.message);
      return null;
    }
  }

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

  if (dynamo && tablaDynamo) {
    try {
      await dynamo.send(
        new PutCommand({
          TableName: tablaDynamo,
          Item: {
            sessionId: session.sessionId,
            payload: JSON.stringify(session),
            turns: session.turns,
            nodes: session.graph.nodes.length,
            updatedAt: session.updatedAt,
            expiraEn: Math.floor((Date.now() + VIDA_MS) / 1000),
          },
        }),
      );
    } catch (err: any) {
      console.warn('[store] DynamoDB: fallo al persistir la sesion:', err?.message);
    }
    return;
  }

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

  if (dynamo && tablaDynamo) {
    try {
      await dynamo.send(new DeleteCommand({ TableName: tablaDynamo, Key: { sessionId } }));
    } catch (err: any) {
      console.warn('[store] DynamoDB: no se pudo borrar la sesion:', err?.message);
    }
    return;
  }

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
 * Caducidad: una sesion que nadie toca en UNA HORA se borra sola, con su
 * archivo. Es lo que promete la pantalla («tus datos se borran solos en una
 * hora»); quien quiere seguir otro dia se lleva el XML. Antes eran 7 dias.
 */
export async function sweepExpired(): Promise<number> {
  const limite = Date.now() - VIDA_MS;
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
        // Filtrado por particion: sin esto el barrido recorreria cualquier otra
        // fila que llegue a esta tabla y la trataria como una sesion.
        queryOptions: { filter: `PartitionKey eq '${PARTITION}'`, select: ['RowKey', 'updatedAt'] },
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
  if (dynamo && tablaDynamo) {
    try {
      let inicio: Record<string, unknown> | undefined;
      do {
        const r = await dynamo.send(
          new ScanCommand({
            TableName: tablaDynamo,
            ProjectionExpression: 'sessionId, turns, nodes, expiraEn',
            // Solo sesiones vivas: fuera los eventos de uso y lo ya vencido que
            // el TTL de DynamoDB aun no ha recogido.
            FilterExpression: 'NOT begins_with(sessionId, :u) AND expiraEn > :ahora',
            ExpressionAttributeValues: { ':u': 'uso#', ':ahora': Math.floor(Date.now() / 1000) },
            ExclusiveStartKey: inicio,
          }),
        );
        for (const e of (r.Items ?? []) as { sessionId: string; turns?: number; nodes?: number }[]) {
          counted.add(e.sessionId);
          sesiones++;
          turnos += e.turns ?? 0;
          nodos += e.nodes ?? 0;
          if ((e.turns ?? 0) > 0) sesionesConTurnos++;
        }
        inicio = r.LastEvaluatedKey;
      } while (inicio);
    } catch (err: any) {
      console.warn('[store] DynamoDB: fallo al leer estadisticas:', err?.message);
    }
  }
  if (!tablaDynamo && table) {
    try {
      await tableReady;
      for await (const e of table.listEntities<{
        turns?: number;
        nodes?: number;
      }>({
        queryOptions: {
          filter: `PartitionKey eq '${PARTITION}'`,
          select: ['RowKey', 'turns', 'nodes'],
        },
      })) {
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
    // Con DynamoDB la tabla es la fuente de verdad; la memoria es solo cache.
    if (tablaDynamo || counted.has(s.sessionId)) continue;
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
    persistencia: tablaDynamo ? 'dynamodb' : table ? 'azure-table-storage' : 'memoria',
  };
}
