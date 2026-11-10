/**
 * El boton de la cabecera. Dos configuraciones:
 *
 * 1) GRACIAS (la vigente): boton "Gracias". La ventana deja elegir pais y
 *    medio: Yape (Peru) o DiMo (Mexico). Muestra el celular, el titular y,
 *    si existe, el QR. conText no cobra ni procesa pagos: el dinero va de la
 *    app del que agradece a la cuenta, sin pasar por aqui.
 *
 *      GRACIAS_YAPE_NUMERO   celular Yape (Peru), p. ej. 987 654 321
 *      GRACIAS_YAPE_NOMBRE   titular que vera quien envia
 *      GRACIAS_YAPE_QR_PNG   opcional: el QR de Yape, PNG en base64
 *      GRACIAS_DIMO_NUMERO   celular DiMo (Mexico), 10 digitos
 *      GRACIAS_DIMO_NOMBRE   titular / banco que vera quien envia
 *      GRACIAS_DIMO_QR_PNG   opcional: QR, PNG en base64
 *
 *    Un medio sin numero no aparece. Sin ninguno, no hay boton.
 *
 * 2) MODO DONACION (dormido): el reparto de donaciones CoDi entre estudiantes
 *    (AIdeaText-CODI-MIPEY, codi.aideatext.ai). Se conserva entero. Para
 *    reactivarlo: MODO_DONACION=on, ademas de lo que ya pedia:
 *
 *      APOYO_MODO        cafe | beca
 *      APOYO_QR_PNG      el PNG del QR CoDi en base64 (sale de cafe_qr.png)
 *      APOYO_PAGINA_URL  opcional: la pagina /cafe o /becas del servicio
 *      APOYO_PRECIO      opcional: MXN por sesion (10 por defecto)
 *
 *    Con MODO_DONACION=on gana la donacion y "Gracias" no se muestra.
 */
import type { Express } from 'express';

export type ModoApoyo = 'off' | 'gracias' | 'cafe' | 'beca';
export type MedioGracias = 'yape' | 'dimo';

const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function png(variable: string): Buffer | null {
  const b64 = process.env[variable]?.trim().replace(/^data:image\/png;base64,/, '');
  if (!b64) return null;
  try {
    const buf = Buffer.from(b64, 'base64');
    // Evita servir basura si la variable se pego mal (p. ej. el comando en vez de su salida).
    if (buf.length < 100 || !buf.subarray(0, 8).equals(FIRMA_PNG)) {
      console.warn(`[apoyo] ${variable} no es un PNG en base64 valido; se ignora`);
      return null;
    }
    return buf;
  } catch {
    return null;
  }
}

const texto = (v: string) => process.env[v]?.trim().slice(0, 80) || null;

// ── Modo donacion (dormido) ──────────────────────────────────────────────
function modoDonacion(): 'off' | 'cafe' | 'beca' {
  if (process.env.MODO_DONACION?.trim().toLowerCase() !== 'on') return 'off';
  const m = process.env.APOYO_MODO?.trim().toLowerCase();
  return m === 'cafe' || m === 'beca' ? m : 'off';
}

export function rutasApoyo(app: Express) {
  const qrDonacion = png('APOYO_QR_PNG');
  const donacion = qrDonacion ? modoDonacion() : 'off';

  const medios = (['yape', 'dimo'] as const)
    .map((id) => {
      const V = `GRACIAS_${id.toUpperCase()}`;
      return { id, numero: texto(`${V}_NUMERO`), nombre: texto(`${V}_NOMBRE`), qr: png(`${V}_QR_PNG`) };
    })
    .filter((m) => m.numero);

  const modo: ModoApoyo = donacion !== 'off' ? donacion : medios.length ? 'gracias' : 'off';
  if (modo !== 'off') console.log(`[apoyo] activo en modo ${modo}`);

  app.get('/api/apoyo', (_req, res) => {
    if (modo === 'gracias') {
      return res.json({
        modo,
        medios: medios.map((m) => ({
          id: m.id,
          numero: m.numero,
          nombre: m.nombre,
          qr: m.qr ? `/api/apoyo/${m.id}.png` : null,
        })),
      });
    }
    const pagina = process.env.APOYO_PAGINA_URL?.trim();
    res.json({
      modo,
      qr: modo === 'off' ? null : '/api/apoyo/qr.png',
      // Solo enlaces https: lo que viene de una variable igual se valida.
      pagina: pagina && /^https:\/\/[^\s<>]+$/.test(pagina) ? pagina : null,
      precio: Number(process.env.APOYO_PRECIO ?? 10) || 10,
    });
  });

  app.get('/api/apoyo/:archivo', (req, res) => {
    const nombre = req.params.archivo;
    const buf =
      nombre === 'qr.png' && (modo === 'cafe' || modo === 'beca')
        ? qrDonacion
        : modo === 'gracias'
          ? (medios.find((m) => `${m.id}.png` === nombre)?.qr ?? null)
          : null;
    if (!buf) return res.status(404).end();
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buf);
  });
}
