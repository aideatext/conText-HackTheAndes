/**
 * Lo que el estudiante puede hacer con lo suyo: llevarselo, volver a abrirlo
 * o borrarlo. Y, dicho sin letra chica, que pasa con sus datos.
 */
import { useRef, useState } from 'react';
import { FolderOpen, Loader2, Save, ShieldCheck, Trash2 } from 'lucide-react';

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
  const archivoRef = useRef<HTMLInputElement>(null);
  const [confirmando, setConfirmando] = useState(false);

  // El filo rojo —el del logotipo— hermana esta caja con el aviso de arriba:
  // lo que toca tus datos se reconoce de un vistazo.
  return (
    <section className="space-y-2 rounded-medio bg-panel p-3 ring-1 ring-rojo/30">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-tinta">
        <ShieldCheck className="h-3.5 w-3.5 text-azul" />
        Tu sesión es tuya
      </h3>

      <p className="text-[11px] leading-snug text-tinta-suave">
        Si pulsas <strong>Borrar todo</strong>, tu conversación, tu grafo y tu archivo desaparecen
        del servidor en el momento. Si no lo pulsas, se borran solos a los 7 días. Guárdate el JSON
        y podrás retomar la conversación cuando quieras.
      </p>

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={onGuardar}
          disabled={!hayAlgo || ocupado}
          className="flex items-center gap-1.5 rounded-chico bg-white px-2.5 py-1.5 text-[11px] font-medium text-tinta ring-1 ring-borde transition-colors hover:bg-papel disabled:opacity-40"
        >
          <Save className="h-3.5 w-3.5" /> Guardar sesión
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
          Retomar
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
              Sí, borrar todo
            </button>
            <button
              onClick={() => setConfirmando(false)}
              className="rounded-chico px-2 py-1.5 text-[11px] text-tinta-suave underline"
            >
              Cancelar
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirmando(true)}
            disabled={!hayAlgo || ocupado}
            className="flex items-center gap-1.5 rounded-chico bg-white px-2.5 py-1.5 text-[11px] font-medium text-rojo ring-1 ring-rojo/30 transition-colors hover:bg-rojo/5 disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" /> Borrar todo
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
    </section>
  );
}
