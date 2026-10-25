/**
 * Los topes de la prueba abierta: extension del material y turnos por sesion.
 *   npx tsx scripts/limites.mjs [url]
 *
 * Con tsx y no con node porque lee los topes de shared/limites.ts, que es la
 * misma fuente que usan el servidor y el navegador: si manana cambian los
 * numeros, esta suite los sigue sola.
 *
 * Va por HTTP y no por navegador a proposito: los tres rechazos ocurren antes
 * de llamar al modelo, asi que la suite corre en segundos y no gasta tokens.
 * El unico caso que si llama al modelo es el control de que lo que cabe sigue
 * entrando.
 */
import { PDFDocument } from 'pdf-lib';
import { MAX_CARACTERES_TEXTO, MAX_PAGINAS_PDF, MAX_TURNOS } from '../shared/limites.ts';

const BASE = process.argv[2] ?? 'http://localhost:3000';

let fallos = 0;
const check = (ok, msg) => {
  if (!ok) fallos++;
  console.log(`${ok ? 'OK  ' : 'FALLA'} ${msg}`);
};

async function subir(sessionId, nombre, tipo, datos) {
  const form = new FormData();
  form.append('sessionId', sessionId);
  form.append('file', new Blob([datos], { type: tipo }), nombre);
  const res = await fetch(`${BASE}/api/material`, { method: 'POST', body: form });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

const nuevaSesion = async () =>
  (await (await fetch(`${BASE}/api/session`, { method: 'POST' })).json()).sessionId;

// 1 · Un texto mas largo que el tope se rechaza, y lo dice con su numero
{
  const id = await nuevaSesion();
  const largo = 'palabra '.repeat(Math.ceil((MAX_CARACTERES_TEXTO + 2000) / 8));
  const { status, body } = await subir(id, 'plan.txt', 'text/plain', largo);
  check(status === 415, `texto de ${largo.length} caracteres rechazado (${status})`);
  check(
    /caracteres/.test(body.error ?? '') && /first\.contact@aideatext\.ai/.test(body.error ?? ''),
    `el mensaje dice el tope y a quien escribir: "${body.error ?? ''}"`,
  );
}

// 2 · Un texto que cabe sigue entrando (este si llama al modelo)
{
  const id = await nuevaSesion();
  const texto =
    'El guano fue la principal fuente de ingresos del Peru en el siglo XIX. ' +
    'La riqueza no se convirtio en industria y el pais termino endeudado.';
  const { status } = await subir(id, 'apunte.txt', 'text/plain', texto);
  check(status === 200, `un texto corto sigue entrando (${status})`);
}

// 3 · Un PDF con mas paginas que el tope se rechaza
{
  const id = await nuevaSesion();
  const pdf = await PDFDocument.create();
  for (let i = 0; i <= MAX_PAGINAS_PDF; i++) pdf.addPage([595, 842]);
  const bytes = await pdf.save();
  const { status, body } = await subir(id, 'propuesta.pdf', 'application/pdf', bytes);
  check(status === 415, `PDF de ${MAX_PAGINAS_PDF + 1} paginas rechazado (${status})`);
  check(/paginas/.test(body.error ?? ''), `el mensaje habla de paginas: "${body.error ?? ''}"`);
}

// 4 · Un PDF que cabe pasa la verificacion de paginas
{
  const id = await nuevaSesion();
  const pdf = await PDFDocument.create();
  pdf.addPage([595, 842]);
  const bytes = await pdf.save();
  const { status, body } = await subir(id, 'corto.pdf', 'application/pdf', bytes);
  // Un PDF en blanco puede no dar grafo, pero nunca debe morir en el tope.
  check(status !== 415, `un PDF de 1 pagina no choca con el tope (${status})`);
  if (status === 415) console.log(`     -> ${body.error}`);
}

// 5 · Al llegar a los turnos del tope, /api/turn responde 403 y no abre el SSE
{
  const retomada = await fetch(`${BASE}/api/session/retomar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      version: 1,
      exportadaEl: new Date().toISOString(),
      messages: [],
      graph: { nodes: [], links: [] },
      summary: '',
      materialName: null,
      turns: MAX_TURNOS,
    }),
  });
  const { sessionId } = await retomada.json();

  const res = await fetch(`${BASE}/api/turn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, text: 'Una pregunta mas' }),
  });
  const body = await res.json().catch(() => ({}));
  check(res.status === 403, `con ${MAX_TURNOS} turnos gastados, el turno 21 se rechaza (${res.status})`);
  check(
    (res.headers.get('content-type') ?? '').includes('application/json'),
    'responde JSON, no un stream a medio abrir',
  );
  check(
    /first\.contact@aideatext\.ai/.test(body.error ?? ''),
    `el mensaje invita a escribir: "${body.error ?? ''}"`,
  );
}

console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo en verde');
process.exit(fallos ? 1 : 0);
