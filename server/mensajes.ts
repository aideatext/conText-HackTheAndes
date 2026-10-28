/**
 * Lo que el servidor le dice al estudiante, en los dos idiomas. El idioma sale
 * de la cabecera X-Idioma que manda el navegador: es el de la interfaz.
 */
import type { Request } from 'express';
import { aIdioma, CABECERA_IDIOMA, LOCALE, type Idioma } from '../shared/idioma.js';
import { MAX_CARACTERES_TEXTO, MAX_PAGINAS_PDF, MAX_TURNOS } from '../shared/limites.js';

export const idiomaDe = (req: Request): Idioma => aIdioma(req.get(CABECERA_IDIOMA));

const miles = (n: number, idioma: Idioma) => n.toLocaleString(LOCALE[idioma]);

const es = {
  demasiadosMensajes: 'Demasiados mensajes seguidos. Espera unos minutos.',
  demasiadosArchivos: 'Subiste muchos archivos seguidos. Espera unos minutos.',
  noEsSesion: 'Ese archivo no es una sesión de conText.',
  archivoPesado: 'Ese archivo pesa mas de 10 MB. Prueba con una foto mas liviana o un PDF mas corto.',
  noRecibiArchivo: 'No pude recibir el archivo. Intenta de nuevo.',
  sesionNoEncontrada: 'Sesion no encontrada. Recarga la pagina.',
  mensajeLargo: 'Tu mensaje es demasiado largo.',
  topeTurnos: `Llegaste a los ${MAX_TURNOS} turnos de esta sesion. Puedes llevarte tu resumen en PDF y, si quieres empezar de nuevo, pulsa "Borrar todo".`,
  pdfLargo: (paginas: number) =>
    `Ese PDF tiene ${paginas} paginas y por ahora leemos hasta ${MAX_PAGINAS_PDF}.`,
  textoVacio: 'Ese archivo de texto esta vacio.',
  textoLargo: (caracteres: number) =>
    `Ese texto tiene ${miles(caracteres, 'es')} caracteres y por ahora leemos hasta ${miles(
      MAX_CARACTERES_TEXTO,
      'es',
    )}, que son unas ${MAX_PAGINAS_PDF} paginas.`,
  sinVideo: 'Por ahora conText no lee videos. Sube una foto, un PDF o un texto.',
  sinAudio:
    'Por ahora conText no lee archivos de audio. Puedes dictar con el microfono o subir una foto, un PDF o un texto.',
  tipoDesconocido:
    'Ese tipo de archivo no lo puedo leer. Sube una foto (JPG, PNG o WEBP), un PDF o un .txt.',
  muchaGente:
    'Hay mucha gente usando conText en este momento. Espera unos segundos y vuelve a enviar tu mensaje.',
  saturado: 'El tutor esta saturado por un momento. Intenta de nuevo en unos segundos.',
  permisos:
    'No pude conectarme al tutor por un problema de permisos del servidor. Avisa al equipo.',
  demora: 'El tutor se demoro demasiado. Vuelve a intentarlo.',
  fallo: 'Algo fallo al conectar con el tutor. Intenta de nuevo en unos segundos.',
};

const en: typeof es = {
  demasiadosMensajes: 'Too many messages in a row. Wait a few minutes.',
  demasiadosArchivos: 'You uploaded many files in a row. Wait a few minutes.',
  noEsSesion: "That file isn't a conText session.",
  archivoPesado: 'That file is over 10 MB. Try a lighter photo or a shorter PDF.',
  noRecibiArchivo: "I couldn't receive the file. Try again.",
  sesionNoEncontrada: 'Session not found. Reload the page.',
  mensajeLargo: 'Your message is too long.',
  topeTurnos: `You reached the ${MAX_TURNOS} turns of this session. You can take your summary as a PDF and, if you want to start over, press "Delete everything".`,
  pdfLargo: (paginas: number) =>
    `That PDF has ${paginas} pages, and for now we read up to ${MAX_PAGINAS_PDF}.`,
  textoVacio: 'That text file is empty.',
  textoLargo: (caracteres: number) =>
    `That text has ${miles(caracteres, 'en')} characters, and for now we read up to ${miles(
      MAX_CARACTERES_TEXTO,
      'en',
    )}, about ${MAX_PAGINAS_PDF} pages.`,
  sinVideo: "conText can't read videos yet. Upload a photo, a PDF or a text.",
  sinAudio:
    "conText can't read audio files yet. You can dictate with the microphone or upload a photo, a PDF or a text.",
  tipoDesconocido: "I can't read that type of file. Upload a photo (JPG, PNG or WEBP), a PDF or a .txt.",
  muchaGente: 'Lots of people are using conText right now. Wait a few seconds and send your message again.',
  saturado: 'The tutor is busy for a moment. Try again in a few seconds.',
  permisos: "I couldn't reach the tutor because of a server permissions problem. Let the team know.",
  demora: 'The tutor took too long. Try again.',
  fallo: 'Something went wrong reaching the tutor. Try again in a few seconds.',
};

export const MENSAJES: Record<Idioma, typeof es> = { es, en };
