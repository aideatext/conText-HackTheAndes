/** Tipos del grafo pedagogico, compartidos entre servidor y navegador. */

export const NODE_TYPES = ['concepto', 'afirmacion', 'evidencia', 'ejemplo', 'pregunta'] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export const ORIGINS = ['material', 'estudiante', 'tutor'] as const;
export type Origin = (typeof ORIGINS)[number];

export const RELATIONS = [
  'apoya',
  'contradice',
  'causa',
  'ejemplifica',
  'se_relaciona_con',
  'responde_a',
] as const;
export type Relation = (typeof RELATIONS)[number];

export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  origin: Origin;
  turn: number;
}

export interface GraphLink {
  source: string;
  target: string;
  relation: Relation;
  origin: Origin;
  turn: number;
}

export interface Graph {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface GraphDelta {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface Metrics {
  /** Ideas que conecto el estudiante (nodos origin=estudiante). */
  ideasEstudiante: number;
  nodosTotales: number;
  enlacesTotales: number;
  /** Etiqueta del nodo con mayor grado. */
  ideaMasCentral: string | null;
  /** Porcentaje (0-100) de nodos sin ningun enlace. */
  porcentajeAislados: number;
  turnos: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface SessionSnapshot {
  sessionId: string;
  messages: ChatMessage[];
  graph: Graph;
  summary: string;
  materialName: string | null;
  metrics: Metrics;
}
