import { chromium, devices } from 'playwright';
import { fileURLToPath } from 'node:url';
const out = fileURLToPath(new URL('../.fixtures/shots/', import.meta.url));
const b = await chromium.launch();
for (const [nombre, opts, movil] of [
  ['marca-escritorio', { viewport: { width: 1440, height: 900 } }, false],
  ['marca-movil', { ...devices['Pixel 7'] }, true],
]) {
  const ctx = await b.newContext(opts);
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type()==='error') console.log('consola:', m.text().slice(0,160)); });
  await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  if (movil) await p.getByRole('button', { name: 'Material' }).click();
  await p.locator('input[type=file]').first().setInputFiles('C:/Users/Usuario/Documents/Hackathon_Hack-The-Andes/assets/image/test_img-1-vaso_computadora.png');
  await p.locator('img[alt^="Material"]').first().waitFor({ timeout: 120000 });
  if (movil) await p.getByRole('button', { name: 'Conversación' }).click();
  const caja = p.getByPlaceholder('Escribe tu mensaje…');
  await caja.fill('Esa foto la tomé en la cabina de internet de mi barrio. Todos ponen el vaso ahí.');
  await caja.press('Enter');
  await p.waitForFunction(() => { const t=document.querySelector('textarea'); return t && !t.disabled; }, undefined, { timeout: 120000 });
  if (movil) await p.getByRole('button', { name: 'Grafo', exact: true }).click();
  await p.waitForTimeout(3000);
  await p.screenshot({ path: `${out}${nombre}.png` });
  await ctx.close();
}
await b.close();
console.log('capturas listas');
