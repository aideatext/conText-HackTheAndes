/**
 * La medicion de uso que sobrevive al olvido.
 *
 * El contador publico vivia de contar las filas de la tabla de sesiones, y
 * como las sesiones caducan a los 7 dias el numero bajaba solo: justo lo que
 * se queria usar como evidencia de traccion se autodestruia. Aqui se anota que
 * algo paso -nunca que se dijo- en una tabla aparte que el barrido no toca.
 *
 * Lo que NO se guarda, a proposito:
 *
 *   - el sessionId. Si se guardara, "Borrar todo" dejaria un rastro atado al
 *     id que el navegador del usuario todavia tiene en localStorage, y la
 *     promesa de la portada seria falsa por un tecnicismo.
 *   - el texto, el resumen, el nombre del archivo. Nada del contenido.
 *
 * Un evento de aqui es una marca de conteo: no se puede volver desde el a
 * ninguna persona ni a ninguna conversacion.
 *
 * El `ref` es lo unico que distingue de donde vino alguien, y es una etiqueta
 * que viaja en el enlace de invitacion (?ref=plan-negocio), no un dato suyo.
 */
import { TableClient } from '@azure/data-tables';
import { DefaultAzureCredential } from '@azure/identity';
import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

export type TipoEvento =
  /** Alguien abrio conText y se le creo una sesion. Incluye rebotes y rastreadores. */
  | 'inicio'
  /** Primer turno de una sesion: aqui empieza el uso de verdad. */
  | 'conversa'
  /** Cada turno de conversacion. */
  | 'turno'
  /** Subio material. El detalle dice si fue foto, pdf o texto. */
  | 'material'
  /** Pulso "Borrar todo". */
  | 'borrado'
  /** Choco con un tope de la prueba. El detalle dice con cual. */
  | 'tope';

export interface Evento {
  tipo: TipoEvento;
  ref: string | null;
  detalle: string | null;
  /** Ideas nuevas que dejo ese turno, para que el contador de ideas tampoco caduque. */
  nodos: number;
  fecha: string;
  dia: string;
}

const PARTITION = 'uso';
const TABLA = 'uso';

const memoria: Evento[] = [];

let table: TableClient | null = null;
let tableReady: Promise<void> | null = null;

const endpoint = process.env.AZURE_TABLES_ENDPOINT?.trim();
if (endpoint) {
  table = new TableClient(endpoint, TABLA, new DefaultAzureCredential());
  tableReady = table
    .createTable()
    .catch((err: any) => {
      if (err?.statusCode !== 409) {
        console.warn('[uso] no se pudo crear la tabla, se mide en memoria:', err?.message);
        table = null;
      }
    })
    .then(() => {
      if (table) console.log('[uso] medicion perpetua activa');
    });
} else {
  console.log('[uso] sin AZURE_TABLES_ENDPOINT: la medicion vive solo en memoria');
}

/**
 * El detalle de uso solo lo ve quien trae el token, y sin token configurado la
 * ruta no existe: mismo criterio que la ruta de pago de Qatom.
 */
const tokenUso = process.env.USO_TOKEN?.trim();

if (!tokenUso) {
  console.log('[uso] sin USO_TOKEN: /api/uso queda cerrada');
}

export const guardiaUso: RequestHandler = (req, res, next) => {
  const recibido = (req.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!tokenUso || recibido !== tokenUso) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  next();
};

/** Un `ref` es una etiqueta de campana, no un dato de nadie: se normaliza duro. */
export function limpiaRef(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const ref = valor
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 24);
  return ref || null;
}

/**
 * Anota un evento. No devuelve error nunca: medir no puede romper lo medido,
 * asi que quien llama hace `void anota(...)` y sigue.
 */
export async function anota(
  tipo: TipoEvento,
  opts: { ref?: string | null; detalle?: string | null; nodos?: number } = {},
): Promise<void> {
  const ahora = new Date();
  const evento: Evento = {
    tipo,
    ref: opts.ref ?? null,
    detalle: opts.detalle ?? null,
    nodos: opts.nodos ?? 0,
    fecha: ahora.toISOString(),
    dia: ahora.toISOString().slice(0, 10),
  };

  if (!table) {
    memoria.push(evento);
    return;
  }

  try {
    await tableReady;
    await table.createEntity({
      partitionKey: PARTITION,
      // El id aleatorio evita que dos turnos del mismo milisegundo se pisen.
      rowKey: `${evento.fecha}-${randomUUID()}`,
      ...evento,
    });
  } catch (err: any) {
    console.warn('[uso] no se pudo anotar el evento:', err?.message);
    // Que un fallo de la tabla no borre el dato: se queda en memoria hasta el
    // proximo reinicio, que es mas de lo que se tenia antes.
    memoria.push(evento);
  }
}

interface Conteo {
  inicios: number;
  conversaron: number;
  turnos: number;
  materiales: number;
  borrados: number;
  topes: number;
  nodos: number;
}

const vacio = (): Conteo => ({
  inicios: 0,
  conversaron: 0,
  turnos: 0,
  materiales: 0,
  borrados: 0,
  topes: 0,
  nodos: 0,
});

function suma(c: Conteo, e: Evento): void {
  if (e.tipo === 'inicio') c.inicios++;
  else if (e.tipo === 'conversa') c.conversaron++;
  else if (e.tipo === 'turno') c.turnos++;
  else if (e.tipo === 'material') c.materiales++;
  else if (e.tipo === 'borrado') c.borrados++;
  else if (e.tipo === 'tope') c.topes++;
  c.nodos += e.nodos ?? 0;
}

async function todos(): Promise<Evento[]> {
  if (!table) return [...memoria];
  try {
    await tableReady;
    const filas: Evento[] = [];
    for await (const e of table.listEntities<Evento>({
      queryOptions: { filter: `PartitionKey eq '${PARTITION}'` },
    })) {
      filas.push({
        tipo: e.tipo,
        ref: e.ref ?? null,
        detalle: e.detalle ?? null,
        nodos: e.nodos ?? 0,
        fecha: e.fecha,
        dia: e.dia,
      });
    }
    return [...filas, ...memoria];
  } catch (err: any) {
    console.warn('[uso] no se pudieron leer los eventos:', err?.message);
    return [...memoria];
  }
}

/** Los cuatro numeros del contador publico, ya sin caducidad. */
export async function totalesPublicos() {
  const c = vacio();
  for (const e of await todos()) suma(c, e);
  return {
    sesiones: c.inicios,
    sesionesConTurnos: c.conversaron,
    turnos: c.turnos,
    nodos: c.nodos,
  };
}

/**
 * El detalle que no es publico: de donde vino cada quien y que dia.
 * Los `ref` son nombres de campana, y decir en el pie de la web a quien se
 * invito seria contar de mas.
 */
export async function resumenDeUso() {
  const eventos = await todos();
  eventos.sort((a, b) => a.fecha.localeCompare(b.fecha));

  const total = vacio();
  const porRef = new Map<string, Conteo>();
  const porDia = new Map<string, Conteo>();
  const materialesPorTipo: Record<string, number> = {};
  const topesPorTipo: Record<string, number> = {};

  for (const e of eventos) {
    suma(total, e);

    const ref = e.ref ?? 'sin-ref';
    if (!porRef.has(ref)) porRef.set(ref, vacio());
    suma(porRef.get(ref)!, e);

    if (!porDia.has(e.dia)) porDia.set(e.dia, vacio());
    suma(porDia.get(e.dia)!, e);

    if (e.tipo === 'material' && e.detalle) {
      materialesPorTipo[e.detalle] = (materialesPorTipo[e.detalle] ?? 0) + 1;
    }
    if (e.tipo === 'tope' && e.detalle) {
      topesPorTipo[e.detalle] = (topesPorTipo[e.detalle] ?? 0) + 1;
    }
  }

  return {
    desde: eventos[0]?.fecha ?? null,
    hasta: eventos[eventos.length - 1]?.fecha ?? null,
    total,
    porRef: Object.fromEntries(porRef),
    porDia: Object.fromEntries(porDia),
    materialesPorTipo,
    topesPorTipo,
    persistencia: table ? 'azure-table-storage' : 'memoria',
  };
}
