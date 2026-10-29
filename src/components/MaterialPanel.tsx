import { useRef, useState } from 'react';
import { Camera, ExternalLink, EyeOff, FileText, Loader2, Upload } from 'lucide-react';
import MaterialPreview from './MaterialPreview';
import Plegable from './Plegable';
import { useT } from '../i18n';

export default function MaterialPanel({
  summary,
  materialName,
  materialUrl,
  materialMime,
  busy,
  error,
  onPick,
  onStartChat,
  extra,
}: {
  summary: string;
  materialName: string | null;
  materialUrl: string | null;
  materialMime: string | null;
  busy: boolean;
  error: string | null;
  onPick: (file: File) => void;
  /** Solo en movil: lleva a la pestana de conversacion. */
  onStartChat?: () => void;
  /** Lo que el estudiante puede hacer con su sesion. */
  extra?: React.ReactNode;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const sinMaterial = !materialName;
  const t = useT().material;

  function handle(file: File | undefined | null) {
    if (!file) return;
    onPick(file);
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <h2 className="titular text-base text-tinta">{t.titulo}</h2>

      {error && (
        <p className="rounded-chico bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}

      {/* Arriba, con todo el espacio: el material entero y lo que Claude entendio de el. */}
      {materialName ? (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-medio bg-white p-4 ring-1 ring-borde">
          <div className="flex items-center gap-2 text-xs font-medium text-tinta-suave">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 truncate">{materialName}</span>
            {materialUrl && (
              <a
                href={materialUrl}
                target="_blank"
                rel="noopener"
                className="flex shrink-0 items-center gap-1 text-azul hover:underline"
              >
                {t.verCompleto} <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          {materialUrl && (
            // Acotada para que el resumen quede a la vista; "Ver completo" la abre entera.
            <MaterialPreview
              url={materialUrl}
              mime={materialMime}
              nombre={materialName}
              className="max-h-[28vh] lg:max-h-[40vh]"
            />
          )}
          <div>
            <h3 className="text-xs font-semibold text-tinta">{t.loQueEntendio}</h3>
            <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-tinta">{summary}</p>
          </div>
          {onStartChat && (
            <button
              onClick={onStartChat}
              className="w-full rounded-chico bg-tinta px-3 py-2 text-sm font-medium text-white"
            >
              {t.conversar}
            </button>
          )}
        </div>
      ) : (
        // En el telefono no hay alto que regalar: el recuadro vacio se queda chico.
        <div className="flex shrink-0 items-center justify-center rounded-medio border border-dashed border-borde p-4 text-center text-xs text-tinta-suave lg:min-h-0 lg:flex-1">
          {busy ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> {t.leyendo}
            </span>
          ) : (
            t.vacio
          )}
        </div>
      )}

      {/* Abajo, plegado en cuanto hay material: subir, el aviso y la sesion. */}
      <div className="min-h-0 space-y-2 overflow-y-auto p-px lg:max-h-[60%] lg:shrink-0">
        <Plegable
          titulo={sinMaterial ? t.subir : t.cambiar}
          icono={<Upload className="h-3.5 w-3.5 text-azul" />}
          abierto={sinMaterial}
        >
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handle(e.dataTransfer.files?.[0]);
            }}
            className={`rounded-medio border-2 border-dashed p-4 text-center transition-colors ${
              dragging ? 'border-azul bg-azul/10' : 'border-borde bg-white'
            }`}
          >
            {busy ? (
              <div className="flex flex-col items-center gap-2 text-sm text-tinta-suave">
                <Loader2 className="h-6 w-6 animate-spin" />
                {t.leyendo}
              </div>
            ) : (
              <>
                <p className="text-sm text-tinta-suave">{t.arrastra}</p>
                {/* Los topes de la prueba, dichos antes de elegir el archivo y no despues del error. */}
                <p className="text-xs text-tinta-suave/70">{t.topes}</p>
                <div className="mt-3 flex justify-center gap-2">
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="rounded-chico bg-tinta px-3 py-1.5 text-xs font-medium text-white"
                  >
                    {t.elegir}
                  </button>
                  <button
                    onClick={() => cameraRef.current?.click()}
                    className="flex items-center gap-1 rounded-chico bg-panel px-3 py-1.5 text-xs font-medium ring-1 ring-borde sm:hidden"
                  >
                    <Camera className="h-3.5 w-3.5" /> {t.foto}
                  </button>
                </div>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,text/markdown,.md"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                // Se vacia para que volver a elegir el mismo archivo (tras un error) cuente.
                e.target.value = '';
                handle(f);
              }}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                // Se vacia para que volver a elegir el mismo archivo (tras un error) cuente.
                e.target.value = '';
                handle(f);
              }}
            />
          </div>
        </Plegable>

        {/*
          Se dice antes de que suba nada, no despues: hay quien trae documentos de trabajo.
          Que pasa con lo subido lo cuenta MiSesion, justo debajo; aqui no se repite.
        */}
        <Plegable
          aviso
          titulo={t.avisoTitulo}
          icono={<EyeOff className="h-3.5 w-3.5 shrink-0 text-azul" />}
          abierto={sinMaterial}
        >
          <p className="text-[11px] leading-relaxed text-tinta-suave">{t.avisoTexto}</p>
        </Plegable>

        {extra}
      </div>
    </section>
  );
}
