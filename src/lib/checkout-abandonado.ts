// Correo de checkout abandonado (#237): a quien abrió el pago (app.checkout_started en payment_events, billing.ts o
// tilopay-billing.ts) y no pagó en 1 hora. Reglas puras (checkout-abandonado.test.ts); el envío lo hace
// sendAbandonedCheckoutEmails en notify-run.ts, dentro del cron de recordatorios.
//
// - Mira el último checkout de la persona: sale cuando ya pasó 1 hora y antes de 24 h (en modo diario la corrida siguiente).
//   Si abrió otro checkout hace menos de 1 hora, espera a que pase esa hora.
// - No sale si después del checkout pagó (suscripción con periodo o cobro de la prueba), ni si tiene tarjeta guardada.
// - Una sola vez por persona cada 7 días (notification_log, kind checkout_abandonado). Con email_reminders y fuera de las
//   horas de silencio.
// - El botón abre /app/suscripcion con el mismo plan y periodo (intentPath) y entra sin contraseña (withLoginLinks).
//
// Embudo: pagar. Se mide con app.checkout_started → pago (payment_events / trial_charges 'succeeded') cruzado con
// notification_log (kind checkout_abandonado) para saber quién recibió el correo.
import { parseIntent, type CheckoutIntent } from "./checkout-intent";
import { inQuietHours, localClock } from "./notify";

/** Tipo en notification_log y en las etiquetas de Resend. */
export const ABANDONED_KIND = "checkout_abandonado";
export const ABANDONED_AFTER_MS = 36e5;
/** Un checkout más viejo que esto ya no recibe el correo: el cron solo lee los del último día. */
export const ABANDONED_LOOKBACK_MS = 24 * 36e5;
export const ABANDONED_COOLDOWN_DAYS = 7;

export type CheckoutEvent = { received_at: string; payload: { plan?: unknown; billing?: unknown } | null };
export type PaidSub = { status: string; current_period_start: string | null };

/** El checkout más reciente, o null. */
export function lastCheckout(events: CheckoutEvent[]): CheckoutEvent | null {
  let best: CheckoutEvent | null = null;
  for (const e of events) if (Number.isFinite(Date.parse(e.received_at)) && (!best || Date.parse(e.received_at) > Date.parse(best.received_at))) best = e;
  return best;
}

/** ¿Pagó un plan que sigue vigente o pagó algo desde `since`? Una suscripción sin periodo ('incomplete') no es un pago. */
export function paidSince(subs: PaidSub[], chargeStatuses: string[], since: string): boolean {
  if (chargeStatuses.includes("succeeded")) return true;
  return subs.some((s) => s.current_period_start && (["active", "trialing", "past_due"].includes(s.status) || s.current_period_start >= since));
}

/** Un cobro de la prueba abierto (programado, en curso o fallido) quiere decir que dejó su tarjeta. */
const CLOSED_CHARGE = new Set(["canceled", "superseded"]);
export const cardOnFile = (cards: number, chargeStatuses: string[]) => cards > 0 || chargeStatuses.some((s) => !CLOSED_CHARGE.has(s));

export type AbandonedInput = {
  now: Date;
  checkouts: CheckoutEvent[];
  subs: PaidSub[];
  /** Estados de sus filas de trial_charges. */
  chargeStatuses: string[];
  /** Tarjetas activas en payment_methods. */
  cards: number;
  /** notification_prefs.email_reminders (false = se dio de baja de los recordatorios o de todo). */
  emailReminders: boolean;
  timezone: string;
  quietStart: string | null;
  quietEnd: string | null;
  /** Días locales (local_day) de los checkout_abandonado ya reclamados. */
  sentDays: string[];
};

/** Plan y periodo del correo que hay que mandar en esta corrida, o null. */
export function abandonedCheckoutDue(i: AbandonedInput): CheckoutIntent | null {
  if (!i.emailReminders) return null;
  const last = lastCheckout(i.checkouts);
  if (!last) return null;
  const age = i.now.getTime() - Date.parse(last.received_at);
  if (age < ABANDONED_AFTER_MS || age >= ABANDONED_LOOKBACK_MS) return null;
  const intent = parseIntent(last.payload?.plan, last.payload?.billing);
  if (!intent) return null;
  if (paidSince(i.subs, i.chargeStatuses, last.received_at) || cardOnFile(i.cards, i.chargeStatuses)) return null;
  const c = localClock(i.now, i.timezone);
  if (inQuietHours(c, i.quietStart, i.quietEnd)) return null;
  const from = isoMinusDays(c.iso, ABANDONED_COOLDOWN_DAYS - 1);
  if (i.sentDays.some((d) => d >= from)) return null;
  return intent;
}

const isoMinusDays = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

/** Llave de idempotencia de Resend: una por cuenta y día local. */
export const abandonedIdemKey = (userId: string, day: string) => `${ABANDONED_KIND}/${userId}/${day}`;
