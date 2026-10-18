/** Indicadores del grafo en lenguaje del estudiante, sin jerga. */
import type { Metrics } from '../../shared/types';

function Tile({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-3 py-2 ring-1 ring-zinc-200">
      <div className="text-lg leading-tight font-bold text-zinc-900">{value}</div>
      <div className="text-[11px] leading-tight text-zinc-500">{label}</div>
    </div>
  );
}

export default function MetricsPanel({ metrics }: { metrics: Metrics }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Tile value={metrics.ideasEstudiante} label="ideas que conectaste tú" />
      <Tile value={metrics.enlacesTotales} label="conexiones entre ideas" />
      <Tile value={metrics.ideaMasCentral ?? '—'} label="la idea que más conecta" />
      <Tile value={`${metrics.porcentajeAislados}%`} label="ideas aún sueltas" />
    </div>
  );
}
