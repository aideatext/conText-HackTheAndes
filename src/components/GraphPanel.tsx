import { useState } from 'react';
import { Download, Image as ImageIcon } from 'lucide-react';
import type { Graph, Metrics, Origin } from '../../shared/types';
import GraphVisualization, { ORIGIN_COLOR, ORIGIN_LABEL } from './GraphVisualization';
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
  const [onlyMine, setOnlyMine] = useState(false);

  const empty = graph.nodes.length === 0;

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-700">Tus ideas conectadas</h2>
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium ring-1 ring-zinc-200">
            <input
              type="checkbox"
              checked={onlyMine}
              onChange={(e) => setOnlyMine(e.target.checked)}
              className="accent-blue-600"
            />
            Mis conexiones
          </label>
          <button
            onClick={() =>
              download(
                new Blob([JSON.stringify(graph, null, 2)], { type: 'application/json' }),
                'mi-grafo-context.json',
              )
            }
            disabled={empty}
            title="Descargar el grafo como JSON"
            className="rounded-full bg-zinc-100 p-2 ring-1 ring-zinc-200 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={async () => {
              if (!svgRef.current) return;
              const png = await svgAPng(svgRef.current);
              if (png) download(new Blob([png as BlobPart], { type: 'image/png' }), 'mi-grafo-context.png');
            }}
            disabled={empty}
            title="Descargar el grafo como imagen PNG"
            className="rounded-full bg-zinc-100 p-2 ring-1 ring-zinc-200 disabled:opacity-40"
          >
            <ImageIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200">
        {empty ? (
          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-zinc-400">
            Aquí vas a ver, en vivo, las ideas que conectes mientras conversas.
          </p>
        ) : (
          <GraphVisualization graph={graph} onlyMine={onlyMine} svgRef={svgRef} />
        )}

        {!empty && (
          <div className="pointer-events-none absolute bottom-2 left-2 flex flex-wrap gap-2 text-[11px]">
            {(Object.keys(ORIGIN_COLOR) as Origin[]).map((o) => (
              <span
                key={o}
                className="flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 ring-1 ring-zinc-200"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: ORIGIN_COLOR[o] }}
                />
                {ORIGIN_LABEL[o]}
              </span>
            ))}
          </div>
        )}
      </div>

      <MetricsPanel metrics={metrics} />
    </section>
  );
}
