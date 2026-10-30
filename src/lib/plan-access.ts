// Reglas puras de "qué toca a qué plan" para pantallas y acciones. Sin acceso a datos: el acceso de cada
// persona sale de entitlements.ts (`ent.app` y `ent.nutrition`); aquí solo se decide qué pide cada cosa.
// Política: Entreno = entreno, coach de entreno y hábitos, progreso, agua/pasos/sueño, comunidad, retos gratis y niveles.
// Entreno + Nutrición = todo eso más calorías, macros, comidas, recetas, menú, ajuste semanal y Banana Shield.

/** Nombre visible del plan con nutrición (mismo texto que PLANS en plans.ts). */
export const NUTRITION_PLAN_NAME = "Entreno + Nutrición";

/** Mensaje para acciones de nutrición sin el plan que las incluye. */
export const NUTRITION_LOCKED_MSG = `Esto es parte de ${NUTRITION_PLAN_NAME}. Puedes mejorar tu plan en Mi plan.`;

/** Mensaje para acciones de la app sin plan ni prueba vigente. */
export const APP_LOCKED_MSG = "Tu prueba gratis terminó. Elige un plan para seguir registrando.";

export type Need = "app" | "nutrition";

/**
 * Campos del registro diario (acción setDaily) y el plan que piden.
 * Agua, pasos, sueño y energía (la pregunta de "¿cómo llegas hoy?" del entreno) son de Entreno.
 * Calorías y proteína sueltas, fibra y náusea (Banana Shield) son de nutrición.
 */
export const DAILY_NEED = { water: "app", steps: "app", sleep: "app", energy: "app", kcal: "nutrition", protein: "nutrition", fiber: "nutrition", nausea: "nutrition" } as const satisfies Record<string, Need>;

export type DailyNeedField = keyof typeof DAILY_NEED;

/** ¿Puede guardar este campo con estos derechos? Campo desconocido: no. */
export function canSetDaily(field: string, ent: { app: boolean; nutrition: boolean }): boolean {
  if (!Object.hasOwn(DAILY_NEED, field)) return false;
  const need = (DAILY_NEED as Record<string, Need>)[field];
  return need === "nutrition" ? ent.nutrition : ent.app;
}

/** Retos que solo se pueden cumplir con datos de nutrición (meta de proteína personalizada y registro de comidas). */
export function challengeNeedsNutrition(c: { verify: string }): boolean {
  return c.verify === "protein";
}

/**
 * Consejo del coach en Hoy. Con nutrición puede hablar de gramos de proteína (la meta es suya);
 * sin nutrición solo da principios generales, sin números de comida.
 */
export function hoyTip(x: { dow: number; training: boolean; proteinLeft: number; trained: boolean; nutrition: boolean }): string {
  const { dow, training, proteinLeft, trained, nutrition } = x;
  if (!nutrition) {
    if (trained) return "Ya entrenaste. Come algo con proteína en las próximas horas y duerme de 7 a 9 horas: ahí se construye el músculo.";
    if (!training) return "Hoy el músculo crece. Camina, estira 10 minutos y toma agua. Mañana vuelves con todo.";
    if (dow === 5) return "Viernes: termina la semana fuerte. Controla la bajada en cada rep y anota tus cargas.";
    return "Tempo 3-1-1 en cada rep. Bajar lento es donde se construye el músculo.";
  }
  if (trained) return proteinLeft > 30 ? `Ya entrenaste. Ahora cierra la proteína: te faltan unos ${Math.round(proteinLeft)} g (pechuga, atún, yogur griego o huevos).` : "Ya entrenaste y vas bien con la proteína. Duerme 7 a 9 horas: ahí se construye el músculo.";
  if (!training) return "Hoy el músculo crece. Camina, estira 10 min y llega a tu proteína. Mañana vuelves con todo.";
  if (proteinLeft > 100) return "Come tus carbos de 60 a 90 min antes de entrenar: avena con banana, arroz con huevo o pan integral con yogur griego.";
  if (dow === 5) return "Viernes: después del gym, pechuga con arroz y doble ensalada. Si el fin de semana hay salida, máximo 2 tragos.";
  return "Tempo 3-1-1 en cada rep. Bajar lento es donde se construye el músculo.";
}

/** Invitaciones de mejora: solo Entreno pagado, fuera de beta, prueba y cortesía. */
export function canUpsellNutrition(ent: { plan: string; app: boolean; nutrition: boolean; access: string; trial: unknown; status: string; compEndsAt?: string }, beta: boolean): boolean {
  return !beta && ent.plan === "entreno" && ent.app && !ent.nutrition && !ent.trial &&
    ent.access === "subscription" && ["active", "canceling", "past_due"].includes(ent.status) && !ent.compEndsAt;
}

export const NUTRITION_UPSELL_INTERVAL = 7 * 864e5;
export function nutritionUpsellDue(last: string | null, now: number): boolean {
  if (last === null) return true;
  const time = Number(last);
  return Number.isFinite(time) && now - time >= NUTRITION_UPSELL_INTERVAL;
}

export type NutritionUpsellGoal = "protein" | "strength";
