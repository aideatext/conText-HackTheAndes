import { useRef, useState } from 'react';
import { Camera, EyeOff, FileText, Loader2, Upload } from 'lucide-react';
import MaterialPreview from './MaterialPreview';

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

  function handle(file: File | undefined | null) {
    if (!file) return;
    onPick(file);
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <h2 className="titular text-base text-tinta">Tu material</h2>

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
        className={`rounded-medio border-2 border-dashed p-5 text-center transition-colors ${
          dragging ? 'border-azul bg-azul/10' : 'border-borde bg-white'
        }`}
      >
        {busy ? (
          <div className="flex flex-col items-center gap-2 text-sm text-tinta-suave">
            <Loader2 className="h-6 w-6 animate-spin" />
            Leyendo tu material…
          </div>
        ) : (
          <>
            <Upload className="mx-auto h-6 w-6 text-tinta-suave/70" />
            <p className="mt-2 text-sm text-tinta-suave">Arrastra una foto, un PDF o un .txt</p>
            <p className="text-xs text-tinta-suave/70">Hasta 10 MB</p>
            <div className="mt-3 flex justify-center gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="rounded-chico bg-tinta px-3 py-1.5 text-xs font-medium text-white"
              >
                Elegir archivo
              </button>
              <button
                onClick={() => cameraRef.current?.click()}
                className="flex items-center gap-1 rounded-chico bg-panel px-3 py-1.5 text-xs font-medium ring-1 ring-borde sm:hidden"
              >
                <Camera className="h-3.5 w-3.5" /> Tomar foto
              </button>
            </div>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,text/markdown,.md"
          className="hidden"
          onChange={(e) => handle(e.target.files?.[0])}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handle(e.target.files?.[0])}
        />
      </div>

      {/*
        Se dice antes de que suba nada, no despues: hay quien trae documentos de trabajo.
        Que pasa con lo subido lo cuenta MiSesion, al pie de esta misma columna; aqui no se repite.
      */}
      <div className="rounded-chico bg-panel px-3 py-2.5 text-[11px] leading-relaxed text-tinta-suave ring-1 ring-rojo/30">
        <p className="flex items-start gap-1.5 font-medium text-tinta">
          <EyeOff className="mt-px h-3.5 w-3.5 shrink-0 text-azul" />
          Antes de subir: quítale los datos sensibles.
        </p>
        <p className="mt-1">
          Nombres de personas, montos, direcciones, razones sociales. conText piensa igual de bien
          sin ellos. Si lo que traes es un texto, súbelo en <strong>.txt</strong>.
        </p>
      </div>

      {error && (
        <p className="rounded-chico bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}

      {materialName && (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-medio bg-white p-4 ring-1 ring-borde">
          <div className="flex items-center gap-2 text-xs font-medium text-tinta-suave">
            <FileText className="h-3.5 w-3.5" />
            <span className="truncate">{materialName}</span>
          </div>
          {materialUrl && (
            <MaterialPreview
              url={materialUrl}
              mime={materialMime}
              nombre={materialName}
              className="max-h-64"
            />
          )}
          <p className="text-sm leading-relaxed text-tinta">{summary}</p>
          {onStartChat && (
            <button
              onClick={onStartChat}
              className="w-full rounded-chico bg-tinta px-3 py-2 text-sm font-medium text-white"
            >
              Conversar sobre esto
            </button>
          )}
        </div>
      )}

      {extra && <div className="mt-auto">{extra}</div>}
    </section>
  );
}
