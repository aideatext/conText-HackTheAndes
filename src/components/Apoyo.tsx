/**
 * El boton de apoyo de la cabecera (a la derecha de "Llevarme mi resumen").
 *
 *   - gracias (vigente): boton "Gracias". La ventana deja elegir Peru (Yape)
 *     o Mexico (DiMo) y muestra el celular, el titular y el QR si lo hay.
 *   - cafe / beca: MODO DONACION, dormido (ver server/apoyo.ts). Se conserva
 *     intacto para reactivarlo con MODO_DONACION=on.
 * Si el servidor dice `off`, no se pinta nada.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { GraduationCap, HandHeart, Heart, X } from 'lucide-react';
import { getApoyo, type Apoyo as DatosApoyo, type MedioGracias } from '../api';
import { useT } from '../i18n';

export default function Apoyo() {
  const t = useT().apoyo;
  const [datos, setDatos] = useState<DatosApoyo | null>(null);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    getApoyo().then(setDatos).catch(() => {});
  }, []);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    window.addEventListener('keydown', cerrar);
    return () => window.removeEventListener('keydown', cerrar);
  }, [abierto]);

  if (!datos || datos.modo === 'off') return null;
  if (datos.modo === 'gracias' && !datos.medios.length) return null;
  if ((datos.modo === 'cafe' || datos.modo === 'beca') && !datos.qr) return null;

  const boton = datos.modo === 'gracias' ? t.gracias.boton : t[datos.modo].boton;
  const titulo = datos.modo === 'gracias' ? t.gracias.titulo : t[datos.modo].titulo;
  const Icono = datos.modo === 'beca' ? GraduationCap : datos.modo === 'gracias' ? Heart : HandHeart;

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="flex shrink-0 items-center gap-1.5 rounded-medio bg-rojo px-3 py-2 text-xs font-semibold text-white transition-colors hover:opacity-90"
      >
        <Icono className="h-4 w-4" />
        {/* En un telefono el rotulo no cabe: queda el icono, como en "Llevarme mi resumen". */}
        <span className="hidden sm:inline">{boton}</span>
        <span className="sr-only sm:hidden">{boton}</span>
      </button>

      {abierto && (
        <Ventana titulo={titulo} cerrar={() => setAbierto(false)} etiquetaCerrar={t.cerrar}>
          <Icono className="mx-auto h-8 w-8 text-azul" />
          <h2 className="mt-2 text-lg font-bold">{titulo}</h2>
          {datos.modo === 'gracias' ? <Gracias medios={datos.medios} /> : <Donacion datos={datos} />}
        </Ventana>
      )}
    </>
  );
}

function Ventana(p: { titulo: string; cerrar: () => void; etiquetaCerrar: string; children: ReactNode }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={p.titulo}
      className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/40 p-4"
      onClick={p.cerrar}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-grande bg-papel p-6 text-center text-tinta shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={p.cerrar}
          aria-label={p.etiquetaCerrar}
          className="absolute right-3 top-3 rounded-full p-1 text-tinta-suave hover:bg-borde/50"
        >
          <X className="h-4 w-4" />
        </button>
        {p.children}
      </div>
    </div>
  );
}

// ── Gracias: Yape (Peru) / DiMo (Mexico) ─────────────────────────────────
function Gracias({ medios }: { medios: MedioGracias[] }) {
  const t = useT().apoyo.gracias;
  const [elegido, setElegido] = useState<MedioGracias['id']>(medios[0].id);
  const [copiado, setCopiado] = useState(false);
  const medio = medios.find((m) => m.id === elegido) ?? medios[0];
  const txt = t[medio.id];

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(medio.numero.replace(/\s/g, ''));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      /* sin portapapeles: el numero sigue a la vista */
    }
  };

  return (
    <>
      <p className="mt-2 text-sm leading-relaxed text-tinta-suave">{t.texto}</p>
      {medios.length > 1 && (
        <div role="tablist" className="mt-4 grid grid-cols-2 gap-2">
          {medios.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={m.id === medio.id}
              onClick={() => setElegido(m.id)}
              className={`rounded-medio px-3 py-2 text-sm font-semibold transition-colors ${
                m.id === medio.id ? 'bg-azul text-white' : 'bg-panel text-tinta ring-1 ring-borde hover:bg-borde/40'
              }`}
            >
              {t[m.id].pais}
              <span className="block text-[11px] font-normal opacity-80">{t[m.id].medio}</span>
            </button>
          ))}
        </div>
      )}
      {medio.qr && (
        <img
          src={medio.qr}
          width={240}
          height={240}
          alt={t.altQr(txt.medio)}
          className="mx-auto mt-4 w-56 max-w-full rounded-medio bg-white p-2 ring-1 ring-borde"
        />
      )}
      <div className="mt-4 rounded-medio bg-panel p-3 text-sm ring-1 ring-borde">
        <div className="text-[11px] uppercase tracking-wide text-tinta-suave">
          {txt.medio} · {t.numero}
        </div>
        <div className="mt-1 flex items-center justify-center gap-2">
          <span className="text-lg font-bold tabular-nums">{medio.numero}</span>
          <button
            onClick={copiar}
            className="rounded-medio px-2 py-1 text-xs font-semibold text-azul ring-1 ring-azul/40 hover:bg-azul/10"
          >
            {copiado ? t.copiado : t.copiar}
          </button>
        </div>
        {medio.nombre && (
          <div className="mt-1 text-xs text-tinta-suave">
            {t.titular}: <span className="font-semibold text-tinta">{medio.nombre}</span>
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-tinta-suave">{txt.pasos}</p>
      <p className="mt-4 text-[11px] text-tinta-suave/80">{t.privacidad}</p>
    </>
  );
}

// ── MODO DONACION (dormido): QR CoDi y reparto entre estudiantes ─────────
function Donacion({ datos }: { datos: Extract<DatosApoyo, { modo: 'cafe' | 'beca' }> }) {
  const t = useT().apoyo;
  const txt = t[datos.modo];
  return (
    <>
      <p className="mt-2 text-sm leading-relaxed text-tinta-suave">{txt.texto(datos.precio)}</p>
      <img
        src={datos.qr ?? ''}
        width={240}
        height={240}
        alt={t.altQr}
        className="mx-auto my-4 w-56 max-w-full rounded-medio bg-white p-2 ring-1 ring-borde"
      />
      <p className="text-xs text-tinta-suave">{t.pasos}</p>
      {datos.pagina && (
        <a
          href={datos.pagina}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block rounded-medio bg-azul px-4 py-2 text-sm font-semibold text-white hover:bg-azul-hondo"
        >
          {txt.masOpciones}
        </a>
      )}
      <p className="mt-4 text-[11px] text-tinta-suave/80">{t.privacidad}</p>
    </>
  );
}
