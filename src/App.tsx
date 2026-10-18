import { useEffect, useState } from 'react';
import type { ChatMessage, Graph, GraphDelta, Metrics, SessionSnapshot } from '../shared/types';
import { getStats, resumeOrCreateSession, sendTurn, uploadMaterial, type Stats } from './api';
import Chat from './components/Chat';
import GraphPanel from './components/GraphPanel';
import MaterialPanel from './components/MaterialPanel';

const EMPTY_METRICS: Metrics = {
  ideasEstudiante: 0,
  nodosTotales: 0,
  enlacesTotales: 0,
  ideaMasCentral: null,
  porcentajeAislados: 0,
  turnos: 0,
};

type Tab = 'material' | 'chat' | 'grafo';

/** Solo montamos un arbol (3 columnas o pestanas): el grafo D3 no debe existir dos veces. */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isDesktop;
}

export default function App() {
  const [session, setSession] = useState<SessionSnapshot | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [graph, setGraph] = useState<Graph>({ nodes: [], links: [] });
  const [metrics, setMetrics] = useState<Metrics>(EMPTY_METRICS);
  const [summary, setSummary] = useState('');
  const [materialName, setMaterialName] = useState<string | null>(null);
  const [materialUrl, setMaterialUrl] = useState<string | null>(null);
  const [materialMime, setMaterialMime] = useState<string | null>(null);

  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [materialBusy, setMaterialBusy] = useState(false);
  const [materialError, setMaterialError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('chat');
  const [stats, setStats] = useState<Stats | null>(null);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    resumeOrCreateSession()
      .then((snap) => {
        setSession(snap);
        setMessages(snap.messages);
        setGraph(snap.graph);
        setMetrics(snap.metrics);
        setSummary(snap.summary);
        setMaterialName(snap.materialName);
        setMaterialUrl(snap.materialUrl);
        setMaterialMime(snap.materialMime);
      })
      .catch((e) => setChatError(e?.message ?? 'No pude conectar con el servidor.'));
  }, []);

  // Contador publico de uso: se refresca al cargar y al cerrar cada turno.
  useEffect(() => {
    getStats().then(setStats).catch(() => {});
  }, [metrics.turnos]);

  function applyDelta(delta: GraphDelta) {
    setGraph((g) => {
      const ids = new Set(g.nodes.map((n) => n.id));
      const keys = new Set(g.links.map((l) => `${l.source}|${l.target}|${l.relation}`));
      return {
        nodes: [...g.nodes, ...delta.nodes.filter((n) => !ids.has(n.id))],
        links: [
          ...g.links,
          ...delta.links.filter((l) => !keys.has(`${l.source}|${l.target}|${l.relation}`)),
        ],
      };
    });
  }

  async function submit() {
    const text = draft.trim();
    if (!text || !session || streaming) return;

    setDraft('');
    setChatError(null);
    setStreaming(true);
    setMessages((m) => [...m, { role: 'user', content: text }, { role: 'assistant', content: '' }]);

    try {
      await sendTurn(session.sessionId, text, {
        onToken: (chunk) =>
          setMessages((m) => {
            const copy = [...m];
            const last = copy[copy.length - 1];
            copy[copy.length - 1] = { role: 'assistant', content: last.content + chunk };
            return copy;
          }),
        onGraphDelta: applyDelta,
        onMetrics: setMetrics,
        onError: (message) => setChatError(message),
      });
    } catch {
      setChatError('Se corto la conexion. Intenta de nuevo.');
    } finally {
      setStreaming(false);
    }
  }

  async function pickMaterial(file: File) {
    if (!session) return;
    setMaterialError(null);
    setMaterialBusy(true);
    try {
      const res = await uploadMaterial(session.sessionId, file);
      setSummary(res.summary);
      setMaterialName(res.materialName);
      // Marca de tiempo: si el estudiante cambia de material, el navegador no reusa la cache.
      setMaterialUrl(`${res.materialUrl}?v=${Date.now()}`);
      setMaterialMime(res.materialMime);
      applyDelta(res.graph_delta);
      setMetrics(res.metrics);
    } catch (e: any) {
      setMaterialError(e?.message ?? 'No pude leer ese archivo.');
    } finally {
      setMaterialBusy(false);
    }
  }

  const material = (
    <MaterialPanel
      summary={summary}
      materialName={materialName}
      materialUrl={materialUrl}
      materialMime={materialMime}
      busy={materialBusy}
      error={materialError}
      onPick={pickMaterial}
      onStartChat={isDesktop ? undefined : () => setTab('chat')}
    />
  );
  const chat = (
    <Chat
      messages={messages}
      draft={draft}
      setDraft={setDraft}
      onSubmit={submit}
      streaming={streaming}
      disabled={!session}
      error={chatError}
      material={
        // En escritorio el material ya esta a la vista en su columna.
        !isDesktop && materialUrl
          ? { url: materialUrl, mime: materialMime, nombre: materialName }
          : null
      }
    />
  );
  const grafo = <GraphPanel graph={graph} metrics={metrics} />;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3">
        <div>
          <h1 className="text-lg leading-tight font-bold tracking-tight">conText</h1>
          <p className="text-xs text-zinc-500">
            Piensa tus ideas en voz alta y míralas conectarse.
          </p>
        </div>
        <span className="hidden text-xs text-zinc-400 sm:block">
          Hack the Andes · Claude en Azure AI Foundry
        </span>
      </header>

      {!isDesktop && (
        <nav className="flex border-b border-zinc-200 bg-white">
          {(['material', 'chat', 'grafo'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-medium ${
                tab === t ? 'border-b-2 border-zinc-900 text-zinc-900' : 'text-zinc-400'
              }`}
            >
              {t === 'chat' ? 'Conversación' : t === 'grafo' ? 'Grafo' : 'Material'}
            </button>
          ))}
        </nav>
      )}

      <main className="min-h-0 flex-1 p-4">
        {isDesktop ? (
          <div className="grid h-full gap-4 grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.4fr)]">
            {material}
            {chat}
            {grafo}
          </div>
        ) : (
          <div className="h-full">
            {tab === 'material' ? material : tab === 'chat' ? chat : grafo}
          </div>
        )}
      </main>

      <footer className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-zinc-200 bg-white px-4 py-2 text-center text-[11px] text-zinc-500">
        <span>
          Qué <strong>no</strong> hace conText: no te califica y no redacta por ti.
        </span>
        {stats && stats.sesionesConTurnos > 0 && (
          <span className="text-zinc-400">
            · {stats.sesionesConTurnos} estudiantes ya conversaron aquí, {stats.turnos} veces, y
            conectaron {stats.nodos} ideas.
          </span>
        )}
      </footer>
    </div>
  );
}
