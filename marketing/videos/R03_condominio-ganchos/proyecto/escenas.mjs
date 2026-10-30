// R03 "Tu condominio tiene gym": guion editable de los 3 ganchos y del cuerpo común.
// Cada escena dice cuándo empieza (segundos), qué dibuja y TODO el texto que pone en pantalla (`texto`), para que
// render.mjs cuente las palabras y falle si alguna pantalla pasa de 8.
// Las 3 versiones solo cambian en los primeros 3 s (GANCHO); del segundo 3 al 15 es el mismo CUERPO, que se codifica
// una sola vez y se pega detrás de cada gancho, así el cuerpo, el cierre y el audio son idénticos byte a byte.

export const FPS = 30;
export const DURACION = 15;
/** Segundo en que termina el gancho y empieza el cuerpo común. */
export const CORTE = 3;

const ESCENA = {
  // R03a: la pregunta.
  a1: { tipo: "planGancho", texto: "Tu condominio tiene gym. ¿Y tu plan?" },
  a2: { tipo: "planPregunta", texto: "¿Y tu plan?" },
  // R03b: lo pagas y no lo usas. La frase completa tiene 9 palabras, así que se parte en las dos pantallas:
  // la primera mitad está desde el cuadro 0 y "y no lo usas" llega a los 1.5 s.
  b1: { tipo: "pagasGancho", texto: "Lo pagas en el mantenimiento" },
  b2: { tipo: "pagasRecibo", texto: "Mantenimiento Agua Seguridad Gimnasio y no lo usas" },
  // R03c: POV del gym vacío.
  c1: { tipo: "povGancho", texto: "POV: el gym del edificio siempre está vacío" },
  c2: { tipo: "povVacio", texto: "siempre está vacío" },

  // Cuerpo común (segundos 3 a 15).
  hoy: {
    tipo: "telefono", captura: "hoy", desde: [300, 391], texto: "Tu rutina de hoy, lista",
    // "Cuerpo completo B / 6 ejercicios, unos 38 minutos" en public/landing/hoy2.png.
    marca: { x: 52, y: 930, w: 676, h: 200, r: 24 },
  },
  peso: {
    tipo: "telefono", captura: "entreno", desde: [391, 391], texto: "Cuánto peso y cuántas repeticiones",
    // "10 a 12 repeticiones con 20 kg" en public/landing/entreno.png: el teléfono se acerca a ese dato.
    marca: { x: 52, y: 1168, w: 604, h: 164, r: 20 }, acerca: 1.55,
  },
  tecnica: {
    tipo: "telefono", captura: "entreno", desde: [0, 60], texto: "Y cómo hacer cada movimiento",
    // Botón "Ver cómo se hace" en public/landing/entreno.png.
    marca: { x: 370, y: 744, w: 362, h: 96, r: 48 },
  },
  equipo: { tipo: "equipo", texto: "Con el equipo de tu gym" },
  tarjeta: { tipo: "tarjeta", texto: "7 días gratis, sin tarjeta" },
  cierre: { tipo: "cierre", texto: "Empieza 7 días gratis en bananaburn.app BananaBurn" },
};

/** Cuerpo común: un cambio cada 1.5 a 2 s y cierre de 3 s. Tiempos relativos al segundo 3. */
export const CUERPO = [[0, "hoy"], [2, "peso"], [4, "tecnica"], [6, "equipo"], [7.5, "tarjeta"], [9, "cierre"]];

/** Las 3 versiones: solo cambia el gancho (dos pantallas de 1.5 s). */
export const VERSIONES = [
  { id: "R03a", archivo: "R03a_condominio-tu-plan", gancho: "Tu condominio tiene gym. ¿Y tu plan?", escenas: [[0, "a1"], [1.5, "a2"]] },
  { id: "R03b", archivo: "R03b_condominio-mantenimiento", gancho: "Lo pagas en el mantenimiento y no lo usas", escenas: [[0, "b1"], [1.5, "b2"]] },
  { id: "R03c", archivo: "R03c_condominio-gym-vacio", gancho: "POV: el gym del edificio siempre está vacío", escenas: [[0, "c1"], [1.5, "c2"]] },
];

/** Escenas de un tramo con su inicio y fin en segundos (relativos al tramo). */
export function linea(escenas, duracion) {
  return escenas.map(([inicio, id], i) => ({
    id, inicio, fin: escenas[i + 1]?.[0] ?? duracion, ...ESCENA[id],
  }));
}

export const palabras = (texto) => texto.split(/\s+/).filter(Boolean).length;
