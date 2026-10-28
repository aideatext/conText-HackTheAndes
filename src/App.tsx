import { useEffect, useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import type { ChatMessage, Graph, GraphDelta, Metrics, SessionSnapshot } from '../shared/types';
import {
  borrarSesion,
  createSession,
  getStats,
  resumeOrCreateSession,
  retomarSesion,
  sendTurn,
  uploadMaterial,
  type SesionExportada,
  type Stats,
} from './api';
import { exportarPdf } from './export';
import Chat from './components/Chat';
import { AvisoNvidia, Marca } from './components/Marca';
import MiSesion from './components/MiSesion';
import GraphPanel from './components/GraphPanel';
import MaterialPanel from './components/MaterialPanel';
import SelectorIdioma from './components/SelectorIdioma';
import { useT } from './i18n';

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
  const tx = useT();
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
  const svgRef = useRef<SVGSVGElement>(null);
  const [exportando, setExportando] = useState(false);
  const [sesionOcupada, setSesionOcupada] = useState(false);

  // El material cuenta: aunque no deje nodos en el grafo, es un archivo en el servidor.
  const hayAlgo = messages.length > 0 || graph.nodes.length > 0 || Boolean(materialName);

  function cargarSnapshot(snap: SessionSnapshot) {
    setSession(snap);
    setMessages(snap.messages);
    setGraph(snap.graph);
    setMetrics(snap.metrics);
    setSummary(snap.summary);
    setMaterialName(snap.materialName);
    setMaterialUrl(snap.materialUrl);
    setMaterialMime(snap.materialMime);
  }

  /** Se lleva la sesion entera en JSON para poder retomarla. */
  function guardarSesion() {
    const datos: SesionExportada = {
      version: 1,
      exportadaEl: new Date().toISOString(),
      messages,
      graph,
      summary,
      materialName,
      turns: metrics.turnos,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = tx.archivoSesion;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function retomar(archivo: File) {
    setSesionOcupada(true);
    setChatError(null);
    try {
      const snap = await retomarSesion(JSON.parse(await archivo.text()));
      cargarSnapshot(snap);
      // El archivo original no viaja en el JSON: se avisa en vez de fingir.
      setMaterialUrl(null);
      setMaterialMime(null);
    } catch (e: any) {
      setChatError(e?.message ?? tx.errores.noEsSesion);
    } finally {
      setSesionOcupada(false);
    }
  }

  async function borrarTodo() {
    if (!session) return;
    setSesionOcupada(true);
    try {
      await borrarSesion(session.sessionId);
      cargarSnapshot(await createSession());
      setChatError(null);
    } catch {
      setChatError(tx.errores.noBorre);
    } finally {
      setSesionOcupada(false);
    }
  }

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
      .catch((e) => setChatError(e?.message ?? tx.errores.sinServidor));
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
      setChatError(tx.errores.conexionCortada);
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
      setMaterialError(e?.message ?? tx.errores.noLeiArchivo);
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
      extra={
        <MiSesion
          onGuardar={guardarSesion}
          onRetomar={retomar}
          onBorrar={borrarTodo}
          ocupado={sesionOcupada}
          hayAlgo={hayAlgo}
        />
      }
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
      turnos={metrics.turnos}
      material={
        // En escritorio el material ya esta a la vista en su columna.
        !isDesktop && materialUrl
          ? { url: materialUrl, mime: materialMime, nombre: materialName }
          : null
      }
    />
  );
  const grafo = <GraphPanel graph={graph} metrics={metrics} svgRef={svgRef} />;

  async function descargarResumen() {
    setExportando(true);
    try {
      await exportarPdf({
        graph,
        metrics,
        messages,
        summary,
        materialName,
        materialUrl,
        materialMime,
        svg: svgRef.current,
      });
    } catch (e: any) {
      setChatError(tx.errores.noPdf);
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-borde bg-papel px-4 py-3">
        <Marca />
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <span className="hidden text-xs text-tinta-suave xl:block">
            Claude Opus 5
          </span>
          <SelectorIdioma />
          <button
            onClick={descargarResumen}
            disabled={exportando || (graph.nodes.length === 0 && messages.length === 0)}
            className="flex shrink-0 items-center gap-1.5 rounded-medio bg-azul px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-azul-hondo disabled:opacity-40"
          >
            {exportando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {/* En un telefono el rotulo no cabe al lado de la marca: queda el icono. */}
            <span className="hidden sm:inline">{tx.cabecera.resumen}</span>
            <span className="sr-only sm:hidden">{tx.cabecera.resumen}</span>
          </button>
        </div>
      </header>

      {!isDesktop && (
        <nav className="flex border-b border-borde bg-papel">
          {(['material', 'chat', 'grafo'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-medium ${
                tab === t ? 'border-b-2 border-azul text-tinta' : 'text-tinta-suave'
              }`}
            >
              {tx.pestanas[t]}
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

      <footer className="border-t border-borde bg-panel px-4 py-2.5">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-[11px] text-tinta-suave">
          <span>{tx.pie.queNoHace}</span>
          {stats && stats.sesionesConTurnos > 0 && (
            <span className="text-tinta-suave/80">
              {tx.pie.contador(stats.sesionesConTurnos, stats.turnos, stats.nodos)}
            </span>
          )}
          {/* Lo que pasa con los datos lo dice MiSesion; el pie lleva lo que no cabe ahi: a quien escribir. */}
          <span className="text-tinta-suave/80">
            · {tx.pie.consulta}{' '}
            <a href={`mailto:${tx.contacto}`} className="font-medium text-azul hover:underline">
              {tx.contacto}
            </a>
          </span>
        </div>
        <div className="mt-1.5 flex items-center justify-center gap-2">
          <img
            src="/img/nvidia-inception-color.svg"
            width={500}
            height={216}
            alt="NVIDIA Inception"
            className="h-7 w-auto sm:hidden"
          />
        </div>
        <div className="mt-1.5 text-center">
          <AvisoNvidia />
        </div>
      </footer>
    </div>
  );
}
