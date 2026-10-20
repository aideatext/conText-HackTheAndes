/**
 * Mide los prompts del sistema contra el tokenizador real del modelo.
 * El caching solo entra si el prefijo supera el minimo (512 tokens en opus-5):
 * por debajo no cachea y no avisa.
 *   npx tsx scripts/medir.mjs
 */
import 'dotenv/config';
import { claude, MODEL } from '../server/claude.ts';
import { tutorSystem, EXTRACTOR_SYSTEM, MATERIAL_SYSTEM, extractorUserMessage } from '../server/prompts.ts';

const MINIMO = 512;

const resumenTipico =
  'La foto muestra la bandeja de la lectora de CD de una computadora de escritorio abierta, ' +
  'con un vaso de plastico apoyado encima como si fuera un portavasos. La bandeja fue disenada ' +
  'para sostener discos opticos, pero aqui cumple la funcion de soporte para una bebida.';

const casos = [
  ['tutor (sin material)', tutorSystem('')],
  ['tutor (con resumen)', tutorSystem(resumenTipico)],
  ['extractor', EXTRACTOR_SYSTEM],
  ['analizador de material', MATERIAL_SYSTEM],
];

console.log(`modelo: ${MODEL}   minimo cacheable: ${MINIMO} tokens\n`);

for (const [nombre, system] of casos) {
  const { input_tokens } = await claude.messages.countTokens({
    model: MODEL,
    system,
    messages: [{ role: 'user', content: 'hola' }],
  });
  const cachea = input_tokens >= MINIMO;
  console.log(
    `${cachea ? 'CACHEA  ' : 'no llega'} ${String(input_tokens).padStart(5)} tokens  ${nombre}`,
  );
}

// El turno completo del extractor, que es lo que de verdad se manda
const turnoLargo = extractorUserMessage(
  'Creo que en Lima no llueve porque la corriente de Humboldt enfria el mar y el agua no se evapora igual.',
  'Buena conexion: ligaste la temperatura del mar con la evaporacion. Ahora piensa en el paso siguiente del ciclo.',
  Array.from({ length: 12 }, (_, i) => ({ id: `idea-${i}`, label: `Idea numero ${i}` })),
);
const total = await claude.messages.countTokens({
  model: MODEL,
  system: EXTRACTOR_SYSTEM,
  messages: [{ role: 'user', content: turnoLargo }],
});
console.log(`\nturno completo del extractor (system + mensaje): ${total.input_tokens} tokens`);
