import { useRef, useState } from 'react';
import { Camera, FileText, Loader2, Upload } from 'lucide-react';
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
      <h2 className="text-sm font-semibold text-zinc-700">Tu material</h2>

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
        className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
          dragging ? 'border-blue-500 bg-blue-50' : 'border-zinc-300 bg-white'
        }`}
      >
        {busy ? (
          <div className="flex flex-col items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="h-6 w-6 animate-spin" />
            Leyendo tu material…
          </div>
        ) : (
          <>
            <Upload className="mx-auto h-6 w-6 text-zinc-400" />
            <p className="mt-2 text-sm text-zinc-600">Arrastra una foto, un PDF o un .txt</p>
            <p className="text-xs text-zinc-400">Hasta 10 MB</p>
            <div className="mt-3 flex justify-center gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white"
              >
                Elegir archivo
              </button>
              <button
                onClick={() => cameraRef.current?.click()}
                className="flex items-center gap-1 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium ring-1 ring-zinc-200 sm:hidden"
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

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}

      {materialName && (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl bg-white p-4 ring-1 ring-zinc-200">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
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
          <p className="text-sm leading-relaxed text-zinc-700">{summary}</p>
          {onStartChat && (
            <button
              onClick={onStartChat}
              className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
            >
              Conversar sobre esto
            </button>
          )}
        </div>
      )}
    </section>
  );
}
