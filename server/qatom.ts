/**
 * Lo que conText vende en Qatom: la capacidad, no las conversaciones de nadie.
 *
 * Un agente ajeno manda un texto y recibe el grafo de razonamiento validado
 * —ideas con su tipo y quien las dijo, y las relaciones entre ellas—. Es una
 * llamada, un precio y un recibo. Ningun dato de ningun estudiante sale de aqui.
 *
 * La ruta de pago se guarda con un token en la cabecera Authorization y
 * responde 404 si no viene, que es lo que pide la guia de Qatom: quien no pago
 * no deberia ni saber que la ruta existe.
 */
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { claude, MODEL, textOf } from './claude.js';
import { EXTRACTOR_SYSTEM, extractorUserMessage } from './prompts.js';
import { normalizeDelta, parseJsonLoose } from './graph.js';
import type { Graph } from '../shared/types.js';

const token = process.env.QATOM_TOKEN?.trim();

export const qatomEnabled = Boolean(token);

if (!token) {
  console.log('[qatom] sin QATOM_TOKEN: la ruta de pago queda cerrada');
}

/** Contrato de entrada del item de catalogo. */
export const entradaSchema = z.object({
  texto: z.string().min(10).max(12_000),
  // Ids y etiquetas que el comprador ya tiene, para que el grafo se acumule.
  nodosExistentes: z
    .array(z.object({ id: z.string().max(120), label: z.string().max(120) }))
    .max(200)
    .optional(),
});

/** Solo pasa quien trae el token de cumplimiento. El resto no ve la ruta. */
export const guardia: RequestHandler = (req, res, next) => {
  const cabecera = req.get('authorization') ?? '';
  const recibido = cabecera.replace(/^Bearer\s+/i, '').trim();
  if (!token || recibido !== token) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  next();
};

export interface Resultado {
  nodes: Array<{ id: string; label: string; type: string }>;
  links: Array<{ source: string; target: string; relation: string }>;
}

export async function extraerGrafo(
  texto: string,
  nodosExistentes: Array<{ id: string; label: string }> = [],
): Promise<Resultado> {
  const vacio: Graph = {
    nodes: nodosExistentes.map((n) => ({
      id: n.id,
      label: n.label,
      type: 'concepto' as const,
      origin: 'material' as const,
      turn: 0,
    })),
    links: [],
  };

  // El extractor espera turno del estudiante y respuesta del tutor; aqui el
  // comprador manda un texto a secas, asi que el segundo campo va vacio.
  const mensaje = extractorUserMessage(texto, '', nodosExistentes);

  const res = await claude.messages.create({
    model: MODEL,
    max_tokens: 1500,
    // El mismo prefijo que el extractor interno: comparten entrada de cache.
    system: [{ type: 'text', text: EXTRACTOR_SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: mensaje }],
  });

  const delta = normalizeDelta(parseJsonLoose(textOf(res.content as any)), vacio, 0, {
    hasMaterial: true,
    maxNuevos: 40,
  });

  // `origin` (material/estudiante/tutor) es pedagogia interna de conText y no
  // significa nada para un comprador externo: no se vende ruido.
  return {
    nodes: delta.nodes.map(({ id, label, type }) => ({ id, label, type })),
    links: delta.links.map(({ source, target, relation }) => ({ source, target, relation })),
  };
}

/**
 * Descripcion legible por un agente, para pegarla en el item de catalogo.
 * Se sirve en abierto a proposito: es el escaparate, no la mercancia.
 */
export const contrato = {
  nombre: 'aideatext-grafo-de-razonamiento',
  descripcion:
    'Convierte un texto en un grafo de razonamiento: devuelve las ideas como nodos tipados ' +
    '(concepto, afirmacion, evidencia, ejemplo, pregunta) y las relaciones entre ellas ' +
    '(apoya, contradice, causa, ejemplifica, se_relaciona_con, responde_a). Pensado para ' +
    'agentes que necesitan entender la estructura de un argumento, no solo resumirlo. ' +
    'Validado: los enlaces apuntan siempre a nodos existentes y los ids son estables.',
  metodo: 'POST',
  entrada: {
    type: 'object',
    required: ['texto'],
    properties: {
      texto: { type: 'string', minLength: 10, maxLength: 12000, description: 'El texto a analizar.' },
      nodosExistentes: {
        type: 'array',
        description: 'Nodos que el comprador ya tiene, para acumular el grafo entre llamadas.',
        items: {
          type: 'object',
          properties: { id: { type: 'string' }, label: { type: 'string' } },
        },
      },
    },
  },
  salida: {
    type: 'object',
    properties: {
      nodes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            label: { type: 'string' },
            type: { enum: ['concepto', 'afirmacion', 'evidencia', 'ejemplo', 'pregunta'] },
          },
        },
      },
      links: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            source: { type: 'string' },
            target: { type: 'string' },
            relation: {
              enum: ['apoya', 'contradice', 'causa', 'ejemplifica', 'se_relaciona_con', 'responde_a'],
            },
          },
        },
      },
    },
  },
};
