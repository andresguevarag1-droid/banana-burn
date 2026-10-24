// Modo demo (sin Supabase): estados de ejemplo de la tarjeta y del primer cobro, para ver cada pantalla sin llamar a ONVO.
// /app/suscripcion?demo=beta|prueba|nueva|fallo|procesando|cancelado|vencida. Sin parámetro: "beta" durante la beta y "prueba" después.
import { BETA_ENDS_AT, betaLive } from "./plans";
import { DAY_MS, amountMinorFor, cardStepFor, firstChargeMinor, chargeView, type CardStep, type ChargeView, type TrialChargeRow } from "./trial";

export const DEMO_CARD_VARIANTS = ["beta", "prueba", "nueva", "fallo", "procesando", "cancelado", "vencida"] as const;
export type DemoCardVariant = (typeof DEMO_CARD_VARIANTS)[number];

export type DemoCardState = {
  variant: DemoCardVariant;
  charge: ChargeView | null;
  card: { brand: string | null; last4: string | null; expMonth: number | null; expYear: number | null; active: boolean } | null;
  cardStep: CardStep;
  locked: boolean;
  trial: { endsAt: string; daysLeft: number; beta?: boolean } | null;
};

const iso = (t: number) => new Date(t).toISOString();

function row(over: Partial<TrialChargeRow>, now: number): TrialChargeRow {
  const start = now - 2 * DAY_MS;
  const end = start + 7 * DAY_MS;
  return {
    id: 1, user_id: "demo", idem_key: "trial:00000000-0000-4000-8000-000000000000", kind: "prueba", plan: "completo", billing: "mes",
    amount_minor: amountMinorFor("completo", "mes"), trial_started_at: iso(start), trial_ends_at: iso(end), charge_at: iso(end), next_attempt_at: iso(end),
    status: "scheduled", attempts: 0, last_attempt_at: null, provider_subscription_id: null, last_error: null, reminder_sent_at: null,
    failure_notified_attempt: null, canceled_at: null, created_at: iso(start), updated_at: iso(start), ...over,
  };
}

export function demoCardState(v: string | null | undefined, now = new Date()): DemoCardState {
  const t = now.getTime();
  const beta = betaLive(now);
  const variant: DemoCardVariant = (DEMO_CARD_VARIANTS as readonly string[]).includes(v ?? "") ? (v as DemoCardVariant) : beta ? "beta" : "prueba";
  const card = { brand: "visa", last4: "4242", expMonth: 12, expYear: 2029, active: true };
  const daysLeft = (end: number) => Math.max(1, Math.ceil((end - t) / DAY_MS));
  switch (variant) {
    case "beta": {
      const end = Date.parse(BETA_ENDS_AT);
      return { variant, charge: null, card: null, cardStep: "beta", locked: false, trial: end > t ? { endsAt: BETA_ENDS_AT, daysLeft: daysLeft(end), beta: true } : null };
    }
    case "nueva": {
      // 0043: cuenta nueva en su prueba sin tarjeta: todo abierto y la oferta de dejar la tarjeta lista.
      const end = t + 5 * DAY_MS;
      return { variant, charge: null, card: null, cardStep: "trial", locked: false, trial: { endsAt: iso(end), daysLeft: daysLeft(end) } };
    }
    case "vencida":
      // Prueba sin tarjeta que ya terminó (0043): el muro de planes.
      return { variant, charge: null, card: null, cardStep: "pay", locked: true, trial: null };
    case "fallo": {
      const r = row({ trial_started_at: iso(t - 7.4 * DAY_MS), trial_ends_at: iso(t - 0.4 * DAY_MS), charge_at: iso(t - 0.4 * DAY_MS), status: "retry_scheduled", attempts: 1, next_attempt_at: iso(t + 0.6 * DAY_MS), last_error: "rechazado" }, t);
      return { variant, charge: chargeView(r, now), card, cardStep: cardStepFor({ paidAccess: false, createdAt: r.created_at, row: r, now, betaEndsAt: "2000-01-01T00:00:00Z" }), locked: true, trial: null };
    }
    case "procesando": {
      const r = row({ trial_started_at: iso(t - 7 * DAY_MS - 60_000), trial_ends_at: iso(t - 60_000), charge_at: iso(t - 60_000), status: "pending", attempts: 1, next_attempt_at: null }, t);
      return { variant, charge: chargeView(r, now), card, cardStep: "none", locked: true, trial: null };
    }
    case "cancelado": {
      const r = row({ status: "canceled", next_attempt_at: null, canceled_at: iso(t) }, t);
      return { variant, charge: chargeView(r, now), card: { ...card, active: false }, cardStep: "none", locked: false, trial: { endsAt: r.trial_ends_at, daysLeft: daysLeft(Date.parse(r.trial_ends_at)) } };
    }
    default: {
      const r = row({ promo: "primer_mes_50", amount_minor: firstChargeMinor("completo", "mes", "primer_mes_50") }, t);
      return { variant: "prueba", charge: chargeView(r, now), card, cardStep: "none", locked: false, trial: { endsAt: r.trial_ends_at, daysLeft: daysLeft(Date.parse(r.trial_ends_at)) } };
    }
  }
}
