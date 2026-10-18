/**
 * "Llevarme mi resumen": arma un PDF con el material, el grafo de ideas y la
 * conversacion, para que el estudiante estudie despues sin la app.
 *
 * Se genera entero en el navegador con pdf-lib, la misma libreria de aidesk:
 * el material del estudiante no vuelve a salir hacia ningun servicio.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { ChatMessage, Graph, Metrics } from '../shared/types';
import { ORIGIN_LABEL, TYPE_LABEL } from './components/GraphVisualization';

const A4: [number, number] = [595.28, 841.89];
const MARGEN = 48;
const ANCHO = A4[0] - MARGEN * 2;

const TINTA = rgb(0.09, 0.09, 0.11);
const SUAVE = rgb(0.45, 0.45, 0.5);
const AZUL = rgb(0.15, 0.39, 0.92);

/** pdf-lib con fuentes estandar solo escribe WinAnsi: cambiamos lo que no entra. */
function aWinAnsi(texto: string): string {
  return texto
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/[–—]/g, '-')
    .replace(/→/g, '->')
    .replace(/•/g, '·')
    .replace(/ /g, ' ')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '');
}

function partirEnLineas(texto: string, font: PDFFont, size: number, ancho: number): string[] {
  const lineas: string[] = [];
  for (const parrafo of aWinAnsi(texto).split('\n')) {
    let actual = '';
    for (const palabra of parrafo.split(/\s+/)) {
      const intento = actual ? `${actual} ${palabra}` : palabra;
      if (font.widthOfTextAtSize(intento, size) > ancho && actual) {
        lineas.push(actual);
        actual = palabra;
      } else {
        actual = intento;
      }
    }
    lineas.push(actual);
  }
  return lineas;
}

/** Rasteriza el SVG del grafo a PNG para incrustarlo. */
export async function svgAPng(svg: SVGSVGElement, escala = 2): Promise<Uint8Array | null> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const w = svg.clientWidth || 800;
  const h = svg.clientHeight || 600;
  clone.setAttribute('width', String(w));
  clone.setAttribute('height', String(h));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  const fondo = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  fondo.setAttribute('width', '100%');
  fondo.setAttribute('height', '100%');
  fondo.setAttribute('fill', '#ffffff');
  clone.insertBefore(fondo, clone.firstChild);

  const fuente = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(fuente)));
  try {
    await new Promise((ok, fail) => {
      img.onload = ok;
      img.onerror = fail;
    });
  } catch {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = w * escala;
  canvas.height = h * escala;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(escala, escala);
  ctx.drawImage(img, 0, 0);

  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/png'));
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
}

export interface DatosExport {
  graph: Graph;
  metrics: Metrics;
  messages: ChatMessage[];
  summary: string;
  materialName: string | null;
  materialUrl: string | null;
  materialMime: string | null;
  svg: SVGSVGElement | null;
}

export async function exportarPdf(d: DatosExport): Promise<void> {
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = pdf.addPage(A4);
  let y = A4[1] - MARGEN;

  const nuevaPagina = () => {
    page = pdf.addPage(A4);
    y = A4[1] - MARGEN;
  };
  const espacio = (alto: number) => {
    if (y - alto < MARGEN) nuevaPagina();
  };
  const escribir = (
    texto: string,
    { size = 10.5, font = normal, color = TINTA, interlineado = 1.45, sangria = 0 } = {},
  ) => {
    for (const linea of partirEnLineas(texto, font, size, ANCHO - sangria)) {
      espacio(size * interlineado);
      page.drawText(linea, { x: MARGEN + sangria, y: y - size, size, font, color });
      y -= size * interlineado;
    }
  };
  const separar = (alto = 12) => {
    y -= alto;
  };

  // --- Portada ---
  escribir('conText', { size: 24, font: negrita });
  separar(2);
  escribir('Las ideas que conectaste', { size: 13, font: negrita, color: SUAVE });
  separar(4);
  escribir(
    new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' }),
    { size: 9, color: SUAVE },
  );
  separar(18);

  // --- Material ---
  if (d.materialName || d.summary) {
    escribir('Tu material', { size: 13, font: negrita });
    separar(6);
    if (d.materialName) {
      escribir(d.materialName, { size: 9, color: SUAVE });
      separar(4);
    }

    if (d.materialUrl && d.materialMime?.startsWith('image/')) {
      try {
        const bytes = new Uint8Array(await (await fetch(d.materialUrl)).arrayBuffer());
        const img = d.materialMime.includes('png')
          ? await pdf.embedPng(bytes)
          : await pdf.embedJpg(bytes);
        const maxAlto = 210;
        const escala = Math.min(ANCHO / img.width, maxAlto / img.height);
        const w = img.width * escala;
        const h = img.height * escala;
        espacio(h + 10);
        page.drawImage(img, { x: MARGEN, y: y - h, width: w, height: h });
        y -= h + 10;
      } catch {
        // Si la imagen no se puede incrustar (webp, por ejemplo), seguimos sin ella.
      }
    }

    if (d.summary) escribir(d.summary, { size: 10.5 });
    separar(18);
  }

  // --- Indicadores ---
  escribir('Cómo quedó tu mapa', { size: 13, font: negrita });
  separar(6);
  escribir(
    `Ideas que conectaste tú: ${d.metrics.ideasEstudiante}  ·  ` +
      `Conexiones: ${d.metrics.enlacesTotales}  ·  ` +
      `Ideas en total: ${d.metrics.nodosTotales}  ·  ` +
      `Aún sueltas: ${d.metrics.porcentajeAislados}%`,
    { size: 10 },
  );
  if (d.metrics.ideaMasCentral) {
    separar(2);
    escribir(`La idea que más conecta: ${d.metrics.ideaMasCentral}`, { size: 10 });
  }
  separar(16);

  // --- El grafo ---
  if (d.svg) {
    const png = await svgAPng(d.svg);
    if (png) {
      const img = await pdf.embedPng(png);
      const escala = Math.min(ANCHO / img.width, 430 / img.height);
      const w = img.width * escala;
      const h = img.height * escala;
      espacio(h + 26);
      escribir('Tu grafo de ideas', { size: 13, font: negrita });
      separar(6);
      page.drawImage(img, { x: MARGEN + (ANCHO - w) / 2, y: y - h, width: w, height: h });
      y -= h + 16;
    }
  }

  // --- Mis conexiones, en palabras ---
  const mias = d.graph.nodes.filter((n) => n.origin === 'estudiante');
  if (mias.length) {
    espacio(60);
    escribir('Lo que pensaste tú', { size: 13, font: negrita, color: AZUL });
    separar(6);
    const etiqueta = new Map(d.graph.nodes.map((n) => [n.id, n.label]));
    for (const n of mias) {
      escribir(`• ${n.label}  (${TYPE_LABEL[n.type]})`, { size: 10 });
      for (const l of d.graph.links.filter((l) => l.source === n.id)) {
        escribir(`   ${l.relation.replace(/_/g, ' ')} → ${etiqueta.get(l.target) ?? l.target}`, {
          size: 9,
          color: SUAVE,
          sangria: 12,
        });
      }
    }
    separar(16);
  }

  // --- Conversación ---
  if (d.messages.length) {
    nuevaPagina();
    escribir('Tu conversación', { size: 13, font: negrita });
    separar(8);
    for (const m of d.messages) {
      if (!m.content.trim()) continue;
      escribir(m.role === 'user' ? 'Tú' : 'Tutor', {
        size: 9,
        font: negrita,
        color: m.role === 'user' ? AZUL : SUAVE,
      });
      escribir(m.content, { size: 10.5, sangria: 10 });
      separar(9);
    }
  }

  // --- Pie en cada página ---
  const total = pdf.getPageCount();
  pdf.getPages().forEach((p, i) => {
    p.drawText(
      aWinAnsi(`conText · no te califica y no redacta por ti · ${i + 1}/${total}`),
      { x: MARGEN, y: 24, size: 8, font: normal, color: SUAVE },
    );
  });

  const bytes = await pdf.save();
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mi-resumen-context.pdf';
  a.click();
  URL.revokeObjectURL(url);
}

export { ORIGIN_LABEL };
