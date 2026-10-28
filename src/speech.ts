/**
 * Voz en el navegador: dictado (Web Speech API) y lectura en voz alta
 * (speechSynthesis). No se sube ningun archivo de audio al servidor.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { LOCALE, type Idioma } from '../shared/idioma';
import { idiomaActual, textos } from './i18n';

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

/** Dictado en el idioma de la interfaz. Devuelve el texto final y el parcial mientras hablas. */
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
    rec.lang = LOCALE[idiomaActual()];
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
      setError(e?.error === 'not-allowed' ? textos().voz.sinPermiso : textos().voz.noEscuche);
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

/**
 * En que idioma esta un texto, contando palabras frecuentes. El tutor contesta en
 * el idioma del estudiante, que no siempre es el de la interfaz: la respuesta
 * manda. Si no hay senal clara, se queda el de la interfaz.
 */
const FRECUENTES: Record<Idioma, Set<string>> = {
  en: new Set('the and you what is are of to do how why it this that your with for can'.split(' ')),
  es: new Set('el la que de y los las es por qué cómo tu un una con para puedes se'.split(' ')),
};
export function idiomaDelTexto(texto: string): Idioma {
  const palabras = texto.toLowerCase().match(/\p{L}+/gu) ?? [];
  let en = 0;
  let es = 0;
  for (const p of palabras) {
    if (FRECUENTES.en.has(p)) en++;
    if (FRECUENTES.es.has(p)) es++;
  }
  return en > es ? 'en' : es > en ? 'es' : idiomaActual();
}

/** Voz del sistema: el respaldo si Azure Speech no responde. */
function hablarConElNavegador(text: string, onEnd: () => void): boolean {
  if (!ttsSupported()) return false;
  window.speechSynthesis.cancel();
  const idioma = idiomaDelTexto(text);
  const u = new SpeechSynthesisUtterance(text);
  u.lang = LOCALE[idioma];
  const voz = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith(idioma));
  if (voz) u.voice = voz;
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

      if (!azureCaido.current && idiomaDelTexto(text) === 'es') {
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
