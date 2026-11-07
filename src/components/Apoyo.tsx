/**
 * El boton de apoyo del pie y su ventana con el QR CoDi.
 *
 * Dos modos con el mismo mecanismo (un QR de monto libre):
 *   - cafe: "Invítame un café", apoyo general a AIdeaText.
 *   - beca: "Regala sesiones": lo donado financia sesiones para estudiantes que aprenden.
 * Si el servidor dice `off`, no se pinta nada.
 */
import { useEffect, useState } from 'react';
import { Coffee, GraduationCap, X } from 'lucide-react';
import { esSesionInvitada, getApoyo, type Apoyo as DatosApoyo } from '../api';
import { useT } from '../i18n';

export default function Apoyo() {
  const t = useT().apoyo;
  const [datos, setDatos] = useState<DatosApoyo | null>(null);
  const [abierto, setAbierto] = useState(false);
  const invitada = esSesionInvitada();

  useEffect(() => {
    getApoyo().then(setDatos).catch(() => {});
  }, []);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    window.addEventListener('keydown', cerrar);
    return () => window.removeEventListener('keydown', cerrar);
  }, [abierto]);

  if (!datos || datos.modo === 'off' || !datos.qr) {
    return invitada ? <span className="text-tinta-suave/80">· {t.invitada}</span> : null;
  }

  const txt = t[datos.modo];
  const Icono = datos.modo === 'beca' ? GraduationCap : Coffee;

  return (
    <>
      {invitada && <span className="text-tinta-suave/80">· {t.invitada}</span>}
      <button
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1 rounded-full bg-azul/10 px-2.5 py-0.5 font-semibold text-azul hover:bg-azul/20"
      >
        <Icono className="h-3.5 w-3.5" />
        {txt.boton}
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={txt.titulo}
          className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/40 p-4"
          onClick={() => setAbierto(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-grande bg-papel p-6 text-center text-tinta shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setAbierto(false)}
              aria-label={t.cerrar}
              className="absolute right-3 top-3 rounded-full p-1 text-tinta-suave hover:bg-borde/50"
            >
              <X className="h-4 w-4" />
            </button>
            <Icono className="mx-auto h-8 w-8 text-azul" />
            <h2 className="mt-2 text-lg font-bold">{txt.titulo}</h2>
            <p className="mt-2 text-sm leading-relaxed text-tinta-suave">{txt.texto(datos.precio)}</p>
            <img
              src={datos.qr}
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
          </div>
        </div>
      )}
    </>
  );
}
