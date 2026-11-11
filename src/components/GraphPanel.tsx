import { useState } from 'react';
import type { Graph, Metrics, Origin } from '../../shared/types';
import GraphVisualization, { ORIGIN_COLOR } from './GraphVisualization';
import { useT } from '../i18n';
import MetricsPanel from './MetricsPanel';

export default function GraphPanel({
  graph,
  metrics,
  svgRef,
}: {
  graph: Graph;
  metrics: Metrics;
  svgRef: React.RefObject<SVGSVGElement | null>;
}) {
  const textos = useT();
  const t = textos.grafo;
  const [onlyMine, setOnlyMine] = useState(false);

  const empty = graph.nodes.length === 0;

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="titular text-base text-tinta">{t.titulo}</h2>
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-full bg-panel px-3 py-1.5 text-xs font-medium ring-1 ring-borde">
            <input
              type="checkbox"
              checked={onlyMine}
              onChange={(e) => setOnlyMine(e.target.checked)}
              className="accent-azul"
            />
            {t.misConexiones}
          </label>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-medio bg-white ring-1 ring-borde">
        {empty ? (
          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-tinta-suave/70">
            {t.vacio}
          </p>
        ) : (
          <GraphVisualization graph={graph} onlyMine={onlyMine} svgRef={svgRef} />
        )}

        {!empty && (
          <div className="pointer-events-none absolute bottom-2 left-2 flex flex-wrap gap-2 text-[11px]">
            {(Object.keys(ORIGIN_COLOR) as Origin[]).map((o) => (
              <span
                key={o}
                className="flex items-center gap-1 rounded-full bg-papel/90 px-2 py-0.5 ring-1 ring-borde"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: ORIGIN_COLOR[o] }}
                />
                {textos.origen[o]}
              </span>
            ))}
          </div>
        )}
      </div>

      <MetricsPanel metrics={metrics} />
    </section>
  );
}
