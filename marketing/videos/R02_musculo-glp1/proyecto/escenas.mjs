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
 * Cada escena: texto en pantalla (todas las palabras que se ven).
 * `aviso: true` marca la escena que muestra el aviso médico.
 */
export const ESCENAS = {
  gancho: { texto: ["Bajaste", "rápido…", "¿y tu músculo?"] },
  pierdes: { texto: ["Bajar rápido", "también se lleva", "el músculo."] },
  app: { texto: ["Entrena poco,", "pero constante,", "con Banana Burn."] },
  web: { texto: ["La app que", "no tienes que descargar.", "bananaburn.app"] },
  como: { texto: ["Qué hacer,", "con cuánto peso", "y cuánto descansar."] },
  fuerza: { texto: ["Cada entreno te ayuda", "a reconstruir", "tu cuerpo."] },
  captura: { texto: ["Y te ayudamos", "con tu nutrición."] },
  zoom: { texto: ["Cuánta proteína", "te falta hoy."] },
  shield: { texto: ["El plan completo", "con Banana Shield."] },
  cuida: { texto: ["Y cuida tu músculo", "mientras bajas."] },
  plan: { texto: ["Tu nutrición,", "el plan completo:", "Banana Shield."] },
  aviso: { texto: [AVISO], aviso: true },
  cierre: { texto: [...BOTON, "BananaBurn"] },
};

/**
 * Cortes. Los tiempos siguen a la voz (Higgsfield, voz Julian, ElevenLabs v4), que suena de corrido desde el cuadro 0.
 * Cada escena: [id, duración en s, pasos]. `pasos` son los segundos (dentro de la escena) en que entra cada frase de la voz;
 * cada paso es un cambio visual, así que hay un cambio cada 1 a 2.5 s aunque la escena dure más.
 */
export const CORTES = {
  // Reel (35 s): audio/voz-reel.mp3
  "R02_musculo-glp1": [
    ["gancho", 3.3, [0, 1.5]], ["pierdes", 2.73, [0, 1.3]], ["app", 4.3, [0, 1.22, 3.1]], ["web", 2.64, [0, 1.0]],
    ["como", 3.73, [0, 1.3, 2.45]], ["fuerza", 2.8, [0, 1.2]], ["captura", 2.03, [0]], ["zoom", 3.37, [0, 1.6]],
    ["shield", 2.23, [0]], ["cuida", 2.17, [0]], ["aviso", 2.57, [0]], ["cierre", 3.2, [0]],
  ],
  // Anuncio (19 s): audio/voz-anuncio.mp3
  "R02_musculo-glp1_anuncio": [
    ["gancho", 3.33, [0, 1.62]], ["app", 3.14, [0, 1.0, 2.0]], ["como", 3.5, [0, 1.15, 2.15]],
    ["plan", 3.62, [0, 1.22, 2.47]], ["aviso", 2.47, [0]], ["cierre", 3.09, [0]],
  ],
};

/** Voz de cada corte (MP3 de Higgsfield, en la carpeta de arriba). */
export const VOZ = {
  "R02_musculo-glp1": "audio/voz-reel.mp3",
  "R02_musculo-glp1_anuncio": "audio/voz-anuncio.mp3",
};

/** Números permitidos en el texto: solo los 7 días del cierre estándar. Sin gramos ni frecuencias exactas (#215). Los 12 min del primer entreno se ven en la captura real de Hoy. */
export const NUMEROS_PERMITIDOS = ["7"];
