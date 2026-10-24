// Primeros pasos: lo que una persona nueva hace en su primera semana para entender la app haciendo, no leyendo.
// Puro (sin datos ni React) para poder probar qué ve cada quien. El estado vive en profiles.learn_keys (0046) y, en demo o
// sin la migración, en este dispositivo (localStorage). Algunas señales salen de datos reales (entrenos, pesajes, chat).
//
// Reglas de los textos (libro de marca): español neutro de tú, frases cortas, una idea por frase, sin emojis, sin rayas
// largas, sin cadenas con "·", sin hablar de inteligencia artificial, números en es-419.

/** Claves guardadas (formato de la base: ^[a-z0-9-]{1,24}$, máximo 64 por persona). */
export const LEARN_KEY = /^[a-z0-9-]{1,24}$/;
export const LEARN_MAX = 64;
export const isLearnKey = (k: unknown): k is string => typeof k === "string" && LEARN_KEY.test(k);

/** Versiones de los recorridos guiados: súbelas para volver a mostrarlos a todos. */
export const TOUR_KEYS = { hoy: "tour-hoy-1", entrenar: "tour-entrenar-1" } as const;
export type TourId = keyof typeof TOUR_KEYS;

export type StepId = "semana" | "tecnica" | "entreno" | "peso" | "coach" | "avisos" | "leccion" | "instalar";

export type FirstStep = {
  id: StepId;
  title: string;
  /** Por qué importa, en una frase simple. */
  why: string;
  /** El botón lleva directo a la pantalla. */
  href: string;
  cta: string;
  done: boolean;
};

/** Señales reales que marcan pasos como hechos aunque la persona no toque el botón de la lista. */
export type StepSignals = {
  /** Claves guardadas (learn_keys o el respaldo local). */
  keys: readonly string[];
  workouts: number;
  /** Pesajes registrados. El primero lo deja la bienvenida, así que cuenta desde 2. */
  weights: number;
  coachMessages: number;
  /** Avisos activos en algún dispositivo, o permiso de notificaciones ya concedido en este. */
  push: boolean;
  /** ¿Este dispositivo puede recibir avisos? En iPhone sin instalar la app, no: ese paso se cambia por una lección. */
  pushSupported: boolean;
  /** Celular o tableta: ahí tiene sentido instalar la LinkApp. En computadora el paso no aparece. */
  mobile?: boolean;
  /** La app ya corre instalada (display-mode standalone o navigator.standalone). */
  standalone?: boolean;
};

export const STEP_KEY: Record<StepId, string> = {
  semana: "pp-semana", tecnica: "pp-tecnica", entreno: "pp-entreno", peso: "pp-peso", coach: "pp-coach", avisos: "pp-avisos", leccion: "pp-leccion", instalar: "pp-instalar",
};
/** La persona cerró la tarjeta, o ya vio la celebración final. */
export const PP_HIDDEN = "pp-oculto";
export const PP_CELEBRATED = "pp-listo";

/**
 * Los pasos de la primera semana, en el orden en que tienen sentido: primero mirar, luego hacer.
 * `coach`: nombre del coach que acompaña (Coach Banana o Coach Platanita).
 */
export function firstSteps(s: StepSignals, coach = "Coach Banana"): FirstStep[] {
  const has = (id: StepId) => s.keys.includes(STEP_KEY[id]);
  const steps: FirstStep[] = [
    { id: "semana", title: "Mira tu plan de la semana", why: "Ahí ves qué día toca entrenar y qué ejercicios hay.", href: "/app/entrenar", cta: "Ver mi semana", done: has("semana") },
    { id: "tecnica", title: "Aprende a ver un ejercicio", why: "Cada ejercicio trae un dibujo que se mueve y los pasos para hacerlo bien.", href: "/app/entrenar#ejercicios", cta: "Ver un ejercicio", done: has("tecnica") },
    { id: "entreno", title: "Haz tu primer entrenamiento", why: "La app te lleva paso a paso: qué hacer, cuántas veces y cuándo descansar.", href: "/app/entreno", cta: "Empezar", done: has("entreno") || s.workouts > 0 },
    { id: "peso", title: "Registra tu peso", why: "Con tu peso de cada semana, la app ajusta tu plan.", href: "/app#peso", cta: "Registrar peso", done: has("peso") || s.weights > 1 },
    { id: "coach", title: `Pregúntale algo a ${coach}`, why: "Es tu entrenador 24/7: te responde dudas de tu entreno cuando quieras.", href: "/app/coach", cta: "Preguntar", done: has("coach") || s.coachMessages > 0 },
  ];
  // Celular: instalar la LinkApp (el nombre registrado de la app instalable) en vez de los avisos, que en iPhone solo
  // funcionan con la app instalada y además ya se ofrecen arriba en Hoy. Así la lista queda en 6 pasos.
  if (s.mobile) steps.push({ id: "instalar", title: "Instala tu LinkApp en tu pantalla de inicio", why: "Así abres Banana Burn con un toque, como cualquier app.", href: "#instalar", cta: "Instalar", done: has("instalar") || !!s.standalone });
  else if (s.pushSupported) steps.push({ id: "avisos", title: "Activa los recordatorios", why: "Te avisamos el día que toca entrenar, para que no se te pase.", href: "/app/perfil#avisos", cta: "Activar", done: has("avisos") || s.push });
  else steps.push({ id: "leccion", title: "Lee tu primera lección", why: "En 30 segundos entiendes cómo funciona tu plan.", href: "/app/aprende/como-funciona", cta: "Leer", done: has("leccion") || s.keys.some((k) => k.startsWith("lec-")) });
  return steps;
}

export type ChecklistState = { steps: FirstStep[]; done: number; total: number; complete: boolean; visible: boolean; celebrate: boolean };

/** ¿Se muestra la tarjeta? Hasta completarla (con una celebración una vez) o hasta que la cierre. */
export function checklistState(s: StepSignals, coach?: string): ChecklistState {
  const steps = firstSteps(s, coach);
  const done = steps.filter((x) => x.done).length;
  const complete = done === steps.length;
  const hidden = s.keys.includes(PP_HIDDEN) || s.keys.includes(PP_CELEBRATED);
  return { steps, done, total: steps.length, complete, visible: !hidden, celebrate: complete && !hidden };
}

/** El siguiente paso pendiente: va destacado arriba ("Ahora te toca"). */
export const nextStep = (steps: FirstStep[]) => steps.find((x) => !x.done) ?? null;

/** ¿Se abre solo el recorrido de esta pantalla? Una vez por versión, y nunca encima de la guía o de otra ventana. */
export function shouldAutoTour(x: { keys: readonly string[]; tour: TourId; blocked: boolean }): boolean {
  return !x.blocked && !x.keys.includes(TOUR_KEYS[x.tour]);
}

/** Une claves sin repetir y sin pasar el máximo (igual que la base). */
export function addKey(keys: readonly string[], k: string): string[] {
  if (!isLearnKey(k) || keys.includes(k) || keys.length >= LEARN_MAX) return [...keys];
  return [...keys, k];
}

/** Lo que la app hará la próxima vez con un ejercicio, en una frase simple (sale de prescribe()). Null si no aplica. */
export function nextTimeLine(rx: { type: string; kg: number | null; reps: number[] }, lo: number): string | null {
  const kg = rx.kg != null ? rx.kg.toLocaleString("es-419", { maximumFractionDigits: 2 }) : null;
  switch (rx.type) {
    case "up": return kg ? `Sube a ${kg} kg y vuelve a ${lo} repeticiones.` : `Busca ${rx.reps[0]} repeticiones.`;
    case "reps": return "Mismo peso, una repetición más por serie.";
    case "hold": return "Mismo peso y repeticiones, con técnica más limpia.";
    case "reset": return kg ? `Baja a ${kg} kg para retomar con buena técnica.` : null;
    default: return null;
  }
}
