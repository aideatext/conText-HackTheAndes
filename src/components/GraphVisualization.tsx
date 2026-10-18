/**
 * Grafo de ideas en vivo. Hereda el force layout, zoom y drag de Discovery-conText,
 * pero el color codifica el ORIGEN (material / estudiante / tutor) y la forma el TIPO.
 */
import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { Graph, GraphLink, GraphNode, NodeType, Origin } from '../../shared/types';

export const ORIGIN_COLOR: Record<Origin, string> = {
  material: '#64748b', // pizarra: lo que vino del archivo
  estudiante: '#2563eb', // azul: lo que construyo el estudiante
  tutor: '#d97706', // ambar: lo que introdujo el tutor
};

export const ORIGIN_LABEL: Record<Origin, string> = {
  material: 'Del material',
  estudiante: 'Mis ideas',
  tutor: 'Del tutor',
};

export const TYPE_LABEL: Record<NodeType, string> = {
  concepto: 'concepto',
  afirmacion: 'afirmación',
  evidencia: 'evidencia',
  ejemplo: 'ejemplo',
  pregunta: 'pregunta',
};

const RELATION_LABEL: Record<string, string> = {
  apoya: 'apoya',
  contradice: 'contradice',
  causa: 'causa',
  ejemplifica: 'ejemplifica',
  se_relaciona_con: 'se relaciona con',
  responde_a: 'responde a',
};

type SimNode = GraphNode & d3.SimulationNodeDatum;
type SimLink = Omit<GraphLink, 'source' | 'target'> & {
  source: string | SimNode;
  target: string | SimNode;
};

/** Forma por tipo de idea: circulo, cuadrado, rombo, triangulo, hexagono. */
function shapePath(type: NodeType, r: number): string {
  const sym = {
    concepto: d3.symbolCircle,
    afirmacion: d3.symbolSquare,
    evidencia: d3.symbolDiamond,
    ejemplo: d3.symbolTriangle,
    pregunta: d3.symbolWye,
  }[type];
  return d3.symbol().type(sym ?? d3.symbolCircle).size(r * r * 3.2)() ?? '';
}

function truncate(text: string, max = 26) {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

export default function GraphVisualization({
  graph,
  onlyMine,
  svgRef: externalRef,
}: {
  graph: Graph;
  onlyMine: boolean;
  svgRef?: React.RefObject<SVGSVGElement | null>;
}) {
  const localRef = useRef<SVGSVGElement>(null);
  const svgRef = externalRef ?? localRef;
  // Conservamos las posiciones entre renders para que el grafo no "salte" al crecer.
  const positions = useRef(new Map<string, { x: number; y: number }>());

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;

    const width = el.clientWidth || 600;
    const height = el.clientHeight || 400;

    const svg = d3.select(el);
    svg.selectAll('*').remove();

    const defs = svg.append('defs');
    for (const [origin, color] of Object.entries(ORIGIN_COLOR)) {
      defs
        .append('marker')
        .attr('id', `arrow-${origin}`)
        .attr('viewBox', '-0 -5 10 10')
        .attr('refX', 24)
        .attr('refY', 0)
        .attr('orient', 'auto')
        .attr('markerWidth', 5)
        .attr('markerHeight', 5)
        .append('svg:path')
        .attr('d', 'M 0,-5 L 10,0 L 0,5')
        .attr('fill', color);
    }

    const g = svg.append('g');
    svg.call(
      d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 4])
        .on('zoom', (event) => g.attr('transform', event.transform)),
    );

    const visible = onlyMine
      ? graph.nodes.filter((n) => n.origin === 'estudiante')
      : graph.nodes;
    const visibleIds = new Set(visible.map((n) => n.id));

    const nodes: SimNode[] = visible.map((n) => ({
      ...n,
      ...(positions.current.get(n.id) ?? {}),
    }));
    const links: SimLink[] = graph.links
      .filter((l) => visibleIds.has(l.source) && visibleIds.has(l.target))
      .map((l) => ({ ...l }));

    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance(130),
      )
      .force('charge', d3.forceManyBody().strength(-420))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(52));

    const link = g
      .append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', (d) => ORIGIN_COLOR[d.origin])
      .attr('stroke-opacity', 0.55)
      .attr('stroke-width', 1.8)
      .attr('marker-end', (d) => `url(#arrow-${d.origin})`);

    link.append('title').text((d) => RELATION_LABEL[d.relation] ?? d.relation);

    const node = g
      .append('g')
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodes, (d) => d.id)
      .join('g')
      .attr('cursor', 'grab')
      .call(
        d3
          .drag<SVGGElement, SimNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      );

    node
      .append('path')
      .attr('d', (d) => shapePath(d.type, 22))
      .attr('fill', 'white')
      .attr('stroke', (d) => ORIGIN_COLOR[d.origin])
      .attr('stroke-width', 2.5);

    // Nodos nuevos: entran con animacion.
    node
      .filter((d) => !positions.current.has(d.id))
      .attr('opacity', 0)
      .select('path')
      .attr('transform', 'scale(0.2)')
      .transition()
      .duration(600)
      .attr('transform', 'scale(1)');
    node.transition().duration(600).attr('opacity', 1);

    node
      .append('text')
      .attr('dy', 34)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('fill', '#18181b')
      .attr('paint-order', 'stroke')
      .attr('stroke', 'white')
      .attr('stroke-width', 3)
      .text((d) => truncate(d.label));

    node.append('title').text((d) => `${d.label}\n${TYPE_LABEL[d.type]} · ${ORIGIN_LABEL[d.origin]}`);

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as SimNode).x ?? 0)
        .attr('y1', (d) => (d.source as SimNode).y ?? 0)
        .attr('x2', (d) => (d.target as SimNode).x ?? 0)
        .attr('y2', (d) => (d.target as SimNode).y ?? 0);
      node.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    simulation.on('end', () => {
      for (const n of nodes) {
        if (n.x != null && n.y != null) positions.current.set(n.id, { x: n.x, y: n.y });
      }
    });

    return () => {
      for (const n of nodes) {
        if (n.x != null && n.y != null) positions.current.set(n.id, { x: n.x, y: n.y });
      }
      simulation.stop();
    };
  }, [graph, onlyMine, svgRef]);

  return (
    <svg
      ref={svgRef}
      className="h-full w-full cursor-grab active:cursor-grabbing"
      aria-label="Grafo de las ideas conectadas"
    />
  );
}
