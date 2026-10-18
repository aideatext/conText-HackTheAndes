import { chromium, devices } from 'playwright';
import { fileURLToPath } from 'node:url';
const out = fileURLToPath(new URL('../.fixtures/shots/', import.meta.url));
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['Pixel 7'] });
const p = await ctx.newPage();
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
await p.locator('header').screenshot({ path: `${out}cabecera-movil.png` });
const desborde = await p.evaluate(() => {
  const h = document.querySelector('header');
  return { scroll: document.documentElement.scrollWidth, ventana: window.innerWidth, headerW: Math.round(h.getBoundingClientRect().width) };
});
console.log('ancho documento vs ventana:', JSON.stringify(desborde));
await b.close();
