// Secuencia de correos durante la prueba de 7 días (docs/emails/secuencia-prueba.md): quién recibe cada pieza.
// Reglas puras y testeadas (trial-sequence.test.ts); el envío lo hace runReminders (notify-run.ts).
//
// - Día 2, 4 y 6: a las 24, 72 y 120 horas del registro (profiles.created_at), en la corrida del recordatorio de ese día.
//   Cada pieza tiene su ventana de 24 horas: si una corrida falla, la pieza no se recupera después.
// - Solo la prueba normal: nada para cuentas de la beta, staff, testers, cortesías, regalos, condominios ni quien ya pagó.
// - Cobro programado: sigue recibiendo la secuencia, pero no el día en que va (o ya fue) el aviso del cobro
//   (recordatorioCobro, 2 días antes): ese día va solo el aviso. Con el cobro cancelado, cobrado o en otro estado, nada.
// - Respeta la baja: la pieza reemplaza al recordatorio del día, así que exige email_reminders.
import { BETA_ENDS_AT } from "./plans";
import { DAY_MS, reminderDue, signedUpInBeta, type TrialChargeRow } from "./trial";

export type TrialStep = "prueba_d2" | "prueba_d4" | "prueba_d6";
export const TRIAL_STEPS: TrialStep[] = ["prueba_d2", "prueba_d4", "prueba_d6"];

/** Días completos desde el registro → pieza (día 2 = 24 h, día 4 = 72 h, día 6 = 120 h). */
const STEP_BY_FULL_DAYS: Record<number, TrialStep> = { 1: "prueba_d2", 3: "prueba_d4", 5: "prueba_d6" };

/** Día de la prueba (2, 4 o 6) de cada pieza, para la plantilla. */
export const stepDay = (s: TrialStep) => Number(s.slice(-1)) as 2 | 4 | 6;

/** Pieza cuya ventana está abierta ahora para una cuenta creada en `createdAt`. Nada para cuentas de la beta. */
export function trialStepAt(createdAt: string | null | undefined, now = new Date(), betaEndsAt = BETA_ENDS_AT): TrialStep | null {
  const c = Date.parse(createdAt ?? "");
  if (!Number.isFinite(c) || signedUpInBeta(createdAt, betaEndsAt) || c > now.getTime()) return null;
  return STEP_BY_FULL_DAYS[Math.floor((now.getTime() - c) / DAY_MS)] ?? null;
}

export type TrialSequenceCharge = Pick<TrialChargeRow, "status" | "kind" | "charge_at" | "reminder_sent_at">;

export type TrialSequenceInput = {
  createdAt: string | null | undefined;
  now?: Date;
  betaEndsAt?: string;
  /** notification_prefs.email_reminders (la baja de "recordatorios" o "todo" la apaga). */
  emailReminders: boolean;
  /** profiles.plan: un plan asignado (entreno, completo o el histórico pro) ya no está en la prueba. */
  profilePlan: string | null | undefined;
  /** Rol de staff (coach, soporte, admin): acceso completo, no está en la prueba. */
  staff: boolean;
  /** Alguna suscripción que no quedó en 'incomplete': ya pagó un plan. */
  paid: boolean;
  /** Alguna cortesía, regalo, referido o mes gratis de condominio (comp_grants sin revocar). */
  comp: boolean;
  /** Alguna asignación de tester sin revocar (tester_grants). */
  tester: boolean;
  /** Primer cobro con la tarjeta guardada (trial_charges), si existe. */
  charge: TrialSequenceCharge | null;
};

/** ¿Va el aviso del cobro hoy? Toca (reminderDue) o salió en las últimas 24 horas. */
export function chargeReminderToday(row: TrialSequenceCharge | null, now = new Date()): boolean {
  if (!row) return false;
  if (reminderDue(row, now)) return true;
  const sent = Date.parse(row.reminder_sent_at ?? "");
  return Number.isFinite(sent) && now.getTime() - sent < DAY_MS;
}

/** Pieza que le toca a la cuenta ahora, o null. */
export function trialSequenceStep(i: TrialSequenceInput): TrialStep | null {
  const now = i.now ?? new Date();
  const step = trialStepAt(i.createdAt, now, i.betaEndsAt);
  if (!step || !i.emailReminders) return null;
  if (i.staff || i.paid || i.comp || i.tester) return null;
  if (i.profilePlan === "entreno" || i.profilePlan === "completo" || i.profilePlan === "pro") return null;
  if (i.charge) {
    if (i.charge.status !== "scheduled") return null;
    if (chargeReminderToday(i.charge, now)) return null;
  }
  return step;
}
