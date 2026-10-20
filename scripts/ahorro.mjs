/**
 * A/B del coste de entrada en una conversacion de 5 turnos, con y sin caching.
 * Convierte tokens a coste relativo: leer de cache cuesta 0,1x y escribir 1,25x.
 *   npx tsx scripts/ahorro.mjs
 */
import 'dotenv/config';
import { claude, MODEL } from '../server/claude.ts';
import { tutorSystem, EXTRACTOR_SYSTEM, extractorUserMessage } from '../server/prompts.ts';

const RESUMEN =
  'El material son apuntes sobre el ciclo del agua: el sol calienta el agua, se evapora, el vapor ' +
  'se condensa al subir donde hace frio, se forman nubes y cae la lluvia que vuelve a los rios. ' +
  'Al final la profesora pregunta por que casi no llueve en la costa de Lima.';

const TURNOS = [
  'Estoy viendo el ciclo del agua y no entiendo por que en Lima casi no llueve.',
  'Creo que es porque el mar esta frio por la corriente de Humboldt.',
  'Entonces la garua seria vapor que subio pero no llego a formar gotas pesadas.',
  'Y si el mar se calentara con el Nino, si llovria de verdad?',
  'Mi tia dice que en el 98 llovio en Piura como nunca. Sera por eso?',
];

/** Coste de entrada en "tokens equivalentes": cache leido 0,1x, escrito 1,25x. */
const coste = (us) =>
  (us.input_tokens ?? 0) +
  (us.cache_creation_input_tokens ?? 0) * 1.25 +
  (us.cache_read_input_tokens ?? 0) * 0.1;

async function conversacion(conCache) {
  const system = tutorSystem(RESUMEN);
  const historia = [];
  let entrada = 0;
  let salida = 0;

  for (const t of TURNOS) {
    historia.push({ role: 'user', content: t });

    const tutor = await claude.messages.create({
      model: MODEL,
      max_tokens: 400,
      system,
      ...(conCache ? { cache_control: { type: 'ephemeral' } } : {}),
      messages: historia,
    });
    const texto = tutor.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    historia.push({ role: 'assistant', content: texto });
    entrada += coste(tutor.usage);
    salida += tutor.usage.output_tokens ?? 0;

    // Y el extractor, que corre en cada turno
    const ext = await claude.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system: conCache
        ? [{ type: 'text', text: EXTRACTOR_SYSTEM, cache_control: { type: 'ephemeral' } }]
        : EXTRACTOR_SYSTEM,
      output_config: { effort: 'medium' },
      messages: [{ role: 'user', content: extractorUserMessage(t, texto, []) }],
    });
    entrada += coste(ext.usage);
    salida += ext.usage.output_tokens ?? 0;
  }

  return { entrada: Math.round(entrada), salida };
}

console.log('Conversacion de 5 turnos (tutor + extractor en cada turno)\n');

// El sin-cache va primero para que no se beneficie de entradas calientes
const sin = await conversacion(false);
console.log(`  sin caching:  entrada ${String(sin.entrada).padStart(6)} tok-eq   salida ${sin.salida}`);

const con = await conversacion(true);
console.log(`  con caching:  entrada ${String(con.entrada).padStart(6)} tok-eq   salida ${con.salida}`);

const ahorro = ((1 - con.entrada / sin.entrada) * 100).toFixed(1);
console.log(`\n  ahorro en tokens de entrada: ${ahorro}%`);
console.log('  (la salida no se cachea: ese gasto no cambia)');
