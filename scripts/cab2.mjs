import { chromium, devices } from 'playwright';
import { fileURLToPath } from 'node:url';
const out = fileURLToPath(new URL('../.fixtures/shots/', import.meta.url));
const b = await chromium.launch();
for (const [n, o] of [['cab-escritorio', { viewport: { width: 1440, height: 900 } }], ['cab-movil', { ...devices['Pixel 7'] }]]) {
  const ctx = await b.newContext(o);
  const p = await ctx.newPage();
  await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1800);
  await p.locator('header').screenshot({ path: `${out}${n}.png` });
  const d = await p.evaluate(() => ({ scroll: document.documentElement.scrollWidth, ventana: window.innerWidth }));
  console.log(n, JSON.stringify(d));
  await ctx.close();
}
await b.close();
