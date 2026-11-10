/** Rasteriza un SVG a PNG. Archivo aparte para no arrastrar pdf-lib a la carga inicial. */
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
