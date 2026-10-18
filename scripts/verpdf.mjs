import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
const pdf = fileURLToPath(new URL('../.fixtures/shots/mi-resumen-context.pdf', import.meta.url));
const out = fileURLToPath(new URL('../.fixtures/shots/', import.meta.url));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 1200 } });
await p.goto('http://localhost:3000');
await p.addScriptTag({ path: fileURLToPath(new URL('../node_modules/pdfjs-dist/build/pdf.min.mjs', import.meta.url)), type: 'module' }).catch(()=>{});
const buf = (await import('node:fs')).readFileSync(pdf).toString('base64');
const paginas = await p.evaluate(async (b64) => {
  const pdfjs = await import('/node_modules/pdfjs-dist/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.mjs';
  const data = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const doc = await pdfjs.getDocument({ data }).promise;
  const imgs = [];
  for (let i = 1; i <= Math.min(doc.numPages, 3); i++) {
    const pg = await doc.getPage(i);
    const vp = pg.getViewport({ scale: 1.3 });
    const c = document.createElement('canvas');
    c.width = vp.width; c.height = vp.height;
    await pg.render({ canvas: c, canvasContext: c.getContext('2d'), viewport: vp }).promise;
    imgs.push(c.toDataURL('image/png'));
  }
  return { total: doc.numPages, imgs };
}, buf);
console.log('paginas del PDF:', paginas.total);
const fs = await import('node:fs');
paginas.imgs.forEach((d, i) => fs.writeFileSync(`${out}pdf-p${i+1}.png`, Buffer.from(d.split(',')[1], 'base64')));
await b.close();
