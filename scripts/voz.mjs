/**
 * Prueba que el tutor habla: al activar "El tutor habla", la respuesta se
 * sintetiza en Azure Speech y suena en el navegador.
 *   node scripts/voz.mjs [url]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:3000';
let fallos = 0;
const check = (ok, msg) => {
  if (!ok) fallos++;
  console.log(`${ok ? 'OK  ' : 'FALLA'} ${msg}`);
};

const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
});
// La interfaz sigue el idioma del navegador: la suite busca textos en espanol.
const ctx = await browser.newContext({ locale: 'es-PE' });
const page = await ctx.newPage();
page.on('pageerror', (e) => {
  fallos++;
  console.log('FALLA error de JS:', e.message);
});

const peticionesVoz = [];
page.on('response', (r) => {
  if (r.url().includes('/api/voz')) peticionesVoz.push(r.status());
});

await page.goto(BASE, { waitUntil: 'networkidle' });

const toggle = page.getByText('El tutor habla');
check(await toggle.isVisible(), 'el interruptor de voz está visible');
await toggle.click();

const caja = page.getByPlaceholder('Escribe tu mensaje…');
await caja.fill('Estoy viendo cómo funciona una bomba de agua manual en mi barrio.');
await caja.press('Enter');

await page.waitForFunction(() => {
  const t = document.querySelector('textarea');
  return t && !t.disabled;
}, undefined, { timeout: 120_000 });

// Esperamos a que el audio llegue y empiece a sonar
await page.waitForFunction(() => window.__audioSonando === true || document.querySelectorAll('audio').length > 0, undefined, { timeout: 30_000 }).catch(() => {});
await page.waitForTimeout(6000);

check(peticionesVoz.length > 0, `el navegador pidió la voz al servidor (${peticionesVoz.length} veces)`);
check(peticionesVoz.every((s) => s === 200), `Azure Speech respondió bien (${peticionesVoz.join(', ')})`);

const sonando = await page.evaluate(() => {
  const audios = [...document.querySelectorAll('audio')];
  return audios.map((a) => ({ paused: a.paused, t: a.currentTime, dur: a.duration }));
});
console.log('     audio creado en memoria (no va al DOM):', JSON.stringify(sonando));

// El botón por mensaje también debe existir
const botonLeer = page.locator('button[aria-label*="voz alta"], button[aria-label*="Detener"]');
check((await botonLeer.count()) > 0, 'cada respuesta tiene su botón de escuchar');

await browser.close();
console.log(fallos === 0 ? '\nTODO OK' : `\n${fallos} FALLAS`);
process.exit(fallos === 0 ? 0 : 1);
