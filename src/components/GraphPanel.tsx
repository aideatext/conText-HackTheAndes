import { useState } from 'react';
import { Download, Image as ImageIcon } from 'lucide-react';
import type { Graph, Metrics, Origin } from '../../shared/types';
import GraphVisualization, { ORIGIN_COLOR } from './GraphVisualization';
import { useT } from '../i18n';
import { svgAPng } from '../export';
import MetricsPanel from './MetricsPanel';

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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
          <button
            onClick={() =>
              download(
                new Blob([JSON.stringify(graph, null, 2)], { type: 'application/json' }),
                `${t.archivo}.json`,
              )
            }
            disabled={empty}
            title={t.bajarJson}
            className="rounded-full bg-panel p-2 ring-1 ring-borde disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={async () => {
              if (!svgRef.current) return;
              const png = await svgAPng(svgRef.current);
              if (png) download(new Blob([png as BlobPart], { type: 'image/png' }), `${t.archivo}.png`);
            }}
            disabled={empty}
            title={t.bajarPng}
            className="rounded-full bg-panel p-2 ring-1 ring-borde disabled:opacity-40"
          >
            <ImageIcon className="h-3.5 w-3.5" />
          </button>
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
