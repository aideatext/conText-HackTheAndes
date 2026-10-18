/**
 * Smoke test de la interfaz con un navegador real (criterios 1, 2, 3 y 6 del SPEC).
 *   node scripts/smoke.mjs [url]
 */
import { chromium, devices } from 'playwright';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const fixture = (name) => fileURLToPath(new URL(`../.fixtures/${name}`, import.meta.url));
const shots = fileURLToPath(new URL('../.fixtures/shots/', import.meta.url));
mkdirSync(shots, { recursive: true });

const log = (ok, msg) => console.log(`${ok ? 'OK  ' : 'FALLA'} ${msg}`);
let failures = 0;
const check = (cond, msg) => {
  if (!cond) failures++;
  log(cond, msg);
};

const browser = await chromium.launch();

async function run(name, contextOptions, { mobile }) {
  const ctx = await browser.newContext(contextOptions);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => {
    failures++;
    console.log('FALLA error de JS:', e.message);
  });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  check(await page.getByRole('heading', { name: 'conText' }).isVisible(), `${name}: carga la pagina`);

  // 1. Material: subir la foto del cuaderno
  if (mobile) await page.getByRole('button', { name: 'Material' }).click();
  await page.locator('input[type=file]').first().setInputFiles(fixture('cuaderno.png'));
  await Promise.race([
    page.getByText(/ciclo del agua/i).first().waitFor({ timeout: 90_000 }),
    page
      .locator('.text-red-700')
      .first()
      .waitFor({ timeout: 90_000 })
      .then(async () => {
        throw new Error('el servidor rechazo el material: ' + (await page.locator('.text-red-700').first().innerText()));
      }),
  ]);
  log(true, `${name}: la foto produce un resumen`);

  if (mobile) await page.getByRole('button', { name: 'Grafo', exact: true }).click();
  const nodosMaterial = await page.locator('svg g g g').count();
  check(nodosMaterial > 0, `${name}: el grafo muestra ${nodosMaterial} nodos del material`);

  // 2. Tres turnos de chat: el grafo crece en cada uno
  const historial = [nodosMaterial];
  const turnos = [
    'Creo que en Lima no llueve porque la corriente de Humboldt enfria el mar y el agua no se evapora igual.',
    'Entonces la garua seria vapor que si subio pero no llego a formar gotas pesadas.',
  ];
  for (const texto of turnos) {
    if (mobile) await page.getByRole('button', { name: 'Conversación' }).click();
    const caja = page.getByPlaceholder('Escribe tu mensaje…');
    await caja.fill(texto);
    await caja.press('Enter');
    // En movil el grafo no esta montado mientras conversas: esperamos a que el
    // turno termine (la caja se vuelve a habilitar) y recien ahi contamos.
    await page.waitForTimeout(1000);
    await caja.waitFor({ state: 'visible' });
    await page.waitForFunction(() => {
      const t = document.querySelector('textarea');
      return t && !t.disabled;
    }, undefined, { timeout: 120_000 });
    if (mobile) await page.getByRole('button', { name: 'Grafo', exact: true }).click();
    await page.waitForTimeout(600);
    historial.push(await page.locator('svg g g g').count());
  }
  check(
    historial.every((n, i) => i === 0 || n > historial[i - 1]),
    `${name}: el grafo crece en cada turno (${historial.join(' -> ')} nodos)`,
  );

  // 3. "Mis conexiones" deja solo lo del estudiante
  if (mobile) await page.getByRole('button', { name: 'Grafo', exact: true }).click();
  await page.getByText('Mis conexiones').click();
  await page.waitForTimeout(900);
  const mios = await page.locator('svg g g g').count();
  check(
    mios > 0 && mios < historial[historial.length - 1],
    `${name}: "Mis conexiones" filtra a ${mios} de ${historial[historial.length - 1]} nodos`,
  );
  const colores = await page.locator('svg g g g path').evaluateAll((els) =>
    [...new Set(els.map((e) => e.getAttribute('stroke')))],
  );
  check(
    colores.length === 1 && colores[0] === '#2563eb',
    `${name}: los nodos filtrados son todos del estudiante (${colores.join(', ')})`,
  );
  await page.getByText('Mis conexiones').click();

  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${shots}${name}.png`, fullPage: false });

  // 4. Recargar: la sesion se recupera
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  if (mobile) await page.getByRole('button', { name: 'Conversación' }).click();
  const mensajes = await page.locator('.rounded-2xl').count();
  check(mensajes >= 4, `${name}: al recargar vuelven ${mensajes} mensajes`);
  if (mobile) await page.getByRole('button', { name: 'Grafo', exact: true }).click();
  await page.waitForTimeout(800);
  const nodosTrasRecarga = await page.locator('svg g g g').count();
  check(nodosTrasRecarga >= historial[historial.length - 1], `${name}: al recargar vuelve el grafo (${nodosTrasRecarga} nodos)`);

  await ctx.close();
}

if (!process.env.SOLO_MOVIL) await run('escritorio', { viewport: { width: 1440, height: 900 } }, { mobile: false });
await run('movil', { ...devices['Pixel 7'] }, { mobile: true });

await browser.close();
console.log(failures === 0 ? '\nTODO OK' : `\n${failures} FALLAS`);
process.exit(failures === 0 ? 0 : 1);
