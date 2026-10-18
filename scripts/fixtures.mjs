/**
 * Genera material de prueba para el smoke test: una "foto" de una pagina de
 * cuaderno (PNG) y un PDF de 3 paginas. Solo para pruebas locales.
 *   node scripts/fixtures.mjs
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const OUT = new URL('../.fixtures/', import.meta.url);

const cuaderno = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin:0; background:#fdfcf5; font-family: "Comic Sans MS", cursive; }
  .hoja { width: 820px; min-height: 1060px; padding: 60px 70px;
    background: repeating-linear-gradient(#fdfcf5 0 31px, #cfe3f5 31px 32px); }
  .margen { position:absolute; left:110px; top:0; bottom:0; width:2px; background:#f0a; opacity:.35 }
  h1 { font-size: 34px; margin: 0 0 24px; text-decoration: underline; }
  p, li { font-size: 25px; line-height: 32px; margin: 0 0 8px; }
  ul { margin: 8px 0 16px 24px; }
</style></head><body><div class="margen"></div><div class="hoja">
  <h1>El ciclo del agua</h1>
  <p>El sol calienta el agua de los rios y del mar.</p>
  <p>El agua se evapora y sube como vapor.</p>
  <ul>
    <li>Arriba hace mas frio, entonces el vapor se condensa.</li>
    <li>Se forman las nubes con gotitas muy pequenas.</li>
    <li>Cuando las gotas pesan mucho, cae la lluvia.</li>
  </ul>
  <p>El agua vuelve a los rios y empieza otra vez.</p>
  <p>Profesora: ¿por que en la costa de Lima casi no llueve?</p>
</div></body></html>`;

const pdfPages = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { font-family: Georgia, serif; font-size: 15px; line-height: 1.6; }
  .p { page-break-after: always; padding: 40px; }
  h2 { font-size: 20px; }
</style></head><body>
<div class="p"><h2>1. La papa en el Peru</h2>
<p>La papa se domestico hace unos 8 000 anos en los Andes, cerca del lago Titicaca.
Hoy existen mas de 3 000 variedades en el pais. La papa fue el alimento base de las
sociedades andinas y permitio almacenar comida para los anos malos.</p></div>
<div class="p"><h2>2. El chuno</h2>
<p>El chuno es papa deshidratada con el frio de la noche y el sol del dia. Esta tecnica
permitia guardar el alimento por varios anos. Gracias a eso, el Estado inca podia
alimentar a los trabajadores que se movian lejos de sus pueblos.</p></div>
<div class="p"><h2>3. De los Andes al mundo</h2>
<p>En el siglo XVI la papa llego a Europa. Al inicio desconfiaban de ella, pero en el
siglo XVIII se volvio clave contra el hambre. En Irlanda la dependencia de una sola
variedad termino en una hambruna cuando apareció una plaga en 1845.</p></div>
</body></html>`;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

const page = await browser.newPage({ viewport: { width: 820, height: 1060 } });
await page.setContent(cuaderno);
await page.screenshot({ path: new URL('cuaderno.png', OUT).pathname.slice(1), fullPage: true });

const page2 = await browser.newPage();
await page2.setContent(pdfPages);
const pdf = await page2.pdf({ format: 'A4' });
await writeFile(new URL('papa.pdf', OUT), pdf);

await writeFile(
  new URL('apuntes.txt', OUT),
  'Apuntes de clase: la independencia del Peru.\n\n' +
    'San Martin proclamo la independencia en 1821 pero la guerra siguio.\n' +
    'Las batallas de Junin y Ayacucho en 1824 cerraron el proceso.\n' +
    'Duda mia: si ya se habia proclamado en 1821, por que seguian peleando?\n',
);

// Archivo no soportado y archivo demasiado grande
await writeFile(new URL('clase.mp4', OUT), Buffer.alloc(1024, 7));
await writeFile(new URL('enorme.png', OUT), Buffer.alloc(11 * 1024 * 1024, 1));

await browser.close();
console.log('listo:', OUT.pathname);
