/**
 * Lo que el estudiante puede hacer con lo suyo: llevarselo, volver a abrirlo
 * o borrarlo. Y, dicho sin letra chica, que pasa con sus datos.
 */
import { useRef, useState } from 'react';
import { FolderOpen, Loader2, Save, ShieldCheck, Trash2 } from 'lucide-react';
import Plegable from './Plegable';
import { useT } from '../i18n';

export default function MiSesion({
  onGuardar,
  onRetomar,
  onBorrar,
  ocupado,
  hayAlgo,
}: {
  onGuardar: () => void;
  onRetomar: (archivo: File) => void;
  onBorrar: () => void;
  ocupado: boolean;
  hayAlgo: boolean;
}) {
  const t = useT().sesion;
  const archivoRef = useRef<HTMLInputElement>(null);
  const [confirmando, setConfirmando] = useState(false);

  // El filo rojo —el del logotipo— hermana esta caja con el aviso de arriba:
  // lo que toca tus datos se reconoce de un vistazo. Abierta mientras no hay nada,
  // que es cuando sirve "Retomar"; plegada en cuanto hay conversacion o material.
  return (
    <Plegable
      aviso
      titulo={t.titulo}
      icono={<ShieldCheck className="h-3.5 w-3.5 text-azul" />}
      abierto={!hayAlgo}
    >
      <div className="space-y-2">
        <p className="text-[11px] leading-snug text-tinta-suave">{t.explica}</p>

        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={onGuardar}
            disabled={!hayAlgo || ocupado}
            className="flex items-center gap-1.5 rounded-chico bg-white px-2.5 py-1.5 text-[11px] font-medium text-tinta ring-1 ring-borde transition-colors hover:bg-papel disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" /> {t.guardar}
          </button>

          <button
            onClick={() => archivoRef.current?.click()}
            disabled={ocupado}
            className="flex items-center gap-1.5 rounded-chico bg-white px-2.5 py-1.5 text-[11px] font-medium text-tinta ring-1 ring-borde transition-colors hover:bg-papel disabled:opacity-40"
          >
            {ocupado ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FolderOpen className="h-3.5 w-3.5" />
            )}
            {t.retomar}
          </button>

          {confirmando ? (
            <span className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setConfirmando(false);
                  onBorrar();
                }}
                className="rounded-chico bg-rojo px-2.5 py-1.5 text-[11px] font-semibold text-white"
              >
                {t.confirmar}
              </button>
              <button
                onClick={() => setConfirmando(false)}
                className="rounded-chico px-2 py-1.5 text-[11px] text-tinta-suave underline"
              >
                {t.cancelar}
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmando(true)}
              disabled={!hayAlgo || ocupado}
              className="flex items-center gap-1.5 rounded-chico bg-white px-2.5 py-1.5 text-[11px] font-medium text-rojo ring-1 ring-rojo/30 transition-colors hover:bg-rojo/5 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" /> {t.borrar}
            </button>
          )}
        </div>

        <input
          ref={archivoRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) onRetomar(f);
          }}
        />
      </div>
    </Plegable>
  );
}
