/**
 * Prueba el boton "Llevarme mi resumen": sube material, conversa y descarga el PDF.
 *   node scripts/pdf.mjs [url]
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { mkdirSync, statSync } from 'node:fs';

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

await page
  .locator('input[type=file]')
  .first()
  .setInputFiles(
    'C:/Users/Usuario/Documents/Hackathon_Hack-The-Andes/assets/image/test_img-1-vaso_computadora.png',
  );
await page.locator('img[alt^="Material"]').first().waitFor({ timeout: 120_000 });

const caja = page.getByPlaceholder('Escribe tu mensaje…');
await caja.fill('Esa foto la tomé en la cabina de internet de mi barrio. Todos ponen el vaso ahí.');
await caja.press('Enter');
await page.waitForFunction(() => {
  const t = document.querySelector('textarea');
  return t && !t.disabled;
}, undefined, { timeout: 120_000 });
await page.waitForTimeout(2500);

const descarga = page.waitForEvent('download', { timeout: 90_000 });
await page.getByRole('button', { name: /Llevarme mi resumen/ }).click();
const file = await descarga;
const destino = `${salida}mi-resumen-context.pdf`;
await file.saveAs(destino);

check(file.suggestedFilename().endsWith('.pdf'), `se descarga ${file.suggestedFilename()}`);
const bytes = statSync(destino).size;
check(bytes > 20_000, `el PDF pesa ${(bytes / 1024).toFixed(0)} KB`);

await browser.close();
console.log(fallos === 0 ? '\nTODO OK' : `\n${fallos} FALLAS`);
process.exit(fallos === 0 ? 0 : 1);
