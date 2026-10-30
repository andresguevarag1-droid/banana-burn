// Guion de R02 "Bajaste rápido... ¿y tu músculo?" como datos.
// render.mjs dibuja cada escena y verificar.mjs revisa las reglas con estos mismos textos.
// Para editar un texto o un tiempo, cámbialo aquí y vuelve a renderizar.

export const FPS = 30;
export const W = 1080;
export const H = 1920;
/** Zona segura: libres 250 px arriba y 350 px abajo. */
export const SAFE = { top: 250, bottom: H - 350 };

export const AVISO = "No sustituye la indicación de tu médico.";
export const BOTON = ["Empieza 7 días gratis", "en bananaburn.app"];

/**
 * Cada escena: id, texto en pantalla (todas las palabras que se ven) y duración en segundos.
 * `aviso: true` marca la escena que muestra el aviso médico.
 */
export const ESCENAS = {
  gancho: { texto: ["Bajaste", "rápido…", "¿y tu músculo?"] },
  pierdes: { texto: ["Bajar rápido", "también se lleva", "músculo."] },
  proteina: { texto: ["Proteína de", "1.2 a 1.6 g", "por kg"] },
  captura: { texto: ["Tu meta de proteína,", "cada día."] },
  zoom: { texto: ["Y cuánto te falta hoy."] },
  fuerza: { texto: ["Fuerza al menos", "3", "veces por semana"] },
  entrena: { texto: ["El músculo", "se cuida", "entrenando."] },
  shield: { texto: ["Banana Shield", "lo arma por ti."] },
  pilares: { texto: ["Más proteína", "Fuerza primero", "Modo suave"] },
  aviso: { texto: [AVISO], aviso: true },
  cierre: { texto: [...BOTON, "BananaBurn"] },
};

/** Versión de 24 s (Reel) y de 15 s (anuncios). */
export const CORTES = {
  "R02_musculo-glp1": [
    ["gancho", 2], ["pierdes", 2], ["proteina", 2], ["captura", 2], ["zoom", 2], ["fuerza", 2],
    ["entrena", 2], ["shield", 2], ["pilares", 2.5], ["aviso", 2.5], ["cierre", 3],
  ],
  "R02_musculo-glp1_15s": [
    ["gancho", 2], ["proteina", 2], ["captura", 2], ["fuerza", 2], ["shield", 1.5], ["aviso", 2.5], ["cierre", 3],
  ],
};

/** Números permitidos en el texto: los del issue #14 y los 7 días del cierre estándar. */
export const NUMEROS_PERMITIDOS = ["1.2", "1.6", "3", "7"];
