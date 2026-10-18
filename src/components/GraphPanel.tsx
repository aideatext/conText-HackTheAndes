import { useRef, useState } from 'react';
import { Download, Image as ImageIcon } from 'lucide-react';
import type { Graph, Metrics, Origin } from '../../shared/types';
import GraphVisualization, { ORIGIN_COLOR, ORIGIN_LABEL } from './GraphVisualization';
import MetricsPanel from './MetricsPanel';

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Rasteriza el SVG a PNG sin librerias extra. */
async function exportPng(svg: SVGSVGElement) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const width = svg.clientWidth || 800;
  const height = svg.clientHeight || 600;
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', '100%');
  bg.setAttribute('height', '100%');
  bg.setAttribute('fill', '#ffffff');
  clone.insertBefore(bg, clone.firstChild);

  const source = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(source)));
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0);
  canvas.toBlob((blob) => blob && download(blob, 'mi-grafo-context.png'));
}

export default function GraphPanel({ graph, metrics }: { graph: Graph; metrics: Metrics }) {
  const [onlyMine, setOnlyMine] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

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
            onClick={() => svgRef.current && exportPng(svgRef.current)}
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
