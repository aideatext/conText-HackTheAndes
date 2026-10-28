/**
 * Genera public/og-image-{es,en,pt,fr}.png (1200x630): la vista previa que muestran Facebook,
 * WhatsApp, LinkedIn, X y compania al compartir el enlace.
 *
 *   node scripts/og-imagen.mjs
 *
 * Se dibuja con las letras y el logo de public/, asi que no sale de la marca.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Incrustados en base64: una pagina armada con setContent no puede leer file://.
const pub = (f) => {
  const tipo = f.endsWith('.png') ? 'image/png' : 'font/woff2';
  return `data:${tipo};base64,${readFileSync(path.join(raiz, 'public', f)).toString('base64')}`;
};

// Un grafo pequeno con los tres origenes: material (tinta), estudiante (azul), tutor (rojo).
const nodos = [
  [820, 170, 26, '#4e5a68'], [985, 120, 18, '#0b7ec5'], [1060, 255, 22, '#0b7ec5'],
  [900, 330, 30, '#0b7ec5'], [760, 300, 16, '#ae0025'], [1010, 420, 18, '#4e5a68'],
  [840, 470, 20, '#0b7ec5'], [1110, 390, 14, '#ae0025'],
];
const enlaces = [[0, 1], [0, 3], [1, 2], [2, 3], [3, 4], [3, 5], [5, 6], [3, 6], [2, 7], [5, 7], [0, 4]];
const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0">
  ${enlaces.map(([a, b]) => `<line x1="${nodos[a][0]}" y1="${nodos[a][1]}" x2="${nodos[b][0]}" y2="${nodos[b][1]}" stroke="#cdd6df" stroke-width="3"/>`).join('')}
  ${nodos.map(([x, y, r, c]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`).join('')}
</svg>`;

// Una tarjeta por idioma del enlace (?lang=es|en|pt|fr): la elige server/meta.ts.
const TEXTOS = {
  es: ['Piensa tus ideas en voz alta y míralas conectarse.', 'Un tutor socrático que no hace la tarea por ti.'],
  en: ['Think your ideas out loud and watch them connect.', "A Socratic tutor that won't do your homework for you."],
  pt: ['Pense suas ideias em voz alta e veja-as se conectarem.', 'Um tutor socrático que não faz a lição por você.'],
  fr: ['Pense tes idées à voix haute et regarde-les se connecter.', 'Un tuteur socratique qui ne fait pas tes devoirs à ta place.'],
};

// "veja-as", "regarde-les": una palabra con guion no se parte al final de linea.
const junto = (t) => t.replace(/\S+-\S+/g, (p) => `<span class="junto">${p}</span>`);

const html = (idioma, [lema, segunda]) => `<!doctype html><html lang="${idioma}"><head><meta charset="utf-8"><style>
  @font-face { font-family: Fraunces; font-weight: 100 900; src: url(${pub('fonts/fraunces-latin-wght-normal.woff2')}); }
  @font-face { font-family: Plex; font-weight: 400; src: url(${pub('fonts/ibm-plex-sans-latin-400-normal.woff2')}); }
  @font-face { font-family: Plex; font-weight: 600; src: url(${pub('fonts/ibm-plex-sans-latin-600-normal.woff2')}); }
  body { margin: 0; width: 1200px; height: 630px; background: #fbf8f3; position: relative; overflow: hidden; font-family: Plex; color: #16202b; }
  .franja { position: absolute; left: 0; top: 0; bottom: 0; width: 14px; background: linear-gradient(#0b7ec5 50%, #ae0025 50%); }
  .texto { position: absolute; left: 80px; top: 92px; width: 600px; }
  .logo { width: 96px; height: 96px; }
  h1 { font-family: Fraunces; font-weight: 600; font-size: 104px; letter-spacing: -2px; margin: 18px 0 10px; line-height: 1; }
  .lema { font-size: 34px; line-height: 1.25; margin: 0; text-wrap: balance; }
  .segunda { font-size: 26px; line-height: 1.3; margin: 14px 0 0; color: #4e5a68; text-wrap: balance; }
  .junto { white-space: nowrap; }
  .pie { position: absolute; left: 80px; bottom: 58px; font-size: 22px; font-weight: 600; color: #0b7ec5; }
  .pie span { color: #4e5a68; font-weight: 400; }
</style></head><body>
  <div class="franja"></div>
  ${svg}
  <div class="texto">
    <img class="logo" src="${pub('img/logo-aideatext.png')}">
    <h1>conText</h1>
    <p class="lema">${junto(lema)}</p>
    <p class="segunda">${junto(segunda)}</p>
  </div>
  <div class="pie">context.aideatext.ai <span>· AIdeaText</span></div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const [idioma, textos] of Object.entries(TEXTOS)) {
  await page.setContent(html(idioma, textos), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const salida = path.join(raiz, 'public', `og-image-${idioma}.png`);
  await page.screenshot({ path: salida });
  console.log('listo:', salida);
}
await browser.close();
