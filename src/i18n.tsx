/**
 * Los textos de la interfaz en espanol y en ingles.
 *
 * El idioma se elige asi: `?lang=en` en el enlace, si no lo que el estudiante
 * eligio la ultima vez, si no el idioma del navegador. Viaja al servidor en la
 * cabecera X-Idioma para que el resumen del material y los errores lleguen en
 * el mismo idioma. El tutor no depende de esto: contesta en el idioma en que
 * le escriben.
 */
import { useSyncExternalStore } from 'react';
import { aIdioma, LOCALE, type Idioma } from '../shared/idioma';
import { CONTACTO, MAX_CARACTERES_TEXTO, MAX_PAGINAS_PDF } from '../shared/limites';
import type { NodeType, Origin, Relation } from '../shared/types';

const CLAVE = 'context.idioma';

function idiomaInicial(): Idioma {
  try {
    const delEnlace = new URLSearchParams(window.location.search).get('lang');
    if (delEnlace) return aIdioma(delEnlace);
  } catch {}
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado) return aIdioma(guardado);
  } catch {}
  return typeof navigator !== 'undefined' ? aIdioma(navigator.language) : 'es';
}

let actual: Idioma = typeof window !== 'undefined' ? idiomaInicial() : 'es';
const oyentes = new Set<() => void>();

function aplicar(idioma: Idioma) {
  if (typeof document !== 'undefined') document.documentElement.lang = LOCALE[idioma];
}
aplicar(actual);

export function idiomaActual(): Idioma {
  return actual;
}

export function cambiarIdioma(idioma: Idioma) {
  if (idioma === actual) return;
  actual = idioma;
  try {
    localStorage.setItem(CLAVE, idioma);
  } catch {}
  aplicar(idioma);
  oyentes.forEach((f) => f());
}

function suscribir(f: () => void) {
  oyentes.add(f);
  return () => oyentes.delete(f);
}

export function useIdioma(): Idioma {
  return useSyncExternalStore(suscribir, idiomaActual, () => 'es');
}

/** Los textos del idioma actual. Fuera de React: `textos()`. */
export function useT(): Textos {
  return TEXTOS[useIdioma()];
}
export function textos(): Textos {
  return TEXTOS[actual];
}

const es = {
  marca: {
    lema: 'Piensa tus ideas en voz alta y míralas conectarse.',
  },
  cabecera: {
    resumen: 'Llevarme mi resumen',
    idioma: 'Idioma',
  },
  pestanas: { material: 'Material', chat: 'Conversación', grafo: 'Grafo' },
  pie: {
    queNoHace: (
      <>
        Qué <strong>no</strong> hace conText: no te califica y no redacta por ti.
      </>
    ),
    contador: (estudiantes: number, turnos: number, nodos: number) =>
      `· ${estudiantes} estudiantes ya conversaron aquí, ${turnos} veces, y conectaron ${nodos} ideas.`,
    consulta: 'Cualquier consulta:',
  },
  errores: {
    noEsSesion: 'Ese archivo no es una sesión de conText.',
    noBorre: 'No pude borrar la sesión. Intenta de nuevo.',
    sinServidor: 'No pude conectar con el servidor.',
    conexionCortada: 'Se cortó la conexión. Intenta de nuevo.',
    noLeiArchivo: 'No pude leer ese archivo.',
    noPdf: 'No pude armar el PDF. Intenta de nuevo.',
  },
  material: {
    titulo: 'Tu material',
    verCompleto: 'Ver completo',
    loQueEntendio: 'Lo que Claude entendió de tu material',
    conversar: 'Conversar sobre esto',
    leyendo: 'Leyendo tu material…',
    vacio: 'Cuando subas tu material, aquí lo verás completo junto con lo que Claude entendió de él.',
    subir: 'Sube tu material',
    cambiar: 'Cambiar de material',
    arrastra: 'Arrastra una foto, un PDF o un .txt',
    topes: `Hasta 10 MB · ${MAX_PAGINAS_PDF} páginas de PDF · ${MAX_CARACTERES_TEXTO.toLocaleString(
      LOCALE.es,
    )} caracteres de texto`,
    elegir: 'Elegir archivo',
    foto: 'Tomar foto',
    avisoTitulo: 'Antes de subir: quítale los datos sensibles.',
    avisoTexto: (
      <>
        Nombres de personas, montos, direcciones, razones sociales. conText piensa igual de bien sin
        ellos. Si lo que traes es un texto, súbelo en <strong>.txt</strong>.
      </>
    ),
  },
  vista: {
    alt: (nombre: string | null) => (nombre ? `Material: ${nombre}` : 'Material que subiste'),
    noDibujo: 'No pude dibujar la primera página.',
    pagina1: 'página 1',
    texto: 'Texto',
  },
  sesion: {
    titulo: 'Tu sesión es tuya',
    explica: (
      <>
        Si pulsas <strong>Borrar todo</strong>, tu conversación, tu grafo y tu archivo desaparecen
        del servidor en el momento. Si no lo pulsas, se borran solos a los 7 días. Guárdate el JSON
        y podrás retomar la conversación cuando quieras.
      </>
    ),
    guardar: 'Guardar sesión',
    retomar: 'Retomar',
    borrar: 'Borrar todo',
    confirmar: 'Sí, borrar todo',
    cancelar: 'Cancelar',
  },
  chat: {
    titulo: 'Conversación',
    tutorHabla: 'El tutor habla',
    tuMaterial: 'Tu material',
    vacio1: 'Cuéntame qué estás estudiando y empezamos.',
    vacio2: 'Si subes una foto de tu cuaderno, conversamos sobre eso.',
    detener: 'Detener',
    detenerLectura: 'Detener la lectura',
    leer: 'Leer en voz alta',
    quedan: (n: number) =>
      `Te quedan ${n} ${n === 1 ? 'turno' : 'turnos'} en esta prueba. Puedes llevarte tu resumen en PDF cuando quieras.`,
    final:
      'Llegaste al final de esta prueba. Llévate tu resumen en PDF, y si quieres empezar de nuevo pulsa “Borrar todo”.',
    escucho: 'Te escucho…',
    conectando: 'Conectando…',
    escribe: 'Escribe tu mensaje…',
    dejarDictar: 'Dejar de dictar',
    dictar: 'Dictar con el micrófono',
    enviar: 'Enviar',
  },
  voz: {
    sinPermiso: 'No me diste permiso para usar el micrófono.',
    noEscuche: 'No pude escucharte. Prueba otra vez o escribe tu mensaje.',
  },
  grafo: {
    titulo: 'Tus ideas conectadas',
    misConexiones: 'Mis conexiones',
    bajarJson: 'Descargar el grafo como JSON',
    bajarPng: 'Descargar el grafo como imagen PNG',
    vacio: 'Aquí vas a ver, en vivo, las ideas que conectes mientras conversas.',
    aria: 'Grafo de las ideas conectadas',
    archivo: 'mi-grafo-context',
  },
  metricas: {
    mias: 'ideas que conectaste tú',
    conexiones: 'conexiones entre ideas',
    central: 'la idea que más conecta',
    sueltas: 'ideas aún sueltas',
  },
  origen: { material: 'Del material', estudiante: 'Mis ideas', tutor: 'Del tutor' } as Record<
    Origin,
    string
  >,
  tipo: {
    concepto: 'concepto',
    afirmacion: 'afirmación',
    evidencia: 'evidencia',
    ejemplo: 'ejemplo',
    pregunta: 'pregunta',
  } as Record<NodeType, string>,
  relacion: {
    apoya: 'apoya',
    contradice: 'contradice',
    causa: 'causa',
    ejemplifica: 'ejemplifica',
    se_relaciona_con: 'se relaciona con',
    responde_a: 'responde a',
  } as Record<Relation, string>,
  pdf: {
    subtitulo: 'Las ideas que conectaste',
    material: 'Tu material',
    mapa: 'Cómo quedó tu mapa',
    indicadores: (m: { mias: number; enlaces: number; total: number; sueltas: number }) =>
      `Ideas que conectaste tú: ${m.mias}  ·  Conexiones: ${m.enlaces}  ·  Ideas en total: ${m.total}  ·  Aún sueltas: ${m.sueltas}%`,
    central: (idea: string) => `La idea que más conecta: ${idea}`,
    grafo: 'Tu grafo de ideas',
    pensaste: 'Lo que pensaste tú',
    conversacion: 'Tu conversación',
    tu: 'Tú',
    tutor: 'Tutor',
    pie: (pagina: number, total: number) =>
      `conText · no te califica y no redacta por ti · ${pagina}/${total}`,
    archivo: 'mi-resumen-context.pdf',
  },
  archivoSesion: 'mi-sesion-context.json',
  contacto: CONTACTO,
};

export type Textos = typeof es;

const en: Textos = {
  marca: {
    lema: 'Think your ideas out loud and watch them connect.',
  },
  cabecera: {
    resumen: 'Take my summary',
    idioma: 'Language',
  },
  pestanas: { material: 'Material', chat: 'Conversation', grafo: 'Graph' },
  pie: {
    queNoHace: (
      <>
        What conText does <strong>not</strong> do: it doesn't grade you and doesn't write for you.
      </>
    ),
    contador: (estudiantes: number, turnos: number, nodos: number) =>
      `· ${estudiantes} students have talked here, ${turnos} times, and connected ${nodos} ideas.`,
    consulta: 'Any questions:',
  },
  errores: {
    noEsSesion: "That file isn't a conText session.",
    noBorre: "I couldn't delete the session. Try again.",
    sinServidor: "I couldn't connect to the server.",
    conexionCortada: 'The connection dropped. Try again.',
    noLeiArchivo: "I couldn't read that file.",
    noPdf: "I couldn't build the PDF. Try again.",
  },
  material: {
    titulo: 'Your material',
    verCompleto: 'See it all',
    loQueEntendio: 'What Claude understood from your material',
    conversar: 'Talk about this',
    leyendo: 'Reading your material…',
    vacio: "Once you upload your material, you'll see it here in full, along with what Claude understood from it.",
    subir: 'Upload your material',
    cambiar: 'Change material',
    arrastra: 'Drag in a photo, a PDF or a .txt',
    topes: `Up to 10 MB · ${MAX_PAGINAS_PDF} PDF pages · ${MAX_CARACTERES_TEXTO.toLocaleString(
      LOCALE.en,
    )} characters of text`,
    elegir: 'Choose file',
    foto: 'Take photo',
    avisoTitulo: 'Before uploading: remove sensitive data.',
    avisoTexto: (
      <>
        Names of people, amounts, addresses, company names. conText thinks just as well without
        them. If what you bring is a text, upload it as a <strong>.txt</strong>.
      </>
    ),
  },
  vista: {
    alt: (nombre: string | null) => (nombre ? `Material: ${nombre}` : 'Material you uploaded'),
    noDibujo: "I couldn't draw the first page.",
    pagina1: 'page 1',
    texto: 'Text',
  },
  sesion: {
    titulo: 'Your session is yours',
    explica: (
      <>
        If you press <strong>Delete everything</strong>, your conversation, your graph and your file
        disappear from the server right away. If you don't, they delete themselves after 7 days.
        Save the JSON and you can pick the conversation back up whenever you like.
      </>
    ),
    guardar: 'Save session',
    retomar: 'Resume',
    borrar: 'Delete everything',
    confirmar: 'Yes, delete everything',
    cancelar: 'Cancel',
  },
  chat: {
    titulo: 'Conversation',
    tutorHabla: 'The tutor speaks',
    tuMaterial: 'Your material',
    vacio1: "Tell me what you're studying and let's begin.",
    vacio2: "If you upload a photo of your notebook, we'll talk about it.",
    detener: 'Stop',
    detenerLectura: 'Stop reading aloud',
    leer: 'Read aloud',
    quedan: (n: number) =>
      `You have ${n} ${n === 1 ? 'turn' : 'turns'} left in this trial. You can take your summary as a PDF whenever you like.`,
    final:
      'You reached the end of this trial. Take your summary as a PDF, and if you want to start over press “Delete everything”.',
    escucho: "I'm listening…",
    conectando: 'Connecting…',
    escribe: 'Write your message…',
    dejarDictar: 'Stop dictating',
    dictar: 'Dictate with the microphone',
    enviar: 'Send',
  },
  voz: {
    sinPermiso: "You didn't give me permission to use the microphone.",
    noEscuche: "I couldn't hear you. Try again or type your message.",
  },
  grafo: {
    titulo: 'Your connected ideas',
    misConexiones: 'My connections',
    bajarJson: 'Download the graph as JSON',
    bajarPng: 'Download the graph as a PNG image',
    vacio: "Here you'll see, live, the ideas you connect as you talk.",
    aria: 'Graph of connected ideas',
    archivo: 'my-context-graph',
  },
  metricas: {
    mias: 'ideas you connected',
    conexiones: 'connections between ideas',
    central: 'the most connected idea',
    sueltas: 'ideas still loose',
  },
  origen: { material: 'From the material', estudiante: 'My ideas', tutor: 'From the tutor' },
  tipo: {
    concepto: 'concept',
    afirmacion: 'claim',
    evidencia: 'evidence',
    ejemplo: 'example',
    pregunta: 'question',
  },
  relacion: {
    apoya: 'supports',
    contradice: 'contradicts',
    causa: 'causes',
    ejemplifica: 'exemplifies',
    se_relaciona_con: 'relates to',
    responde_a: 'answers',
  },
  pdf: {
    subtitulo: 'The ideas you connected',
    material: 'Your material',
    mapa: 'How your map turned out',
    indicadores: (m: { mias: number; enlaces: number; total: number; sueltas: number }) =>
      `Ideas you connected: ${m.mias}  ·  Connections: ${m.enlaces}  ·  Total ideas: ${m.total}  ·  Still loose: ${m.sueltas}%`,
    central: (idea: string) => `The most connected idea: ${idea}`,
    grafo: 'Your idea graph',
    pensaste: 'What you thought',
    conversacion: 'Your conversation',
    tu: 'You',
    tutor: 'Tutor',
    pie: (pagina: number, total: number) =>
      `conText · doesn't grade you and doesn't write for you · ${pagina}/${total}`,
    archivo: 'my-context-summary.pdf',
  },
  archivoSesion: 'my-context-session.json',
  contacto: CONTACTO,
};

export const TEXTOS: Record<Idioma, Textos> = { es, en };
