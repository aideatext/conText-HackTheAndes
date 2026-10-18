/** Validacion, normalizacion y fusion del grafo. Nunca lanza hacia la conversacion. */
import { z } from 'zod';
import {
  NODE_TYPES,
  ORIGINS,
  RELATIONS,
  type Graph,
  type GraphDelta,
  type GraphLink,
  type GraphNode,
  type Metrics,
} from '../shared/types.js';

const MAX_NEW_NODES = 8;

const rawNode = z.object({
  id: z.string().min(1).max(120),
  label: z.string().min(1).max(120),
  type: z.enum(NODE_TYPES),
  origin: z.enum(ORIGINS),
});

const rawLink = z.object({
  source: z.string().min(1).max(120),
  target: z.string().min(1).max(120),
  relation: z.enum(RELATIONS),
  origin: z.enum(ORIGINS).optional(),
});

export const extractionSchema = z.object({
  nodes: z.array(rawNode).default([]),
  links: z.array(rawLink).default([]),
});

export const materialSchema = extractionSchema.extend({
  summary: z.string().default(''),
});

/** slug en minusculas, sin tildes, con guiones. */
export function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Extrae el primer objeto JSON de una respuesta del modelo (tolera ```json ... ```). */
export function parseJsonLoose(text: string): unknown {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('sin JSON en la respuesta');
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

/**
 * Normaliza la extraccion del modelo contra el grafo actual y devuelve solo lo nuevo.
 * Descarta nodos repetidos, enlaces a ids inexistentes y enlaces duplicados.
 */
export function normalizeDelta(raw: unknown, graph: Graph, turn: number): GraphDelta {
  const parsed = extractionSchema.safeParse(raw);
  if (!parsed.success) return { nodes: [], links: [] };

  const existingIds = new Set(graph.nodes.map((n) => n.id));
  // Un mismo concepto puede volver con otra etiqueta: indexamos tambien por slug de etiqueta.
  const byLabel = new Map(graph.nodes.map((n) => [slug(n.label), n.id]));
  const remap = new Map<string, string>();

  const newNodes: GraphNode[] = [];
  for (const n of parsed.data.nodes) {
    const label = n.label.trim().slice(0, 80);
    if (!label) continue;

    const proposed = slug(n.id) || slug(label);
    if (!proposed) continue;

    const alias = byLabel.get(slug(label));
    if (existingIds.has(proposed)) {
      remap.set(n.id, proposed);
      continue;
    }
    if (alias) {
      remap.set(n.id, alias);
      continue;
    }
    if (newNodes.length >= MAX_NEW_NODES) continue;

    const node: GraphNode = { id: proposed, label, type: n.type, origin: n.origin, turn };
    newNodes.push(node);
    existingIds.add(proposed);
    byLabel.set(slug(label), proposed);
    remap.set(n.id, proposed);
  }

  const resolve = (id: string): string | null => {
    const direct = remap.get(id);
    if (direct) return direct;
    const s = slug(id);
    if (existingIds.has(s)) return s;
    return byLabel.get(s) ?? null;
  };

  const seenLinks = new Set(graph.links.map((l) => `${l.source}|${l.target}|${l.relation}`));
  const newLinks: GraphLink[] = [];
  for (const l of parsed.data.links) {
    const source = resolve(l.source);
    const target = resolve(l.target);
    if (!source || !target || source === target) continue;

    const key = `${source}|${target}|${l.relation}`;
    if (seenLinks.has(key)) continue;
    seenLinks.add(key);

    const origin =
      l.origin ??
      newNodes.find((n) => n.id === source)?.origin ??
      graph.nodes.find((n) => n.id === source)?.origin ??
      'estudiante';
    newLinks.push({ source, target, relation: l.relation, origin, turn });
  }

  return { nodes: newNodes, links: newLinks };
}

/** Fusiona el delta en el grafo (deduplicando por id). */
export function mergeDelta(graph: Graph, delta: GraphDelta): void {
  const ids = new Set(graph.nodes.map((n) => n.id));
  for (const n of delta.nodes) {
    if (!ids.has(n.id)) {
      graph.nodes.push(n);
      ids.add(n.id);
    }
  }
  const keys = new Set(graph.links.map((l) => `${l.source}|${l.target}|${l.relation}`));
  for (const l of delta.links) {
    const key = `${l.source}|${l.target}|${l.relation}`;
    if (!keys.has(key)) {
      graph.links.push(l);
      keys.add(key);
    }
  }
}

export function computeMetrics(graph: Graph, turnos: number): Metrics {
  const grado = new Map<string, number>();
  for (const n of graph.nodes) grado.set(n.id, 0);
  for (const l of graph.links) {
    grado.set(l.source, (grado.get(l.source) ?? 0) + 1);
    grado.set(l.target, (grado.get(l.target) ?? 0) + 1);
  }

  let central: string | null = null;
  let max = 0;
  for (const [id, g] of grado) {
    if (g > max) {
      max = g;
      central = graph.nodes.find((n) => n.id === id)?.label ?? null;
    }
  }

  const aislados = [...grado.values()].filter((g) => g === 0).length;

  return {
    ideasEstudiante: graph.nodes.filter((n) => n.origin === 'estudiante').length,
    nodosTotales: graph.nodes.length,
    enlacesTotales: graph.links.length,
    ideaMasCentral: central,
    porcentajeAislados: graph.nodes.length ? Math.round((aislados / graph.nodes.length) * 100) : 0,
    turnos,
  };
}
