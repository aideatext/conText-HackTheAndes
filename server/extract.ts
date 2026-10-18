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

export async function extractDelta(
  graph: Graph,
  studentText: string,
  tutorText: string,
  turn: number,
  hasMaterial: boolean,
): Promise<GraphDelta> {
  // Solo las etiquetas e ids: el extractor no necesita el grafo completo.
  const existing = graph.nodes.map((n) => ({ id: n.id, label: n.label }));
  const userMessage = extractorUserMessage(studentText, tutorText, existing);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await claude.messages.create({
        model: MODEL,
        max_tokens: 1200,
        system: EXTRACTOR_SYSTEM,
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
