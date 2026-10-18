import { useEffect, useRef, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import type { ChatMessage, SessionSnapshot } from '../shared/types';
import { resumeOrCreateSession, sendTurn } from './api';

export default function App() {
  const [session, setSession] = useState<SessionSnapshot | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    resumeOrCreateSession()
      .then((snap) => {
        setSession(snap);
        setMessages(snap.messages);
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !session || streaming) return;

    setDraft('');
    setError(null);
    setStreaming(true);
    setMessages((m) => [...m, { role: 'user', content: text }, { role: 'assistant', content: '' }]);

    await sendTurn(session.sessionId, text, {
      onToken: (chunk) =>
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = {
            role: 'assistant',
            content: copy[copy.length - 1].content + chunk,
          };
          return copy;
        }),
      onError: (message) => setError(message),
      onDone: () => setStreaming(false),
    });
    setStreaming(false);
  }

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col p-4">
      <header className="pb-3">
        <h1 className="text-xl font-bold">conText</h1>
        <p className="text-sm text-zinc-500">
          Conversa sobre tu material. El tutor no hace la tarea: te ayuda a pensarla.
        </p>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto rounded-xl bg-white p-4 ring-1 ring-zinc-200">
        {messages.length === 0 && (
          <p className="text-sm text-zinc-400">
            Escribe lo que estas estudiando y empecemos.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === 'user'
                ? 'ml-auto max-w-[85%] rounded-2xl bg-zinc-900 px-4 py-2 text-sm text-white'
                : 'mr-auto max-w-[85%] rounded-2xl bg-zinc-100 px-4 py-2 text-sm whitespace-pre-wrap'
            }
          >
            {m.content || (streaming && i === messages.length - 1 ? '…' : '')}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {error && <p className="pt-2 text-sm text-red-600">{error}</p>}

      <form onSubmit={submit} className="flex gap-2 pt-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={session ? 'Escribe tu mensaje…' : 'Conectando…'}
          disabled={!session || streaming}
          className="flex-1 rounded-xl border border-zinc-300 px-4 py-2 text-sm outline-none focus:border-zinc-900"
        />
        <button
          type="submit"
          disabled={!session || streaming || !draft.trim()}
          className="rounded-xl bg-zinc-900 px-4 py-2 text-white disabled:opacity-40"
        >
          {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}
