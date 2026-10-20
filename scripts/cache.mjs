/**
 * Comprueba que el caching entra de verdad. Un prefijo por debajo del minimo
 * no cachea y NO da error: solo deja cache_creation en 0. Esto lo detecta.
 *   npx tsx scripts/cache.mjs
 */
import 'dotenv/config';
import { claude, MODEL } from '../server/claude.ts';
import { EXTRACTOR_SYSTEM, MATERIAL_SYSTEM, tutorSystem, extractorUserMessage } from '../server/prompts.ts';

const u = (usage) => ({
  nuevo: usage.input_tokens ?? 0,
  escrito: usage.cache_creation_input_tokens ?? 0,
  leido: usage.cache_read_input_tokens ?? 0,
  salida: usage.output_tokens ?? 0,
});
const linea = (etiqueta, x) =>
  console.log(
    `  ${etiqueta.padEnd(26)} sin cache ${String(x.nuevo).padStart(5)}  ` +
      `escrito ${String(x.escrito).padStart(5)}  leido ${String(x.leido).padStart(5)}  ` +
      `salida ${String(x.salida).padStart(4)}`,
  );

// ── 1 · El extractor: system fijo, deberia leerse en la segunda llamada ──
console.log('\nEXTRACTOR (system fijo de 542 tokens)');
const mensaje = extractorUserMessage(
  'Creo que en Lima no llueve porque la corriente de Humboldt enfria el mar.',
  'Buena conexion. Segun tu apunte, hasta que parte del ciclo si llega el agua?',
  [{ id: 'ciclo-del-agua', label: 'Ciclo del agua' }],
);
const pedir = (txt) =>
  claude.messages.create({
    model: MODEL,
    max_tokens: 900,
    system: [{ type: 'text', text: EXTRACTOR_SYSTEM, cache_control: { type: 'ephemeral' } }],
    output_config: { effort: 'medium' },
    messages: [{ role: 'user', content: txt }],
  });

const e1 = u((await pedir(mensaje)).usage);
linea('1a llamada (escribe)', e1);
const e2 = u((await pedir(mensaje + '\nOtra cosa distinta al final.')).usage);
linea('2a llamada (lee)', e2);

// ── 2 · El material ──────────────────────────────────────────────────────
console.log('\nMATERIAL (system fijo de 1123 tokens)');
const pedirMat = (txt) =>
  claude.messages.create({
    model: MODEL,
    max_tokens: 600,
    system: [{ type: 'text', text: MATERIAL_SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: txt }],
  });
linea('1a llamada (escribe)', u((await pedirMat('Apuntes: el ciclo del agua.')).usage));
linea('2a llamada (lee)', u((await pedirMat('Apuntes: la independencia.')).usage));

// ── 3 · El tutor: la conversacion que crece ─────────────────────────────
console.log('\nTUTOR (system 445 tokens + conversacion que crece)');
const system = tutorSystem(
  'El material son apuntes sobre el ciclo del agua: el sol calienta el agua, se evapora, el vapor ' +
    'se condensa al subir, se forman nubes y cae la lluvia que vuelve a los rios.',
);
const historia = [];
const turnos = [
  'Estoy viendo el ciclo del agua y no entiendo por que en Lima casi no llueve.',
  'Creo que es porque el mar esta frio por la corriente de Humboldt.',
  'Entonces la garua seria vapor que subio pero no llego a formar gotas pesadas.',
  'Y si el mar se calentara con el Nino, si llovria de verdad?',
];
for (const [i, t] of turnos.entries()) {
  historia.push({ role: 'user', content: t });
  const res = await claude.messages.create({
    model: MODEL,
    max_tokens: 400,
    system,
    cache_control: { type: 'ephemeral' },
    messages: historia,
  });
  const texto = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  historia.push({ role: 'assistant', content: texto });
  linea(`turno ${i + 1}`, u(res.usage));
}

console.log(
  '\nLectura: "leido" > 0 significa que el cache entro. En el tutor debe crecer turno a turno.',
);
