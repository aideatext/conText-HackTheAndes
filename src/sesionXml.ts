/**
 * La sesion de conText en XML: conversacion + grafo + resumen.
 *
 * Es el archivo que permite CONTINUAR la conversacion despues: se sube en
 * «Tu sesion es tuya» y el servidor la reconstruye. Antes era un JSON; un
 * estudiante bajo solo el PDF, no encontro el JSON (era un icono sin rotulo) y
 * perdio una conversacion con 87 ideas conectadas. Por eso ahora es el boton
 * [1] de la cabecera y se llama por lo que lleva: el grafo.
 *
 * Retomar acepta XML y, por compatibilidad, los JSON que ya se bajaron.
 */
import type { SesionExportada } from './api';
import type { ChatMessage, Graph, GraphLink, GraphNode } from '../shared/types';

const RAIZ = 'contextSesion';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function sesionAXml(d: SesionExportada): string {
  const nodos = d.graph.nodes
    .map(
      (n) =>
        `    <nodo id="${esc(n.id)}" tipo="${esc(n.type)}" origen="${esc(n.origin)}" turno="${n.turn}">${esc(n.label)}</nodo>`,
    )
    .join('\n');
  const enlaces = d.graph.links
    .map(
      (l) =>
        `    <enlace desde="${esc(l.source)}" hasta="${esc(l.target)}" relacion="${esc(l.relation)}" origen="${esc(l.origin)}" turno="${l.turn}"/>`,
    )
    .join('\n');
  const mensajes = d.messages
    .map((m) => `    <mensaje rol="${m.role}">${esc(m.content)}</mensaje>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Sesion de conText (context.aideatext.ai). Subela en «Tu sesion es tuya» para seguir conversando. -->
<${RAIZ} version="${d.version}" exportadaEl="${esc(d.exportadaEl)}" turnos="${d.turns}">
  <material>${esc(d.materialName ?? '')}</material>
  <resumen>${esc(d.summary)}</resumen>
  <grafo nodos="${d.graph.nodes.length}" enlaces="${d.graph.links.length}">
${nodos}
${enlaces}
  </grafo>
  <conversacion>
${mensajes}
  </conversacion>
</${RAIZ}>
`;
}

/** Lee un XML de sesion (o un JSON antiguo) y devuelve lo que espera el servidor. */
export function leerSesion(texto: string): SesionExportada {
  const t = texto.trimStart();
  if (t.startsWith('{')) return JSON.parse(t) as SesionExportada;

  const doc = new DOMParser().parseFromString(t, 'application/xml');
  const raiz = doc.documentElement;
  if (!raiz || raiz.nodeName !== RAIZ || doc.getElementsByTagName('parsererror').length) {
    throw new Error('no-es-sesion');
  }
  const num = (v: string | null) => Number(v ?? 0) || 0;
  const nodes: GraphNode[] = Array.from(raiz.getElementsByTagName('nodo')).map((n) => ({
    id: n.getAttribute('id') ?? '',
    label: n.textContent ?? '',
    type: n.getAttribute('tipo') as GraphNode['type'],
    origin: n.getAttribute('origen') as GraphNode['origin'],
    turn: num(n.getAttribute('turno')),
  }));
  const links: GraphLink[] = Array.from(raiz.getElementsByTagName('enlace')).map((l) => ({
    source: l.getAttribute('desde') ?? '',
    target: l.getAttribute('hasta') ?? '',
    relation: l.getAttribute('relacion') as GraphLink['relation'],
    origin: l.getAttribute('origen') as GraphLink['origin'],
    turn: num(l.getAttribute('turno')),
  }));
  const messages: ChatMessage[] = Array.from(raiz.getElementsByTagName('mensaje')).map((m) => ({
    role: m.getAttribute('rol') === 'assistant' ? 'assistant' : 'user',
    content: m.textContent ?? '',
  }));
  const graph: Graph = { nodes, links };
  const material = raiz.getElementsByTagName('material')[0]?.textContent ?? '';
  return {
    version: num(raiz.getAttribute('version')) || 1,
    exportadaEl: raiz.getAttribute('exportadaEl') ?? '',
    messages,
    graph,
    summary: raiz.getElementsByTagName('resumen')[0]?.textContent ?? '',
    materialName: material || null,
    turns: num(raiz.getAttribute('turnos')),
  };
}
