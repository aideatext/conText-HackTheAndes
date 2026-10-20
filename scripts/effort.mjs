/**
 * Compara niveles de effort en el extractor sobre turnos fijos.
 * Mide latencia, tokens de salida y que tan bien sale el grafo.
 *   npx tsx scripts/effort.mjs
 */
import 'dotenv/config';
import { claude, MODEL, textOf } from '../server/claude.ts';
import { EXTRACTOR_SYSTEM, extractorUserMessage } from '../server/prompts.ts';
import { normalizeDelta, parseJsonLoose } from '../server/graph.ts';

const TURNOS = [
  {
    nombre: 'ciclo del agua',
    estudiante:
      'Creo que en Lima no llueve porque la corriente de Humboldt enfria el mar y el agua no se evapora igual.',
    tutor:
      'Buena conexion: ligaste la temperatura del mar con la evaporacion. Pero Lima vive nublada casi todo el invierno. Segun los pasos de tu apunte, hasta que parte del ciclo si estaria llegando el agua?',
    existentes: [
      { id: 'ciclo-del-agua', label: 'Ciclo del agua' },
      { id: 'evaporacion', label: 'Evaporacion' },
      { id: 'condensacion', label: 'Condensacion del vapor' },
    ],
  },
  {
    nombre: 'guerra del pacifico',
    estudiante:
      'Pero mi abuelo dice que tambien influyo que Peru no tenia dinero despues de la crisis del guano.',
    tutor:
      'Ese dato cambia el cuadro. Si no habia dinero, que cosas concretas no se podian hacer? Piensa en lo que un barco necesita.',
    existentes: [
      { id: 'guerra-del-pacifico', label: 'Guerra del Pacifico' },
      { id: 'control-del-mar', label: 'Control del mar' },
    ],
  },
  {
    nombre: 'vaso en la bandeja',
    estudiante: 'Esa foto la tome en la cabina de internet de mi barrio. Todos ponen el vaso ahi.',
    tutor:
      'Buena observacion. Que todos lo hagan ya dice algo. Por que crees que la gente eligio la bandeja y no otro lugar de la mesa?',
    existentes: [
      { id: 'bandeja-de-cd', label: 'Bandeja de CD' },
      { id: 'uso-distinto-al-previsto', label: 'Uso distinto al previsto' },
    ],
  },
];

const NIVELES = ['low', 'medium', 'high'];
const VUELTAS = 2;

const resultados = {};

for (const effort of NIVELES) {
  const filas = [];
  for (const t of TURNOS) {
    for (let v = 0; v < VUELTAS; v++) {
      const grafo = {
        nodes: t.existentes.map((n) => ({
          ...n,
          type: 'concepto',
          origin: 'material',
          turn: 0,
        })),
        links: [],
      };
      const mensaje = extractorUserMessage(t.estudiante, t.tutor, t.existentes);

      const t0 = Date.now();
      let delta = { nodes: [], links: [] };
      let salida = 0;
      let fallo = false;
      try {
        const res = await claude.messages.create({
          model: MODEL,
          max_tokens: 1200,
          system: EXTRACTOR_SYSTEM,
          output_config: { effort },
          messages: [{ role: 'user', content: mensaje }],
        });
        salida = res.usage.output_tokens;
        delta = normalizeDelta(parseJsonLoose(textOf(res.content)), grafo, 1, { hasMaterial: true });
      } catch (e) {
        fallo = true;
        console.log(`   fallo en ${effort}/${t.nombre}: ${String(e.message).slice(0, 90)}`);
      }
      const ms = Date.now() - t0;

      // Reutilizar un id existente es senal de que entendio el contexto
      const reusa = delta.links.some((l) =>
        t.existentes.some((e) => e.id === l.source || e.id === l.target),
      );
      filas.push({
        caso: t.nombre,
        ms,
        salida,
        nodos: delta.nodes.length,
        enlaces: delta.links.length,
        reusa,
        fallo,
      });
    }
  }
  resultados[effort] = filas;

  const n = filas.length;
  const media = (f) => Math.round(filas.reduce((a, x) => a + f(x), 0) / n);
  const conReuso = filas.filter((f) => f.reusa).length;
  const vacios = filas.filter((f) => f.nodos === 0).length;
  console.log(
    `effort=${effort.padEnd(6)} ` +
      `${String(media((f) => f.ms)).padStart(6)} ms  ` +
      `${String(media((f) => f.salida)).padStart(4)} tok salida  ` +
      `${media((f) => f.nodos)} nodos  ${media((f) => f.enlaces)} enlaces  ` +
      `reusa ids ${conReuso}/${n}  vacios ${vacios}`,
  );
}

console.log('\ndetalle por caso:');
for (const effort of NIVELES) {
  for (const f of resultados[effort]) {
    console.log(
      `  ${effort.padEnd(6)} ${f.caso.padEnd(22)} ${String(f.ms).padStart(6)}ms  ` +
        `${f.nodos}n/${f.enlaces}e  ${f.reusa ? 'reusa' : '     '}  ${f.fallo ? 'FALLO' : ''}`,
    );
  }
}
