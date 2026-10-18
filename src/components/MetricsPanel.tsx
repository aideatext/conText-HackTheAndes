/** Indicadores del grafo en lenguaje del estudiante, sin jerga. */
import type { Metrics } from '../../shared/types';

/**
 * La monoespaciada es para las cifras, que se comparan en columna. La idea
 * mas central es una frase: va en la sans y no se parte letra a letra.
 */
function Tile({
  value,
  label,
  texto = false,
}: {
  value: string | number;
  label: string;
  texto?: boolean;
}) {
  return (
    <div className="rounded-chico bg-panel px-3 py-2 ring-1 ring-borde">
      <div
        className={
          texto
            ? 'line-clamp-2 text-sm leading-snug font-semibold text-tinta'
            : 'cifra text-lg leading-tight text-tinta'
        }
        title={texto ? String(value) : undefined}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[11px] leading-tight text-tinta-suave">{label}</div>
    </div>
  );
}

export default function MetricsPanel({ metrics }: { metrics: Metrics }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Tile value={metrics.ideasEstudiante} label="ideas que conectaste tú" />
      <Tile value={metrics.enlacesTotales} label="conexiones entre ideas" />
      <Tile value={metrics.ideaMasCentral ?? '—'} label="la idea que más conecta" texto />
      <Tile value={`${metrics.porcentajeAislados}%`} label="ideas aún sueltas" />
    </div>
  );
}
