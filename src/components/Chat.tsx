import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Image as ImageIcon,
  Loader2,
  Mic,
  Send,
  Square,
  Volume2,
} from 'lucide-react';
import type { ChatMessage } from '../../shared/types';
import { dictationSupported, ttsSupported, useDictation, useReadAloud } from '../speech';
import MaterialPreview from './MaterialPreview';

export default function Chat({
  messages,
  draft,
  setDraft,
  onSubmit,
  streaming,
  disabled,
  error,
  material,
}: {
  messages: ChatMessage[];
  draft: string;
  setDraft: (v: string) => void;
  onSubmit: () => void;
  streaming: boolean;
  disabled: boolean;
  error: string | null;
  /** Solo en movil: el material queda fijo sobre la conversacion. */
  material?: { url: string; mime: string | null; nombre: string | null } | null;
}) {
  const [materialAbierto, setMaterialAbierto] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  // El dictado agrega lo que vas diciendo al final de lo que ya escribiste.
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const dictado = useDictation((texto) =>
    setDraft((draftRef.current ? draftRef.current.trimEnd() + ' ' : '') + texto),
  );
  const voz = useReadAloud();
  const puedeDictar = dictationSupported();
  // Aunque el navegador no tenga voz propia, Azure Speech puede leer igual.
  const puedeLeer = ttsSupported() || true;

  // Al terminar un turno, el tutor lee su respuesta si la voz esta activada.
  const [vozAuto, setVozAuto] = useState(false);
  const ultimoLeido = useRef(-1);
  useEffect(() => {
    if (!vozAuto || streaming) return;
    const i = messages.length - 1;
    const ultimo = messages[i];
    if (!ultimo || ultimo.role !== 'assistant' || !ultimo.content.trim()) return;
    if (ultimoLeido.current === i) return;
    ultimoLeido.current = i;
    void voz.speak(i, ultimo.content);
    // voz.speak cambia de identidad en cada render: no es una dependencia util aqui.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vozAuto, streaming, messages]);

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-700">Conversación</h2>
        {puedeLeer && (
          <label className="flex cursor-pointer items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium ring-1 ring-zinc-200">
            <input
              type="checkbox"
              checked={vozAuto}
              onChange={(e) => {
                setVozAuto(e.target.checked);
                if (!e.target.checked) voz.stop();
              }}
              className="accent-amber-600"
            />
            <Volume2 className="h-3.5 w-3.5" />
            El tutor habla
          </label>
        )}
      </div>

      {material && (
        <button
          onClick={() => setMaterialAbierto((v) => !v)}
          aria-expanded={materialAbierto}
          className="shrink-0 overflow-hidden rounded-xl bg-white text-left ring-1 ring-zinc-200"
        >
          <div className="flex items-center gap-2 px-3 py-2">
            <ImageIcon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
            <span className="flex-1 truncate text-xs text-zinc-600">
              {material.nombre ?? 'Tu material'}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform ${
                materialAbierto ? 'rotate-180' : ''
              }`}
            />
          </div>
          {materialAbierto && (
            <div className="px-3 pb-3">
              <MaterialPreview
                url={material.url}
                mime={material.mime}
                nombre={material.nombre}
                className="max-h-56"
              />
            </div>
          )}
        </button>
      )}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl bg-white p-4 ring-1 ring-zinc-200">
        {messages.length === 0 && (
          <div className="space-y-2 text-sm text-zinc-400">
            <p>Cuéntame qué estás estudiando y empezamos.</p>
            <p>Si subes una foto de tu cuaderno, conversamos sobre eso.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === 'user' ? 'flex justify-end' : 'flex items-end justify-start gap-1'}
          >
            <div
              className={
                m.role === 'user'
                  ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-zinc-900 px-4 py-2 text-sm whitespace-pre-wrap text-white'
                  : 'max-w-[90%] rounded-2xl rounded-bl-sm bg-zinc-100 px-4 py-2 text-sm whitespace-pre-wrap text-zinc-900'
              }
            >
              {m.content ||
                (streaming && i === messages.length - 1 ? (
                  <span className="inline-flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:240ms]" />
                  </span>
                ) : (
                  ''
                ))}
            </div>
            {m.role === 'assistant' && puedeLeer && m.content && (
              <button
                onClick={() => voz.speak(i, m.content)}
                title={voz.speakingId === i ? 'Detener' : 'Leer en voz alta'}
                aria-label={voz.speakingId === i ? 'Detener la lectura' : 'Leer en voz alta'}
                className={`shrink-0 rounded-full p-1.5 ring-1 ring-zinc-200 ${
                  voz.speakingId === i ? 'bg-amber-100 text-amber-700' : 'bg-white text-zinc-400'
                }`}
              >
                {voz.speakingId === i ? (
                  <Square className="h-3.5 w-3.5" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {(error || dictado.error) && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {error ?? dictado.error}
        </p>
      )}

      {dictado.listening && (
        <p className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          Te escucho… {dictado.interim}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (dictado.listening) dictado.stop();
          onSubmit();
        }}
        className="flex items-end gap-2"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (dictado.listening) dictado.stop();
              onSubmit();
            }
          }}
          rows={1}
          placeholder={disabled ? 'Conectando…' : 'Escribe tu mensaje…'}
          disabled={disabled || streaming}
          className="max-h-32 flex-1 resize-none rounded-xl border border-zinc-300 px-4 py-2.5 text-sm outline-none focus:border-zinc-900"
        />
        {puedeDictar && (
          <button
            type="button"
            onClick={dictado.toggle}
            disabled={disabled || streaming}
            aria-label={dictado.listening ? 'Dejar de dictar' : 'Dictar con el micrófono'}
            title={dictado.listening ? 'Dejar de dictar' : 'Dictar con el micrófono'}
            className={`rounded-xl p-2.5 ring-1 disabled:opacity-40 ${
              dictado.listening
                ? 'bg-red-600 text-white ring-red-600'
                : 'bg-white text-zinc-600 ring-zinc-300'
            }`}
          >
            <Mic className="h-5 w-5" />
          </button>
        )}
        <button
          type="submit"
          disabled={disabled || streaming || !draft.trim()}
          aria-label="Enviar"
          className="rounded-xl bg-zinc-900 p-2.5 text-white disabled:opacity-40"
        >
          {streaming ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </button>
      </form>
    </section>
  );
}
