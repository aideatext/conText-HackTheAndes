/**
 * Lectura del material que sube el estudiante: imagen (vision), PDF (documento) o texto.
 * Devuelve un resumen para el tutor y los nodos origen=material.
 */
import { PDFDocument } from 'pdf-lib';
import { claude, MODEL, textOf } from './claude.js';
import { MATERIAL_SYSTEM } from './prompts.js';
import { materialSchema, normalizeDelta, parseJsonLoose } from './graph.js';
import { invitaAEscribir, MAX_CARACTERES_TEXTO, MAX_PAGINAS_PDF } from '../shared/limites.js';
import type { Graph, GraphDelta } from '../shared/types.js';
import type { Idioma } from '../shared/idioma.js';
import { MENSAJES } from './mensajes.js';

export const MAX_BYTES = 10 * 1024 * 1024;

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
const TEXT_TYPES = ['text/plain', 'text/markdown', 'text/x-markdown'];

export type ContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'image';
      source: { type: 'base64'; media_type: (typeof IMAGE_TYPES)[number]; data: string };
    }
  | {
      type: 'document';
      source: { type: 'base64'; media_type: 'application/pdf'; data: string };
    };

export class UnsupportedMaterial extends Error {
  status = 415;
  /** Distingue "no cabe en la prueba" de "no se que es esto": se miden distinto. */
  constructor(
    message: string,
    readonly tope: 'caracteres' | 'paginas' | null = null,
  ) {
    super(message);
  }
}

/** Para medir con que material viene la gente, sin guardar el archivo ni su nombre. */
export function tipoDeMaterial(mimetype: string): 'foto' | 'pdf' | 'texto' | 'otro' {
  const mime = (mimetype || '').split(';')[0].trim().toLowerCase();
  if ((IMAGE_TYPES as readonly string[]).includes(mime)) return 'foto';
  if (mime === 'application/pdf') return 'pdf';
  if (TEXT_TYPES.includes(mime)) return 'texto';
  return 'otro';
}

/**
 * De un PDF no sabemos los caracteres sin extraerlo entero, asi que el tope se
 * cuenta en paginas. Si el archivo no se deja leer aqui no se bloquea: ya pasa
 * por el tope de 10 MB, y quien decide si lo entiende es el modelo.
 */
async function verificarPaginas(buffer: Buffer, idioma: Idioma): Promise<void> {
  let paginas: number;
  try {
    const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
    paginas = pdf.getPageCount();
  } catch {
    return;
  }

  if (paginas > MAX_PAGINAS_PDF) {
    throw new UnsupportedMaterial(
      invitaAEscribir(MENSAJES[idioma].pdfLargo(paginas), idioma),
      'paginas',
    );
  }
}

/** Convierte el archivo subido en bloques de contenido para Claude. */
export async function toContentBlocks(
  file: {
    mimetype: string;
    buffer: Buffer;
    originalname: string;
  },
  idioma: Idioma = 'es',
): Promise<ContentBlock[]> {
  const m = MENSAJES[idioma];
  const mime = (file.mimetype || '').split(';')[0].trim().toLowerCase();
  const name = file.originalname.toLowerCase();

  if ((IMAGE_TYPES as readonly string[]).includes(mime)) {
    return [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mime as (typeof IMAGE_TYPES)[number],
          data: file.buffer.toString('base64'),
        },
      },
    ];
  }

  if (mime === 'application/pdf') {
    await verificarPaginas(file.buffer, idioma);
    return [
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: file.buffer.toString('base64') },
      },
    ];
  }

  if (TEXT_TYPES.includes(mime) || name.endsWith('.txt') || name.endsWith('.md')) {
    const text = file.buffer.toString('utf-8').trim();
    if (!text) throw new UnsupportedMaterial(m.textoVacio);
    // Antes se recortaba en silencio a 60.000 caracteres: el estudiante creia
    // que conText habia leido todo. Mejor decir que no cabe que fingir que si.
    if (text.length > MAX_CARACTERES_TEXTO) {
      throw new UnsupportedMaterial(
        invitaAEscribir(m.textoLargo(text.length), idioma),
        'caracteres',
      );
    }
    return [{ type: 'text', text }];
  }

  if (mime.startsWith('video/')) {
    throw new UnsupportedMaterial(m.sinVideo);
  }
  if (mime.startsWith('audio/')) {
    throw new UnsupportedMaterial(m.sinAudio);
  }
  throw new UnsupportedMaterial(m.tipoDesconocido);
}

export interface MaterialReading {
  summary: string;
  delta: GraphDelta;
}

export async function readMaterial(
  blocks: ContentBlock[],
  graph: Graph,
  turn: number,
  idioma: Idioma = 'es',
): Promise<MaterialReading> {
  // El idioma va aqui y no en el system: asi el system sigue igual para todos y se cachea.
  const content = [
    ...blocks,
    {
      type: 'text' as const,
      text:
        'Analiza este material y devuelve el JSON con summary, nodes y links. ' +
        `Escribe el summary y las etiquetas en ${idioma === 'en' ? 'INGLES' : 'espanol'}, aunque el material este en otro idioma.`,
    },
  ];

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await claude.messages.create({
        model: MODEL,
        max_tokens: 2000,
        // 1123 tokens fijos que hoy se pagan enteros en cada subida.
        system: [
          { type: 'text', text: MATERIAL_SYSTEM, cache_control: { type: 'ephemeral' } },
        ],
        messages: [{ role: 'user', content: content as any }],
      });

      const raw = parseJsonLoose(textOf(res.content as any));
      const parsed = materialSchema.safeParse(raw);
      if (!parsed.success) throw new Error('JSON del material invalido');

      const delta = normalizeDelta(parsed.data, graph, turn, { hasMaterial: true });
      // Todo lo que sale del archivo es material, pase lo que pase.
      for (const n of delta.nodes) n.origin = 'material';
      for (const l of delta.links) l.origin = 'material';

      return { summary: parsed.data.summary.trim(), delta };
    } catch (err) {
      lastError = err;
      console.warn(`[material] intento ${attempt + 1} fallido:`, (err as Error)?.message);
    }
  }
  throw lastError ?? new Error('No pude leer el material');
}
