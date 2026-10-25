/**
 * Los topes de la prueba abierta.
 *
 * conText se deja probar por gente que no es el usuario de diseno -quien revisa
 * planes de negocio, quien escribe un ensayo-, porque es la puerta de entrada a
 * los servicios de AIdeaText. Pero una prueba sin tope deja de ser prueba y se
 * vuelve servicio gratis.
 *
 * Se limita por extension y por turnos, nunca por tiempo de reloj: un
 * cronometro castigaria justo la conducta que conText existe para provocar,
 * que es pensar despacio. La extension y los turnos se cuentan, se ven venir y
 * se dicen de antemano.
 *
 * Esto es distinto del limite por IP (express-rate-limit, en index.ts): aquel
 * frena la rafaga, este frena el volumen.
 */

/** Texto plano: ~15.000 caracteres son unas 8 paginas. */
export const MAX_CARACTERES_TEXTO = 15_000;

/** PDF: el mismo tamano, contado en paginas porque de un PDF no sabemos los caracteres. */
export const MAX_PAGINAS_PDF = 8;

/** Turnos de conversacion por sesion. */
export const MAX_TURNOS = 20;

export const CONTACTO = 'first.contact@aideatext.ai';

/** El mismo cierre en los tres mensajes: el tope no es un muro, es una invitacion. */
export function invitaAEscribir(motivo: string): string {
  return `${motivo} conText es una prueba abierta. Si necesitas trabajar con algo mas grande, escribenos a ${CONTACTO}.`;
}
