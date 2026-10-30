// E03 "Sientes que todos te miran": guion editable y plan de animación de cada toma.
// Formato de V02 (monos que hablan): sin voz ni música; los monos "hablan" con globos de diálogo y un rótulo ink
// hace de narrador. Cada escena dice qué toma usa, cómo se mueve la cámara y TODO el texto que pone en pantalla
// (`texto`), para que render.mjs cuente las palabras y falle si alguna pantalla pasa de 8.

export const FPS = 30;

/**
 * Tomas: una imagen fija de Higgsfield por toma, en proyecto/tomas/T1.png a T6.png (9:16). Los prompts están en
 * ../prompts-higgsfield.md. `personajes` marca dónde queda la cabeza de cada mono en la imagen (0 a 1 del ancho y del
 * alto): los globos apuntan ahí y la cámara se acerca ahí. Si la imagen generada los deja en otro lugar, se corrigen
 * aquí y no en el render.
 */
export const TOMAS = {
  T1: {
    titulo: "El Nuevo en la puerta del gym",
    personajes: { nuevo: [0.49, 0.41] },
  },
  T2: {
    titulo: "Pared de espejos: solo él, repetido",
    personajes: { nuevo: [0.18, 0.36] },
  },
  T3: {
    titulo: "Coach Banana le pone la mano en el hombro",
    personajes: { nuevo: [0.33, 0.43], coach: [0.66, 0.31] },
  },
  T4: {
    titulo: "Gym abierto: Coach Platanita al fondo, en lo suyo",
    personajes: { nuevo: [0.53, 0.53], coach: [0.84, 0.39], platanita: [0.33, 0.27] },
  },
  T5: {
    titulo: "El Nuevo hace su primera serie",
    personajes: { nuevo: [0.39, 0.45], coach: [0.66, 0.26] },
  },
  T6: {
    titulo: "Choque de puños con Coach Banana",
    personajes: { nuevo: [0.27, 0.41], coach: [0.74, 0.38] },
  },
};

/**
 * Cámara: [centro x, centro y, zoom] al empezar (`de`) y al terminar (`a`) la escena, sobre la toma ajustada a
 * 1080x1920 (zoom 1 = toma completa). `golpe` = el acercamiento pasa en 300 ms (ease-out) y luego se queda casi quieto;
 * sin `golpe` el movimiento es lento y parejo toda la escena.
 * Textos: `pov` (gancho, completo desde el cuadro 0), `globo` (habla un mono; la cola apunta a su cabeza) y
 * `rotulo` (narrador, tarjeta ink).
 */
const ESCENA = {
  gancho: {
    toma: "T1", camara: { de: [0.5, 0.5, 1], a: [0.5, 0.5, 1.04] },
    textos: [{ tipo: "pov", texto: "POV: sientes que todos te miran" }],
  },
  cara: {
    toma: "T1", camara: { de: [0.5, 0.5, 1.04], a: [0.49, 0.45, 1.6], golpe: true },
    textos: [{ tipo: "globo", quien: "nuevo", texto: "¿Me están mirando todos?" }],
  },
  espejos: {
    toma: "T2", camara: { de: [0.5, 0.5, 1], a: [0.48, 0.5, 1.05] },
    textos: [{ tipo: "globo", quien: "nuevo", texto: "Y encima, espejos por todos lados" }],
  },
  spoiler: {
    toma: "T2", camara: { de: [0.36, 0.42, 1.35], a: [0.64, 0.42, 1.35] },
    textos: [{ tipo: "rotulo", texto: "Spoiler: el único que te mira eres tú" }],
  },
  coach: {
    toma: "T3", camara: { de: [0.5, 0.5, 1.08], a: [0.5, 0.5, 1] },
    textos: [{ tipo: "globo", quien: "coach", texto: "Nadie te está mirando. Respira." }],
  },
  cadaQuien: {
    toma: "T4", camara: { de: [0.5, 0.5, 1], a: [0.52, 0.5, 1.05] },
    textos: [{ tipo: "globo", quien: "coach", texto: "Cada quien viene a lo suyo." }],
  },
  platanita: {
    toma: "T4", camara: { de: [0.52, 0.5, 1.05], a: [0.34, 0.33, 1.6], golpe: true },
    textos: [{ tipo: "rotulo", texto: "Ella está en su serie, no en ti" }],
  },
  telefono: {
    toma: null, captura: "entreno",
    textos: [{ tipo: "rotulo", texto: "Tú, a lo tuyo: tu serie de hoy" }],
  },
  serie: {
    toma: "T5", camara: { de: [0.5, 0.52, 1.12], a: [0.5, 0.5, 1] },
    textos: [{ tipo: "rotulo", texto: "Primera serie. Nadie miró." }],
  },
  todos: {
    toma: "T6", camara: { de: [0.5, 0.5, 1], a: [0.52, 0.48, 1.06] },
    textos: [{ tipo: "globo", quien: "coach", texto: "Todos empezamos así." }],
  },
  cierre: {
    toma: null,
    textos: [{ tipo: "cierre", texto: "Empieza 7 días gratis en bananaburn.app BananaBurn" }],
  },
};
for (const [id, e] of Object.entries(ESCENA)) {
  e.id = id;
  e.texto = e.textos.map((x) => x.texto).join(" ");
}

/** Reel de 23 s (sin las 6 tomas en proyecto/tomas/, el render sale como animatic con cuadros de referencia): un cambio cada 2 s y cierre de 3 s. */
export const REEL = {
  archivo: "E03_todos-te-miran",
  duracion: 23,
  escenas: [
    [0, "gancho"], [2, "cara"], [4, "espejos"], [6, "spoiler"], [8, "coach"], [10, "cadaQuien"],
    [12, "platanita"], [14, "telefono"], [16, "serie"], [18, "todos"], [20, "cierre"],
  ],
};

/** Anuncio de 15 s: el mismo chiste con un cambio cada 1.5 s (sin el globo de los espejos ni el acercamiento a Platanita). */
export const ANUNCIO = {
  archivo: "E03_todos-te-miran_15s",
  duracion: 15,
  escenas: [
    [0, "gancho"], [1.5, "cara"], [3, "spoiler"], [4.5, "coach"], [6, "cadaQuien"],
    [7.5, "telefono"], [9, "serie"], [10.5, "todos"], [12, "cierre"],
  ],
};

/** Escenas de una versión con su inicio y fin en segundos. */
export function linea(version) {
  return version.escenas.map(([inicio, id], i) => ({
    inicio, fin: version.escenas[i + 1]?.[0] ?? version.duracion, ...ESCENA[id],
  }));
}

export const palabras = (texto) => texto.split(/\s+/).filter(Boolean).length;
