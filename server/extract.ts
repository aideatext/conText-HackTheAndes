/**
 * Extractor del grafo: a partir del turno del estudiante y la respuesta del tutor,
 * pide a Claude un JSON con los nodos y enlaces nuevos.
 *
 * Nunca lanza: si el JSON falla dos veces, devuelve un delta vacio y la conversacion sigue.
 */
import { claude, MODEL, textOf } from './claude.js';
import { EXTRACTOR_SYSTEM, extractorUserMessage } from './prompts.js';
import { normalizeDelta, parseJsonLoose } from './graph.js';
import type { Graph, GraphDelta } from '../shared/types.js';
import type { Idioma } from '../shared/idioma.js';

export async function extractDelta(
  graph: Graph,
  studentText: string,
  tutorText: string,
  turn: number,
  hasMaterial: boolean,
  idioma: Idioma = 'es',
): Promise<GraphDelta> {
  // Solo las etiquetas e ids: el extractor no necesita el grafo completo.
  const existing = graph.nodes.map((n) => ({ id: n.id, label: n.label }));
  // El grafo es parte de la interfaz: va en su idioma, como el resumen del material.
  const userMessage = extractorUserMessage(studentText, tutorText, existing, idioma);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await claude.messages.create({
        model: MODEL,
        max_tokens: 1200,
        // El system del extractor es fijo (542 tokens, por encima del minimo de
        // 512): se cachea una vez y lo reusan todos los turnos de todas las
        // sesiones mientras siga caliente.
        system: [
          { type: 'text', text: EXTRACTOR_SYSTEM, cache_control: { type: 'ephemeral' } },
        ],
        // Medido sobre turnos reales: medium da el mismo grafo que high, y low
        // extraia una idea menos en uno de cada tres casos.
        output_config: { effort: 'medium' },
        messages: [{ role: 'user', content: userMessage }],
      });

      // Puede venir con bloques `thinking` o envuelto en ```json: parseJsonLoose lo tolera.
      return normalizeDelta(parseJsonLoose(textOf(res.content as any)), graph, turn, {
        hasMaterial,
      });
    } catch (err) {
      console.warn(`[extract] intento ${attempt + 1} fallido:`, (err as Error)?.message);
    }
  }

  return { nodes: [], links: [] };
}
