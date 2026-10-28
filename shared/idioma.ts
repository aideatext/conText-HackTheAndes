/**
 * Los dos idiomas de conText. El de la interfaz viaja en cada peticion en la
 * cabecera X-Idioma; el tutor, en cambio, contesta en el idioma en que le
 * escribe el estudiante, sea cual sea el de la interfaz.
 */
export const IDIOMAS = ['es', 'en'] as const;
export type Idioma = (typeof IDIOMAS)[number];

export const CABECERA_IDIOMA = 'X-Idioma';

/** Cualquier cosa que no sea "en" es espanol: el idioma de diseno. */
export function aIdioma(valor: unknown): Idioma {
  return typeof valor === 'string' && valor.toLowerCase().startsWith('en') ? 'en' : 'es';
}

export const LOCALE: Record<Idioma, string> = { es: 'es-PE', en: 'en-US' };
