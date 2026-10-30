// R04 "La Temporada 1 empieza el 9 de noviembre": guion editable de las dos versiones.
// Cada escena dice cuándo empieza (segundos), qué dibuja y TODO el texto que pone en pantalla (`texto`), para que
// render.mjs cuente las palabras y falle si alguna pantalla pasa de 8. Fechas y precios: issue #13 (coinciden con
// src/lib/seasons.ts: SEASON_PRICE_MINOR y la Temporada 1 del 9 nov al 3 ene, inscripciones hasta el 22 nov).

export const FPS = 30;

export const PRECIOS = [
  { deporte: "Running", precio: "$14.99" },
  { deporte: "Raquetas", precio: "$16.99" },
  { deporte: "Cross Training", precio: "$18.99" },
];

const textoPrecios = (n) => ["Precios", ...PRECIOS.slice(0, n).flatMap((p) => [p.deporte, p.precio])].join(" ");

const ESCENA = {
  gancho: { tipo: "gancho", texto: "La Temporada 1 empieza el 9 de noviembre" },
  temporadas: { tipo: "telefono", captura: "temporadas", vista: "arriba", texto: "Running, Raquetas o Cross Training" },
  fecha: { tipo: "telefono", captura: "temporadas", vista: "fecha", texto: "8 semanas con fechas oficiales" },
  running: { tipo: "telefono", captura: "running", vista: "arriba", texto: "Tu ritmo por kilómetro, con GPS" },
  precio1: { tipo: "precios", filas: 1, texto: textoPrecios(1) },
  precio2: { tipo: "precios", filas: 2, texto: textoPrecios(2) },
  precio3: { tipo: "precios", filas: 3, texto: textoPrecios(3) },
  inscripciones: { tipo: "inscripciones", texto: "Inscripciones hasta el 22 nov" },
  anual: { tipo: "anual", texto: "El plan anual incluye 1 temporada gratis" },
  cierre: { tipo: "cierre", texto: "Empieza 7 días gratis en bananaburn.app BananaBurn" },
};

/** Reel de 21 s: un cambio cada 2 s y cierre de 3 s. */
export const REEL = {
  archivo: "R04_temporada-1.mp4",
  duracion: 21,
  escenas: [
    [0, "gancho"], [2, "temporadas"], [4, "fecha"], [6, "running"],
    [8, "precio1"], [10, "precio2"], [12, "precio3"],
    [14, "inscripciones"], [16, "anual"], [18, "cierre"],
  ],
};

/** Anuncio de 15 s: el mismo mensaje con un cambio cada 1.5 s (sin el acercamiento a la fecha, que ya dice el gancho). */
export const ANUNCIO = {
  archivo: "R04_temporada-1_15s.mp4",
  duracion: 15,
  escenas: [
    [0, "gancho"], [1.5, "temporadas"], [3, "running"],
    [4.5, "precio1"], [6, "precio2"], [7.5, "precio3"],
    [9, "inscripciones"], [10.5, "anual"], [12, "cierre"],
  ],
};

/** Escenas de una versión con su inicio y fin en segundos. */
export function linea(version) {
  return version.escenas.map(([inicio, id], i) => ({
    id, inicio, fin: version.escenas[i + 1]?.[0] ?? version.duracion, ...ESCENA[id],
  }));
}

export const palabras = (texto) => texto.split(/\s+/).filter(Boolean).length;
