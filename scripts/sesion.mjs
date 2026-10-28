/**
 * Prueba el ciclo de vida de la sesion: guardar el JSON, borrar todo y retomar.
 *   node scripts/sesion.mjs [url]
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const salida = fileURLToPath(new URL('../.fixtures/shots/', import.meta.url));
mkdirSync(salida, { recursive: true });

let fallos = 0;
const check = (ok, msg) => {
  if (!ok) fallos++;
  console.log(`${ok ? 'OK  ' : 'FALLA'} ${msg}`);
};

const browser = await chromium.launch();
// La interfaz sigue el idioma del navegador: la suite busca textos en espanol.
const ctx = await browser.newContext({
  locale: 'es-PE',
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
});
const page = await ctx.newPage();
page.on('pageerror', (e) => {
  fallos++;
  console.log('FALLA error de JS:', e.message);
});

await page.goto(BASE, { waitUntil: 'networkidle' });

// Una conversacion con algo dentro
const caja = page.getByPlaceholder('Escribe tu mensaje…');
await caja.fill('Estoy estudiando por qué el guano fue tan importante para el Perú del siglo XIX.');
await caja.press('Enter');
await page.waitForFunction(() => {
  const t = document.querySelector('textarea');
  return t && !t.disabled;
}, undefined, { timeout: 120_000 });
await page.waitForTimeout(1500);

const nodosAntes = await page.locator('svg g g g').count();
const mensajesAntes = await page.locator('[data-mensaje]').count();
check(nodosAntes > 0 && mensajesAntes >= 2, `hay sesión: ${mensajesAntes} mensajes y ${nodosAntes} nodos`);

// 1 · Guardar sesión
const descarga = page.waitForEvent('download', { timeout: 60_000 });
await page.getByRole('button', { name: 'Guardar sesión' }).click();
const file = await descarga;
const ruta = `${salida}mi-sesion-context.json`;
await file.saveAs(ruta);
const datos = JSON.parse(readFileSync(ruta, 'utf-8'));
check(
  datos.version === 1 && datos.messages.length >= 2 && datos.graph.nodes.length > 0,
  `el JSON lleva ${datos.messages.length} mensajes y ${datos.graph.nodes.length} nodos`,
);

// 2 · Borrar todo
await page.getByRole('button', { name: 'Borrar todo' }).click();
await page.getByRole('button', { name: 'Sí, borrar todo' }).click();
await page.waitForTimeout(3000);
check((await page.locator('[data-mensaje]').count()) === 0, 'tras borrar no quedan mensajes');
check((await page.locator('svg g g g').count()) === 0, 'tras borrar no quedan nodos');

// La sesión vieja ya no existe en el servidor
const viejo = await page.evaluate(async (id) => (await fetch(`/api/session/${id}`)).status, datos.sessionId ?? 'x');
check(viejo === 404, `el servidor ya no tiene la sesión vieja (HTTP ${viejo})`);

// 3 · Retomar desde el JSON
await page.locator('input[accept*="json"]').setInputFiles(ruta);
await page.waitForTimeout(4000);
const mensajesDespues = await page.locator('[data-mensaje]').count();
const nodosDespues = await page.locator('svg g g g').count();
check(mensajesDespues === mensajesAntes, `al retomar vuelven los ${mensajesDespues} mensajes`);
check(nodosDespues === nodosAntes, `al retomar vuelve el grafo (${nodosDespues} de ${nodosAntes} nodos)`);

// Y la conversación sigue viva sobre lo retomado
await caja.fill('¿Y qué pasó cuando el guano se acabó?');
await caja.press('Enter');
await page.waitForFunction(() => {
  const t = document.querySelector('textarea');
  return t && !t.disabled;
}, undefined, { timeout: 120_000 });
await page.waitForTimeout(1500);
check(
  (await page.locator('svg g g g').count()) > nodosDespues,
  'se puede seguir conversando sobre la sesión retomada',
);

await page.screenshot({ path: `${salida}sesion.png` });
await browser.close();
console.log(fallos === 0 ? '\nTODO OK' : `\n${fallos} FALLAS`);
process.exit(fallos === 0 ? 0 : 1);
