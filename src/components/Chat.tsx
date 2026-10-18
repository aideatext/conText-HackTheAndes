import { useEffect, useRef } from 'react';
import { Loader2, Send } from 'lucide-react';
import type { ChatMessage } from '../../shared/types';

export default function Chat({
  messages,
  draft,
  setDraft,
  onSubmit,
  streaming,
  disabled,
  error,
}: {
  messages: ChatMessage[];
  draft: string;
  setDraft: (v: string) => void;
  onSubmit: () => void;
  streaming: boolean;
  disabled: boolean;
  error: string | null;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <h2 className="text-sm font-semibold text-zinc-700">Conversación</h2>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl bg-white p-4 ring-1 ring-zinc-200">
        {messages.length === 0 && (
          <div className="space-y-2 text-sm text-zinc-400">
            <p>Cuéntame qué estás estudiando y empezamos.</p>
            <p>Si subes una foto de tu cuaderno, conversamos sobre eso.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
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
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
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
              onSubmit();
            }
          }}
          rows={1}
          placeholder={disabled ? 'Conectando…' : 'Escribe tu mensaje…'}
          disabled={disabled || streaming}
          className="max-h-32 flex-1 resize-none rounded-xl border border-zinc-300 px-4 py-2.5 text-sm outline-none focus:border-zinc-900"
        />
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
