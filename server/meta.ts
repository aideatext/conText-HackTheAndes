/**
 * Los metadatos de la pagina en el idioma del enlace.
 *
 * Facebook, WhatsApp, X, LinkedIn y compania no ejecutan JavaScript: leen el
 * HTML tal como sale del servidor. Por eso el idioma de la tarjeta no puede
 * decidirse en el navegador: `?lang=en` tiene que llegar ya con sus etiquetas.
 *
 * Hay tarjeta en cuatro idiomas aunque la interfaz solo exista en dos: un
 * enlace en portugues o frances abre la interfaz en espanol, y su descripcion
 * lo dice en vez de prometer lo que no hay.
 */
const SITIO = 'https://context.aideatext.ai';

export const IDIOMAS_TARJETA = ['es', 'en', 'pt', 'fr'] as const;
export type IdiomaTarjeta = (typeof IDIOMAS_TARJETA)[number];

interface Meta {
  html: string;
  locale: string;
  titulo: string;
  descripcion: string;
  descripcionCorta: string;
  alt: string;
}

const META: Record<IdiomaTarjeta, Meta> = {
  es: {
    html: 'es-PE',
    locale: 'es_PE',
    titulo: 'conText · Piensa tus ideas en voz alta y míralas conectarse',
    descripcion:
      'Sube tu material, conversa con un tutor socrático que no hace la tarea por ti y mira en vivo el grafo de las ideas que conectas. En español y en inglés.',
    descripcionCorta:
      'Sube tu material, conversa con un tutor socrático y mira en vivo el grafo de las ideas que conectas. En español y en inglés.',
    alt: 'conText: piensa tus ideas en voz alta y míralas conectarse. Un grafo de ideas en azul, rojo y gris.',
  },
  en: {
    html: 'en-US',
    locale: 'en_US',
    titulo: 'conText · Think your ideas out loud and watch them connect',
    descripcion:
      "Upload your material, talk with a Socratic tutor that won't do the homework for you, and watch the map of the ideas you connect grow live. In English and Spanish.",
    descripcionCorta:
      'Upload your material, talk with a Socratic tutor and watch the map of the ideas you connect grow live. In English and Spanish.',
    alt: 'conText: think your ideas out loud and watch them connect. A graph of ideas in blue, red and grey.',
  },
  pt: {
    html: 'pt-BR',
    locale: 'pt_BR',
    titulo: 'conText · Pense suas ideias em voz alta e veja-as se conectarem',
    descripcion:
      'Envie seu material, converse com um tutor socrático que não faz a lição por você e veja ao vivo o mapa das ideias que você conecta. Disponível em espanhol e inglês.',
    descripcionCorta:
      'Envie seu material, converse com um tutor socrático e veja ao vivo o mapa das ideias que você conecta. Disponível em espanhol e inglês.',
    alt: 'conText: pense suas ideias em voz alta e veja-as se conectarem. Um grafo de ideias em azul, vermelho e cinza.',
  },
  fr: {
    html: 'fr-FR',
    locale: 'fr_FR',
    titulo: 'conText · Pense tes idées à voix haute et regarde-les se connecter',
    descripcion:
      'Importe ton document, discute avec un tuteur socratique qui ne fait pas les devoirs à ta place et regarde en direct la carte des idées que tu relies. Disponible en espagnol et en anglais.',
    descripcionCorta:
      'Importe ton document, discute avec un tuteur socratique et regarde en direct la carte des idées que tu relies. Disponible en espagnol et en anglais.',
    alt: 'conText : pense tes idées à voix haute et regarde-les se connecter. Un graphe d’idées en bleu, rouge et gris.',
  },
};

export function idiomaTarjeta(valor: unknown): IdiomaTarjeta {
  const dos = typeof valor === 'string' ? valor.slice(0, 2).toLowerCase() : '';
  return (IDIOMAS_TARJETA as readonly string[]).includes(dos) ? (dos as IdiomaTarjeta) : 'es';
}

const urlDe = (i: IdiomaTarjeta) => (i === 'es' ? `${SITIO}/` : `${SITIO}/?lang=${i}`);

const escapar = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Cambia el content de un <meta> existente, este en una linea o en varias. */
function fijar(html: string, atributo: 'name' | 'property', clave: string, valor: string): string {
  const re = new RegExp(`(<meta\\s+${atributo}="${clave}"\\s+content=")[^"]*(")`);
  if (!re.test(html)) throw new Error(`index.html no tiene <meta ${atributo}="${clave}">`);
  return html.replace(re, `$1${escapar(valor)}$2`);
}

/** Las cuatro versiones de index.html, armadas una vez al arrancar. */
export function paginasPorIdioma(plantilla: string): Record<IdiomaTarjeta, string> {
  const salida = {} as Record<IdiomaTarjeta, string>;
  for (const i of IDIOMAS_TARJETA) {
    const m = META[i];
    const imagen = `${SITIO}/og-image-${i}.png`;
    let html = plantilla.replace(/<html lang="[^"]*">/, `<html lang="${m.html}">`);
    html = fijar(html, 'name', 'description', m.descripcion);
    html = fijar(html, 'property', 'og:url', urlDe(i));
    html = fijar(html, 'property', 'og:title', m.titulo);
    html = fijar(html, 'property', 'og:description', m.descripcion);
    html = fijar(html, 'property', 'og:image', imagen);
    html = fijar(html, 'property', 'og:image:secure_url', imagen);
    html = fijar(html, 'property', 'og:image:alt', m.alt);
    html = fijar(html, 'property', 'og:locale', m.locale);
    html = fijar(html, 'name', 'twitter:title', m.titulo);
    html = fijar(html, 'name', 'twitter:description', m.descripcionCorta);
    html = fijar(html, 'name', 'twitter:image', imagen);
    html = fijar(html, 'name', 'twitter:image:alt', m.alt);
    // Los otros tres idiomas, como alternativas de la tarjeta.
    const alternas = IDIOMAS_TARJETA.filter((o) => o !== i)
      .map((o) => `<meta property="og:locale:alternate" content="${META[o].locale}" />`)
      .join('\n    ');
    html = html.replace(/<meta property="og:locale:alternate" content="[^"]*" \/>/, alternas);
    salida[i] = html;
  }
  return salida;
}
