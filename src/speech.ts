/**
 * Voz en el navegador: dictado (Web Speech API) y lectura en voz alta
 * (speechSynthesis). No se sube ningun archivo de audio al servidor.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const dictationSupported = () => getRecognitionCtor() !== null;

/** Dictado en es-PE. Devuelve el texto final y el parcial mientras hablas. */
export function useDictation(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<SpeechRecognitionLike | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const stop = useCallback(() => {
    ref.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    setError(null);
    const rec = new Ctor();
    ref.current = rec;
    rec.lang = 'es-PE';
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e: any) => {
      let parcial = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) onTextRef.current(r[0].transcript.trim());
        else parcial += r[0].transcript;
      }
      setInterim(parcial);
    };
    rec.onerror = (e: any) => {
      setError(
        e?.error === 'not-allowed'
          ? 'No me diste permiso para usar el micrófono.'
          : 'No pude escucharte. Prueba otra vez o escribe tu mensaje.',
      );
      setListening(false);
    };
    rec.onend = () => {
      setInterim('');
      setListening(false);
    };

    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, []);

  useEffect(() => () => ref.current?.abort(), []);

  return { listening, interim, error, start, stop, toggle: () => (listening ? stop() : start()) };
}

export const ttsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Lee un texto en voz alta en español. */
export function useReadAloud() {
  const [speakingId, setSpeakingId] = useState<number | null>(null);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeakingId(null);
  }, []);

  const speak = useCallback(
    (id: number, text: string) => {
      if (!ttsSupported() || !text.trim()) return;
      window.speechSynthesis.cancel();
      if (speakingId === id) {
        setSpeakingId(null);
        return;
      }
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'es-PE';
      u.rate = 1;
      const es = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith('es'));
      if (es) u.voice = es;
      u.onend = () => setSpeakingId(null);
      u.onerror = () => setSpeakingId(null);
      setSpeakingId(id);
      window.speechSynthesis.speak(u);
    },
    [speakingId],
  );

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  return { speakingId, speak, stop };
}
