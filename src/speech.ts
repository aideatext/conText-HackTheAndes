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

/** Voz del sistema: el respaldo si Azure Speech no responde. */
function hablarConElNavegador(text: string, onEnd: () => void): boolean {
  if (!ttsSupported()) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'es-PE';
  const es = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith('es'));
  if (es) u.voice = es;
  u.onend = onEnd;
  u.onerror = onEnd;
  window.speechSynthesis.speak(u);
  return true;
}

/**
 * Lee la respuesta del tutor. Primero con la voz neuronal peruana de Azure
 * (servida por el servidor, sin claves); si no esta disponible, con la del navegador.
 */
export function useReadAloud() {
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Si Azure falla una vez, dejamos de intentarlo durante esta sesion.
  const azureCaido = useRef(false);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setSpeakingId(null);
  }, []);

  const speak = useCallback(
    async (id: number, text: string) => {
      const yaSonaba = speakingId === id;
      stop();
      if (yaSonaba || !text.trim()) return;

      setSpeakingId(id);

      if (!azureCaido.current) {
        try {
          const res = await fetch('/api/voz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
          });
          if (res.ok) {
            const url = URL.createObjectURL(await res.blob());
            const audio = new Audio(url);
            audioRef.current = audio;
            const limpiar = () => {
              URL.revokeObjectURL(url);
              setSpeakingId((actual) => (actual === id ? null : actual));
            };
            audio.onended = limpiar;
            audio.onerror = limpiar;
            await audio.play();
            return;
          }
          azureCaido.current = true;
        } catch {
          azureCaido.current = true;
        }
      }

      if (!hablarConElNavegador(text, () => setSpeakingId((a) => (a === id ? null : a)))) {
        setSpeakingId(null);
      }
    },
    [speakingId, stop],
  );

  useEffect(() => stop, [stop]);

  return { speakingId, speak, stop };
}
