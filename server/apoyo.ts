/**
 * Apoyo con CoDi: "Invítame un café" hoy, beca de sesiones para estudiantes despues.
 *
 * conText no cobra ni procesa pagos: solo muestra el QR CoDi permanente (monto
 * libre) que genera el servicio de pagos de AIdeaText con pey. El dinero va
 * directo de la app bancaria del donante a la cuenta; aqui no pasa nada de eso.
 *
 * Todo se configura con variables de entorno, sin tocar codigo:
 *
 *   APOYO_MODO        off | cafe | beca   (sin valor: off, el boton no aparece)
 *   APOYO_QR_PNG      el PNG del QR en base64 (sale de cafe_qr.png). Va en una
 *                     variable y no en el repo porque el QR apunta a una cuenta.
 *   APOYO_PAGINA_URL  opcional: la pagina /cafe del servicio de pagos, con montos
 *                     fijos, cobro al celular y el muro de sesiones financiadas.
 *   APOYO_PRECIO      opcional: MXN por sesion (10 por defecto), para el texto.
 */
import type { Express } from 'express';

export type ModoApoyo = 'off' | 'cafe' | 'beca';

function modo(): ModoApoyo {
  const m = process.env.APOYO_MODO?.trim().toLowerCase();
  return m === 'cafe' || m === 'beca' ? m : 'off';
}

function qrPng(): Buffer | null {
  const b64 = process.env.APOYO_QR_PNG?.trim().replace(/^data:image\/png;base64,/, '');
  if (!b64) return null;
  try {
    const buf = Buffer.from(b64, 'base64');
    return buf.length > 0 ? buf : null;
  } catch {
    return null;
  }
}

export function rutasApoyo(app: Express) {
  const png = qrPng();
  const m = png ? modo() : 'off';
  if (m !== 'off') console.log(`[apoyo] activo en modo ${m}`);

  app.get('/api/apoyo', (_req, res) => {
    const pagina = process.env.APOYO_PAGINA_URL?.trim();
    res.json({
      modo: m,
      qr: m === 'off' ? null : '/api/apoyo/qr.png',
      // Solo enlaces https: lo que viene de una variable igual se valida.
      pagina: pagina && /^https:\/\//.test(pagina) ? pagina : null,
      precio: Number(process.env.APOYO_PRECIO ?? 10) || 10,
    });
  });

  app.get('/api/apoyo/qr.png', (_req, res) => {
    if (m === 'off' || !png) return res.status(404).end();
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(png);
  });
}
