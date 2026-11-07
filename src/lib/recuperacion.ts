// Recuperación al terminar la prueba sin elegir plan (docs/emails/recuperacion.md): correos de los días 8 y 10 y el
// aviso dentro de la app desde el día 8. Reglas puras (recuperacion-envio.test.tsx, notify-run-recuperacion.test.ts); el envío lo hace runReminders (notify-run.ts)
// y el aviso lo pinta el layout de /app con getRecoveryNotice (recuperacion-server.ts).
//
// - Día 8 = 7 días completos desde el registro (168 h, fin normal de la prueba); día 10 = 9 días completos (216 h). Ventana de 24 horas:
//   si una corrida falla, la pieza no se manda después ni se juntan piezas atrasadas.
// - Solo la prueba normal vencida (trialEndFor ya pasó), sin plan, sin pagos previos, sin cortesías ni condominios, sin tester,
//   sin staff y sin ninguna fila en trial_charges (quien guardó tarjeta ya eligió plan y tiene sus correos de cobro).
//   Las cuentas de la beta quedan fuera: tienen finBeta (beta-fin.ts). Las creadas desde el 1 de enero de 2027 (cardRequiredFor)
//   tampoco: sin tarjeta no tuvieron prueba.
// - El día 8 cuenta lo que hizo con datos reales (trialProgress); sin entrenos terminados habla de su plan, nunca de logros.
// - El correo reemplaza al recordatorio, la reactivación, la racha y el resumen semanal de ese día: nunca dos correos el mismo día.
//
// Embudo: prueba vencida → primer pago (anual primero en el muro). Se mide cruzando notification_log (kind recuperacion_d8/_d10)
// con los primeros pagos (subscriptions y payment_events) en los 7 días después de cada envío.
import { BETA_ENDS_AT } from "./plans";
import { cardRequiredFor } from "./card-required";
import { DAY_MS, signedUpInBeta, trialEndFor } from "./trial";

export type RecoveryStep = "recuperacion_d8" | "recuperacion_d10";
export const RECOVERY_STEPS: RecoveryStep[] = ["recuperacion_d8", "recuperacion_d10"];

/** Días completos desde el registro → pieza (día 8 = 7 días, día 10 = 9 días). */
const STEP_BY_FULL_DAYS: Record<number, RecoveryStep> = { 7: "recuperacion_d8", 9: "recuperacion_d10" };

/** Día (8 o 10) de cada pieza, para la plantilla. */
export const recoveryDay = (s: RecoveryStep) => (s === "recuperacion_d8" ? 8 : 10) as 8 | 10;
/** Llave de idempotencia de Resend: una por cuenta y por correo, para siempre. */
export const recoveryIdemKey = (s: RecoveryStep, userId: string) => `${s}/${userId}`;

/** ¿La prueba normal de esta cuenta ya terminó? Nunca para cuentas de la beta ni sin fecha de alta. */
export function trialExpired(createdAt: string | null | undefined, now = new Date(), betaEndsAt = BETA_ENDS_AT): boolean {
  if (signedUpInBeta(createdAt, betaEndsAt)) return false;
  const end = Date.parse(trialEndFor(createdAt, betaEndsAt) ?? "");
  return Number.isFinite(end) && end <= now.getTime();
}

/** Pieza cuya ventana está abierta ahora para una cuenta creada en `createdAt`, con la prueba ya vencida. */
export function recoveryStepAt(createdAt: string | null | undefined, now = new Date(), betaEndsAt = BETA_ENDS_AT): RecoveryStep | null {
  if (!trialExpired(createdAt, now, betaEndsAt)) return null;
  return STEP_BY_FULL_DAYS[Math.floor((now.getTime() - Date.parse(createdAt!)) / DAY_MS)] ?? null;
}

export type RecoveryAudience = {
  createdAt: string | null | undefined;
  now?: Date;
  betaEndsAt?: string;
  /** profiles.plan: un plan asignado (entreno, completo o el histórico pro) ya tiene acceso. */
  profilePlan: string | null | undefined;
  /** Rol de staff (coach, soporte, admin). */
  staff: boolean;
  /** Alguna suscripción que no quedó en 'incomplete': ya pagó un plan alguna vez. */
  paid: boolean;
  /** Alguna cortesía, regalo, referido o mes gratis de condominio (comp_grants sin revocar). */
  comp: boolean;
  /** Alguna asignación de tester sin revocar (tester_grants). */
  tester: boolean;
  /** Tiene fila en trial_charges (programado, en curso, por confirmar, fallido, reintento, cobrado o cancelado). */
  hasCharge: boolean;
};

/** ¿Es una prueba normal vencida sin elección de plan ni pagos? Sirve al correo y al aviso de la app. */
export function recoveryEligible(a: RecoveryAudience): boolean {
  if (!trialExpired(a.createdAt, a.now, a.betaEndsAt) || cardRequiredFor(a.createdAt)) return false;
  if (a.staff || a.paid || a.comp || a.tester || a.hasCharge) return false;
  return a.profilePlan !== "entreno" && a.profilePlan !== "completo" && a.profilePlan !== "pro";
}

/** Correo que le toca ahora a la cuenta, o null. Respeta la baja de recordatorios (`emailReminders`). */
export function recoveryStep(a: RecoveryAudience & { emailReminders: boolean }): RecoveryStep | null {
  if (!a.emailReminders || !recoveryEligible(a)) return null;
  return recoveryStepAt(a.createdAt, a.now, a.betaEndsAt);
}

/** Lo que la cuenta guardó: entrenos terminados (sin descansos, como el muro de planes), sus series y los kg levantados. */
export type TrialProgress = { workouts: number; sets: number; kg: number };

/**
 * Cifras reales del correo del día 8, a partir de las filas de la cuenta. Series: las hechas de esos entrenos. Kg levantados:
 * la suma de kg × repeticiones de esas series (las de peso corporal no suman). Nada se estima ni se redondea hacia arriba.
 */
export function trialProgress(
  workouts: { id: string; template: string | null; finished_at: string | null }[],
  sets: { workout_id: string; kg: number | string | null; reps: number | null; done: boolean | null }[],
): TrialProgress {
  const ids = new Set(workouts.filter((w) => w.finished_at && w.template !== "descanso").map((w) => w.id));
  const done = sets.filter((x) => ids.has(x.workout_id) && x.done !== false);
  const kg = done.reduce((a, x) => {
    const k = Number(x.kg), r = Number(x.reps);
    return k > 0 && r > 0 ? a + k * r : a;
  }, 0);
  return { workouts: ids.size, sets: done.length, kg: Math.floor(kg) };
}

/** Aviso dentro de la app desde el día 8 (copy del documento). Lo retira el layout al pagar o al dejar de cumplir la audiencia. */
export const RECOVERY_NOTICE = {
  title: "Tu historial sigue aquí",
  lead: "Elige un plan para retomar tu entrenamiento.",
  body: "Tu prueba terminó. Los entrenos, pesos, repeticiones, medidas y fotos que registraste siguen en tu cuenta. Elige un plan en Mi plan para retomar. Si también quieres registrar comidas y consultar calorías y macros, elige Entreno + Nutrición.",
  cta: "Elegir mi plan",
  path: "/app/suscripcion",
} as const;
