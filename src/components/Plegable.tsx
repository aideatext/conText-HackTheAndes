/**
 * Caja que se abre y se cierra. `abierto` es como empieza, y vuelve a mandar cuando
 * cambia (al subir material se pliega sola); entre medio, manda lo que toque el estudiante.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export default function Plegable({
  titulo,
  icono,
  abierto: inicial,
  aviso = false,
  children,
}: {
  titulo: ReactNode;
  icono?: ReactNode;
  abierto: boolean;
  /** Filo rojo: lo que toca los datos del estudiante se reconoce de un vistazo. */
  aviso?: boolean;
  children: ReactNode;
}) {
  const [abierto, setAbierto] = useState(inicial);
  useEffect(() => setAbierto(inicial), [inicial]);

  return (
    <details
      open={abierto}
      onToggle={(e) => setAbierto(e.currentTarget.open)}
      className={`group rounded-medio ring-1 ${aviso ? 'bg-panel ring-rojo/30' : 'bg-white ring-borde'}`}
    >
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs font-semibold text-tinta select-none [&::-webkit-details-marker]:hidden">
        {icono}
        <span className="flex-1">{titulo}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-tinta-suave transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-3 pb-3">{children}</div>
    </details>
  );
}
