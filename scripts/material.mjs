/**
 * Prueba que el material subido sigue visible durante toda la conversacion
 * y despues de recargar: imagen tal cual, PDF con su primera pagina dibujada.
 *   node scripts/material.mjs [url]
 */
import { chromium, devices } from 'playwright';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const shots = fileURLToPath(new URL('../.fixtures/shots/', import.meta.url));
mkdirSync(shots, { recursive: true });

let fallos = 0;
const check = (ok, msg) => {
  if (!ok) fallos++;
  console.log(`${ok ? 'OK  ' : 'FALLA'} ${msg}`);
};

const browser = await chromium.launch();

async function probar(nombre, archivo, contextOptions, { movil }) {
  // La interfaz sigue el idioma del navegador: la suite busca textos en espanol.
  const ctx = await browser.newContext({ locale: 'es-PE', ...contextOptions });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => {
    fallos++;
    console.log('FALLA error de JS:', e.message);
  });
  await page.goto(BASE, { waitUntil: 'networkidle' });

  if (movil) await page.getByRole('button', { name: 'Material' }).click();
  await page.locator('input[type=file]').first().setInputFiles(archivo);

  const esPdf = archivo.endsWith('.pdf');
  const vista = esPdf ? page.locator('canvas') : page.locator('img[alt^="Material"]');
  await vista.first().waitFor({ state: 'visible', timeout: 120_000 });
  await page.waitForTimeout(2500);

  const dibujado = await vista.first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
  check(dibujado.w > 50 && dibujado.h > 50, `${nombre}: el material se ve (${dibujado.w}x${dibujado.h})`);

  // Conversar y comprobar que el material sigue ahi
  if (movil) await page.getByRole('button', { name: 'Conversación' }).click();
  const caja = page.getByPlaceholder('Escribe tu mensaje…');
  await caja.fill('¿Qué te llama la atención de esto?');
  await caja.press('Enter');
  await page.waitForFunction(() => {
    const t = document.querySelector('textarea');
    return t && !t.disabled;
  }, undefined, { timeout: 120_000 });

  if (movil) {
    // En movil el material queda plegado sobre la conversacion: lo abrimos.
    await page.getByRole('button', { expanded: false }).first().click();
    await page.waitForTimeout(2000);
  }
  const sigue = esPdf ? page.locator('canvas') : page.locator('img[alt^="Material"]');
  check(await sigue.first().isVisible(), `${nombre}: sigue visible durante la conversación`);

  // Recargar: el material viene del servidor, no del archivo local
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  if (movil) await page.getByRole('button', { name: 'Material' }).click();
  const trasRecarga = esPdf ? page.locator('canvas') : page.locator('img[alt^="Material"]');
  await trasRecarga.first().waitFor({ state: 'visible', timeout: 60_000 });
  await page.waitForTimeout(2500);
  const dib2 = await trasRecarga.first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
  check(dib2.w > 50 && dib2.h > 50, `${nombre}: sobrevive a recargar (${dib2.w}x${dib2.h})`);

  await page.screenshot({ path: `${shots}material-${nombre}.png` });
  await ctx.close();
}

const fx = (n) => fileURLToPath(new URL(`../.fixtures/${n}`, import.meta.url));
const vaso =
  'C:/Users/Usuario/Documents/Hackathon_Hack-The-Andes/assets/image/test_img-1-vaso_computadora.png';

await probar('imagen-escritorio', vaso, { viewport: { width: 1440, height: 900 } }, { movil: false });
await probar('pdf-escritorio', fx('papa.pdf'), { viewport: { width: 1440, height: 900 } }, { movil: false });
await probar('imagen-movil', vaso, { ...devices['Pixel 7'] }, { movil: true });

await browser.close();
console.log(fallos === 0 ? '\nTODO OK' : `\n${fallos} FALLAS`);
process.exit(fallos === 0 ? 0 : 1);
