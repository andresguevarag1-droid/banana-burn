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
  // 1. La app te ayuda a entrenar poco y constante
  app: { texto: ["Entrena poco,", "pero", "constante."] },
  // 2. Cómo lo hace: tres capturas reales que cambian con cada línea
  como: { texto: ["Qué hacer,", "con cuánto peso", "y cuándo descansar."] },
  // 3. Entrenar para reconstruir el cuerpo
  fuerza: { texto: ["Fuerza para", "reconstruir", "tu cuerpo."] },
  // 4. Y la nutrición
  captura: { texto: ["Y no olvida", "tu nutrición."] },
  zoom: { texto: ["Y cuánto te falta hoy."] },
  // 5. Plan completo con Banana Shield (sin nombrar el medicamento en pantalla)
  shield: { texto: ["Plan completo", "con Banana Shield", "si bajas rápido."] },
  aviso: { texto: [AVISO], aviso: true },
  cierre: { texto: [...BOTON, "BananaBurn"] },
};

/** Versión de 24 s (Reel) y de 15 s (anuncios). */
export const CORTES = {
  "R02_musculo-glp1": [
    ["gancho", 2], ["pierdes", 2], ["app", 2], ["como", 2.5], ["fuerza", 2], ["captura", 2], ["zoom", 2],
    ["shield", 2], ["aviso", 2.5], ["cierre", 3],
  ],
  "R02_musculo-glp1_15s": [
    ["gancho", 2], ["app", 1.5], ["como", 2.5], ["captura", 2], ["shield", 1.5], ["aviso", 2.5], ["cierre", 3],
  ],
};

/** Números permitidos en el texto: solo los 7 días del cierre estándar. Sin gramos ni frecuencias exactas (#215). Los 12 min del primer entreno se ven en la captura real de Hoy. */
export const NUMEROS_PERMITIDOS = ["7"];
