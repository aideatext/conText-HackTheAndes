/**
 * Grafo de ideas en vivo. Hereda el force layout, zoom y drag de Discovery-conText,
 * pero el color codifica el ORIGEN (material / estudiante / tutor) y la forma el TIPO.
 */
import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { Graph, GraphLink, GraphNode, NodeType, Origin } from '../../shared/types';
import { useT } from '../i18n';

/**
 * Los tres origenes, con la paleta de AIdeaText. El azul y el rojo son los
 * dos colores del logotipo —AIdea en azul, Text en rojo— y aqui separan al
 * estudiante del tutor; el material queda en tinta suave, que es el color
 * de lo que ya estaba escrito.
 */
export const ORIGIN_COLOR: Record<Origin, string> = {
  material: '#4e5a68', // tinta suave
  estudiante: '#0b7ec5', // azul del logotipo
  tutor: '#ae0025', // rojo del logotipo
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
  const textos = useT();
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
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 4])
      .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoom);

    /** Encuadra todo el grafo: si no, las ideas nuevas quedan fuera de la vista. */
    let usuarioMovioLaVista = false;
    svg.on('wheel.fit mousedown.fit touchstart.fit', () => {
      usuarioMovioLaVista = true;
    });
    const encuadrar = (nodos: SimNode[]) => {
      if (usuarioMovioLaVista || nodos.length === 0) return;
      const xs = nodos.map((n) => n.x ?? 0);
      const ys = nodos.map((n) => n.y ?? 0);
      const margen = 60;
      const x0 = Math.min(...xs) - margen;
      const x1 = Math.max(...xs) + margen;
      const y0 = Math.min(...ys) - margen;
      const y1 = Math.max(...ys) + margen;
      const escala = Math.min(3, Math.max(0.15, 0.95 / Math.max((x1 - x0) / width, (y1 - y0) / height)));
      const t = d3.zoomIdentity
        .translate(width / 2, height / 2)
        .scale(escala)
        .translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
      svg.transition().duration(500).call(zoom.transform, t);
    };

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

    link.append('title').text((d) => textos.relacion[d.relation] ?? d.relation);

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
      .attr('fill', '#16202b')
      .attr('paint-order', 'stroke')
      .attr('stroke', 'white')
      .attr('stroke-width', 3)
      .text((d) => truncate(d.label));

    node.append('title').text((d) => `${d.label}\n${textos.tipo[d.type]} · ${textos.origen[d.origin]}`);

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
      encuadrar(nodes);
    });
    // Por si la simulacion tarda en enfriarse, encuadramos tambien a medio camino.
    const encuadreTemprano = setTimeout(() => encuadrar(nodes), 1200);

    return () => {
      clearTimeout(encuadreTemprano);
      for (const n of nodes) {
        if (n.x != null && n.y != null) positions.current.set(n.id, { x: n.x, y: n.y });
      }
      simulation.stop();
    };
  }, [graph, onlyMine, svgRef, textos]);

  return (
    <svg
      ref={svgRef}
      className="h-full w-full cursor-grab active:cursor-grabbing"
      aria-label={textos.grafo.aria}
    />
  );
}
