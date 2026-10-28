/** ES / EN en la cabecera. Cambia la interfaz; el tutor ya contesta en el idioma en que le escriben. */
import { IDIOMAS } from '../../shared/idioma';
import { cambiarIdioma, useIdioma, useT } from '../i18n';

export default function SelectorIdioma() {
  const idioma = useIdioma();
  const t = useT();
  return (
    <div
      role="group"
      aria-label={t.cabecera.idioma}
      className="flex shrink-0 rounded-full bg-panel p-0.5 text-[11px] font-semibold ring-1 ring-borde"
    >
      {IDIOMAS.map((i) => (
        <button
          key={i}
          onClick={() => cambiarIdioma(i)}
          aria-pressed={idioma === i}
          lang={i}
          className={`rounded-full px-2 py-1 uppercase transition-colors ${
            idioma === i ? 'bg-tinta text-white' : 'text-tinta-suave hover:text-tinta'
          }`}
        >
          {i}
        </button>
      ))}
    </div>
  );
}
