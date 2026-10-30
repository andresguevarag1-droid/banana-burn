// Correos del fin de la beta (#109) para las cuentas de la beta que no guardaron tarjeta ni tienen plan pago.
// Quien guardó tarjeta ya recibe recordatorioCobro (trial-billing.ts); a quien no, hasta ahora no le llegaba nada.
// Reglas puras (beta-fin.test.ts); el envío lo hace sendBetaEndEmails en notify-run.ts, dentro del cron de recordatorios.
//
// Embudo: mueve el paso de prueba a primer pago (y a anual) de la cohorte de la beta, que hoy no tiene ningún aviso.
// Se mide con los cobros 'succeeded' en trial_charges y las suscripciones nuevas de cuentas creadas antes de BETA_ENDS_AT,
// cruzados con notification_log (kind beta_fin_*) para saber quién recibió cada correo.
import { BETA_ENDS_AT, BETA_GRACE_UNTIL } from "./plans";
import { DAY_MS, signedUpInBeta } from "./trial";
import { DEFAULT_TZ, localClock } from "./notify";

export type BetaEndStep = 1 | 2 | 3;
/** Tipo en notification_log y en las etiquetas de Resend. */
export const betaEndKind = (step: BetaEndStep) => `beta_fin_${step}` as const;
/** Llave de idempotencia de Resend: una por cuenta y por correo, para siempre. */
export const betaEndIdemKey = (step: BetaEndStep, userId: string) => `${betaEndKind(step)}/${userId}`;

/**
 * Cuándo empieza cada correo (hora de Costa Rica, como las fechas de plans.ts):
 *   1: fin de la beta (1 nov). 2: 4 días después (5 nov). 3: el último día del acceso gratis (7 nov).
 * Cada uno vale hasta que empieza el siguiente; el 3, hasta BETA_GRACE_UNTIL. Si el cron se atrasa, el correo sale al día
 * siguiente, pero nunca uno viejo cuando ya toca el siguiente.
 */
export function betaEndSchedule(betaEndsAt = BETA_ENDS_AT, graceUntil = BETA_GRACE_UNTIL) {
  const start = Date.parse(betaEndsAt), end = Date.parse(graceUntil);
  return [
    { step: 1 as const, from: start, to: start + 4 * DAY_MS },
    { step: 2 as const, from: start + 4 * DAY_MS, to: end - DAY_MS },
    { step: 3 as const, from: end - DAY_MS, to: end },
  ];
}

/** Correo que toca ahora, o null fuera de la semana del 1 al 7 de noviembre. */
export function betaEndStep(now = new Date(), betaEndsAt = BETA_ENDS_AT, graceUntil = BETA_GRACE_UNTIL): BetaEndStep | null {
  const t = now.getTime();
  return betaEndSchedule(betaEndsAt, graceUntil).find((s) => t >= s.from && t < s.to)?.step ?? null;
}

/** Día del que habla el correo (YYYY-MM-DD en Costa Rica): es el `local_day` con el que se reclama en notification_log. */
export function betaEndDay(step: BetaEndStep, betaEndsAt = BETA_ENDS_AT, graceUntil = BETA_GRACE_UNTIL): string {
  const from = betaEndSchedule(betaEndsAt, graceUntil).find((s) => s.step === step)!.from;
  return localClock(new Date(from), DEFAULT_TZ).iso;
}

export type BetaEndAudience = {
  createdAt: string | null | undefined;
  /** notification_prefs.email_reminders (false = se dio de baja de los recordatorios o de todo). */
  emailReminders: boolean;
  /** Tiene fila en payment_methods (tarjeta guardada, activa o no). */
  hasCard: boolean;
  /** Tiene fila en trial_charges (cobro programado, cobrado, cancelado o fallido): ese camino ya tiene sus correos. */
  hasCharge: boolean;
  /** Plan efectivo hoy (suscripción, cortesía, regalo, condominio, staff o manual) según entitlementsFrom. */
  paidAccess: boolean;
};

/** ¿Le toca la secuencia? Solo cuentas de la beta, sin tarjeta, sin cobro, sin plan y sin baja. */
export function betaEndEligible(a: BetaEndAudience, betaEndsAt = BETA_ENDS_AT): boolean {
  if (!a.createdAt || !Number.isFinite(Date.parse(a.createdAt))) return false;
  if (!signedUpInBeta(a.createdAt, betaEndsAt)) return false;
  return a.emailReminders && !a.hasCard && !a.hasCharge && !a.paidAccess;
}
