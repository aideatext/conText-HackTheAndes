/**
 * Voz del tutor con Azure AI Speech (voz neuronal peruana), autenticado con
 * Entra ID / Managed Identity: tampoco aqui hay claves.
 *
 * Si el recurso no esta configurado o falla, el endpoint responde 503 y el
 * navegador cae solo a la voz del sistema: la demo nunca se queda muda.
 */
import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity';

const endpoint = process.env.AZURE_SPEECH_ENDPOINT?.trim().replace(/\/+$/, '');
const VOZ = process.env.AZURE_SPEECH_VOICE ?? 'es-PE-CamilaNeural';
const FORMATO = 'audio-24khz-48kbitrate-mono-mp3';

export const voiceEnabled = Boolean(endpoint);

const tokenProvider = endpoint
  ? getBearerTokenProvider(
      new DefaultAzureCredential({ processTimeoutInMs: 60_000 }),
      'https://cognitiveservices.azure.com/.default',
    )
  : null;

if (!endpoint) {
  console.log('[voz] sin AZURE_SPEECH_ENDPOINT: el navegador usara su propia voz');
}

/** Lo que entra al SSML es texto del modelo: hay que escaparlo. */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// El estudiante puede volver a tocar "escuchar": no re-sintetizamos lo mismo.
const cache = new Map<string, Buffer>();
const CACHE_MAX = 40;

export class VoiceUnavailable extends Error {}

export async function synthesize(texto: string): Promise<Buffer> {
  if (!endpoint || !tokenProvider) throw new VoiceUnavailable('Voz no configurada');

  const limpio = texto.trim().slice(0, 1200);
  if (!limpio) throw new VoiceUnavailable('Texto vacio');

  const clave = `${VOZ}|${limpio}`;
  const enCache = cache.get(clave);
  if (enCache) return enCache;

  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="es-PE">` +
    `<voice name="${VOZ}"><prosody rate="2%">${escapar(limpio)}</prosody></voice></speak>`;

  const res = await fetch(`${endpoint}/tts/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await tokenProvider()}`,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': FORMATO,
      'User-Agent': 'conText',
    },
    body: ssml,
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new VoiceUnavailable(`Speech respondio ${res.status}`);
  }

  const audio = Buffer.from(await res.arrayBuffer());
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(clave, audio);
  return audio;
}
