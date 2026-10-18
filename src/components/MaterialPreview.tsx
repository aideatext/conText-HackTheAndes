/**
 * Miniatura del material que acompana toda la conversacion.
 * Imagen: se muestra tal cual. PDF: se dibuja la primera pagina con pdf.js,
 * la misma libreria que usa aidesk, sin mandar el archivo a ningun servicio externo.
 */
import { useEffect, useRef, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';

let pdfjsCargado: Promise<typeof import('pdfjs-dist')> | null = null;
function cargarPdfjs() {
  pdfjsCargado ??= import('pdfjs-dist').then(async (pdfjs) => {
    const worker = await import('pdfjs-dist/build/pdf.worker.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  });
  return pdfjsCargado;
}

export default function MaterialPreview({
  url,
  mime,
  nombre,
  className = '',
}: {
  url: string;
  mime: string | null;
  nombre: string | null;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const esPdf = mime === 'application/pdf';
  const esImagen = Boolean(mime?.startsWith('image/'));

  useEffect(() => {
    if (!esPdf) return;
    let cancelado = false;

    (async () => {
      try {
        const pdfjs = await cargarPdfjs();
        const doc = await pdfjs.getDocument({ url }).promise;
        const pagina = await doc.getPage(1);
        if (cancelado) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const base = pagina.getViewport({ scale: 1 });
        const escala = Math.min(2, (canvas.parentElement?.clientWidth ?? 320) / base.width);
        const viewport = pagina.getViewport({ scale: escala * window.devicePixelRatio });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = '100%';
        canvas.style.height = 'auto';

        await pagina.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise;
        if (!cancelado) setEstado('listo');
      } catch {
        if (!cancelado) setEstado('error');
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [url, esPdf]);

  if (esImagen) {
    return (
      <img
        src={url}
        alt={nombre ? `Material: ${nombre}` : 'Material que subiste'}
        className={`w-full rounded-lg object-contain ring-1 ring-zinc-200 ${className}`}
      />
    );
  }

  if (esPdf) {
    return (
      <div className={`relative overflow-hidden rounded-lg bg-white ring-1 ring-zinc-200 ${className}`}>
        <canvas ref={canvasRef} className="block w-full" />
        {estado === 'cargando' && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
          </div>
        )}
        {estado === 'error' && (
          <div className="flex items-center gap-2 p-4 text-xs text-zinc-500">
            <FileText className="h-4 w-4" /> No pude dibujar la primera página.
          </div>
        )}
        {estado === 'listo' && (
          <span className="absolute right-1 bottom-1 rounded bg-white/90 px-1.5 py-0.5 text-[10px] text-zinc-500 ring-1 ring-zinc-200">
            página 1
          </span>
        )}
      </div>
    );
  }

  // Texto plano: no hay nada que dibujar.
  return (
    <div
      className={`flex items-center gap-2 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500 ring-1 ring-zinc-200 ${className}`}
    >
      <FileText className="h-4 w-4 shrink-0" />
      <span className="truncate">{nombre ?? 'Texto'}</span>
    </div>
  );
}
