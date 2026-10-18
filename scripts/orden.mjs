import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('https://context.aideatext.ai', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
const orden = await p.evaluate(() =>
  [...document.querySelectorAll('header img, header h1')]
    .map(e => ({ que: e.tagName === 'H1' ? `leyenda: ${e.textContent}` : `logo: ${e.alt}`, x: Math.round(e.getBoundingClientRect().x) }))
    .sort((a, b) => a.x - b.x)
);
orden.forEach((o, i) => console.log(`  ${i + 1}. x=${o.x}  ${o.que}`));
await b.close();
