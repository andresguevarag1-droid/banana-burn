// Correos después del primer pago (docs/emails/primer-pago.md): quién recibe cada pieza.
// Reglas puras y testeadas (primer-pago-reglas.test.ts); el envío lo hace runReminders (notify-run.ts).
//
// - Día 1 y día 21: a las 24 horas y a los 21 días completos del primer pago de un plan, en la corrida del recordatorio.
//   Cada pieza tiene su ventana de 24 horas: si una corrida falla, la pieza no se recupera después.
// - Primer pago = la suscripción pagada más antigua de la cuenta (subscriptions con periodo, fuera de 'incomplete'), y solo
//   mientras siga en su primer periodo: una renovación mueve current_period_start y ya no cuenta como primer pago.
// - Solo planes mensuales (Entreno o Entreno + Nutrición) con una suscripción mensual vigente: nada para anuales, pagos sin
//   confirmar, cancelaciones o devoluciones. Cortesías, regalos, condominios y compras de retos o temporadas no son
//   suscripciones, así que nunca cuentan como pago.
// - Respeta la baja: la pieza reemplaza al recordatorio del día, así que exige email_reminders.
//
// Embudo: mueve el paso de primer pago a renovación del segundo mes ($9.99 o $14.99 por renovación, plans.ts). Se mide con
// notification_log (kind primer_pago_d1 y primer_pago_d21; channels vacío = pieza omitida) cruzado con el segundo cobro
// confirmado en payment_events de cada cuenta.
import type { SubscriptionRow } from "./entitlements";
import { DAY_MS } from "./trial";

export type FirstPaymentStep = "primer_pago_d1" | "primer_pago_d21";
export const FIRST_PAYMENT_STEPS: FirstPaymentStep[] = ["primer_pago_d1", "primer_pago_d21"];
export const isFirstPaymentStep = (k: string): k is FirstPaymentStep => (FIRST_PAYMENT_STEPS as string[]).includes(k);

/** Día después del pago (1 o 21) de cada pieza, para la plantilla. */
export const firstPaymentDay = (s: FirstPaymentStep) => (s === "primer_pago_d1" ? 1 : 21) as 1 | 21;

/** Días completos desde el primer pago → pieza. */
const STEP_BY_FULL_DAYS: Record<number, FirstPaymentStep> = { 1: "primer_pago_d1", 21: "primer_pago_d21" };

/**
 * Margen entre la fila (created_at, al iniciar el pago) y el inicio de su primer periodo. Las renovaciones empiezan al
 * menos 28 días después, así que con 3 días no se confunden.
 */
const FIRST_PERIOD_SLACK = 3 * DAY_MS;

export type FirstPaymentSub = Pick<SubscriptionRow, "status" | "plan" | "billing" | "cancel_at_period_end" | "current_period_start" | "current_period_end" | "created_at">;

const ms = (iso: string | null | undefined) => Date.parse(iso ?? "");

/** Suscripción del primer pago: la más antigua que llegó a cobrarse (tiene periodo y no quedó en 'incomplete'). */
export function firstPaidSubscription(subs: FirstPaymentSub[]): FirstPaymentSub | null {
  const paid = subs.filter((s) => s.status !== "incomplete" && Number.isFinite(ms(s.current_period_start)) && Number.isFinite(ms(s.created_at)));
  return paid.sort((a, b) => ms(a.created_at) - ms(b.created_at))[0] ?? null;
}

/** Momento del primer pago (epoch ms) si fue de un plan mensual y la fila sigue en su primer periodo; si no, null. */
export function firstPaymentAt(subs: FirstPaymentSub[]): number | null {
  const first = firstPaidSubscription(subs);
  if (!first || first.billing !== "mes" || (first.plan !== "entreno" && first.plan !== "completo")) return null;
  const start = ms(first.current_period_start), created = ms(first.created_at);
  if (start < created - DAY_MS || start - created > FIRST_PERIOD_SLACK) return null;
  return start;
}

export type FirstPaymentInput = {
  subs: FirstPaymentSub[];
  now?: Date;
  /** notification_prefs.email_reminders (la baja de "recordatorios" o "todo" la apaga). */
  emailReminders: boolean;
};

/** Pieza que le toca a la cuenta ahora, o null. */
export function firstPaymentStep(i: FirstPaymentInput): FirstPaymentStep | null {
  if (!i.emailReminders) return null;
  const now = (i.now ?? new Date()).getTime();
  const at = firstPaymentAt(i.subs);
  if (at == null || at > now) return null;
  const step = STEP_BY_FULL_DAYS[Math.floor((now - at) / DAY_MS)];
  if (!step) return null;
  // Revalidar antes de cada envío: sigue con un plan mensual vigente, sin cancelar y sin cambiarse a anual.
  const current = i.subs.some((s) => s.status === "active" && s.billing === "mes" && !s.cancel_at_period_end && ms(s.current_period_end) > now);
  return current ? step : null;
}
