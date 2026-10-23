// Prueba de 7 días con tarjeta guardada y cobro el día 7. Reglas puras y testeadas (trial.test.ts).
// La base repite la regla de acceso en public._trial_live() (0026) y el servidor la aplica en trial-billing.ts.
//
// Decisiones del dueño (oct 2026):
//   - Desde el fin de la beta (BETA_ENDS_AT, 1 nov 2026) la prueba pide tarjeta. Antes, como siempre: sin tarjeta.
//   - La tarjeta se GUARDA en ONVO (no se cobra). La prueba da todo, como antes. Al terminar los 7 días se cobra el plan
//     elegido: ONVO no documenta pruebas nativas, así que el primer cobro lo programamos nosotros (trial_charges).
//   - Si el cobro del día 7 falla: muro de planes, aviso para cambiar la tarjeta y un solo reintento automático al día 8.
//   - Cancelar antes del día 7: no se cobra y el acceso sigue hasta el fin de la prueba.
//   - Cuentas de la beta: sin días extra. Si guardan tarjeta antes del fin de la beta, se cobra al terminar la beta;
//     si la guardan después, se cobra en ese momento.
//   - Aviso 2 días antes del cobro (día 5), por correo, push y en la app.
import { BETA_ENDS_AT, PLANS, TRIAL_DAYS, type Billing, type PlanId } from "./plans";

export const DAY_MS = 864e5;
/** Aviso antes del cobro: "En 2 días se cobra tu plan". */
export const REMINDER_DAYS_BEFORE = 2;
/** Reintento automático: un día después del intento fallido del día 7 (día 8). */
export const RETRY_AFTER_DAYS = 1;
/** Intentos máximos en total (día 7, día 8 y algunos con tarjetas nuevas). Igual que el CHECK de 0026. */
export const MAX_ATTEMPTS = 6;
/** Un intento que lleva más de esto en "cobrando" se cayó a la mitad: pasa a "por confirmar" y se reconcilia con ONVO. */
export const STALE_CHARGING_MS = 10 * 60_000;
/** Si ONVO no muestra la suscripción de un intento "por confirmar" después de esto, el intento no llegó: se reprograma. */
export const UNKNOWN_GIVE_UP_MS = 30 * 60_000;

export type ChargeKind = "prueba" | "beta" | "inmediato";
export type ChargeStatus = "scheduled" | "charging" | "pending" | "unknown" | "retry_scheduled" | "failed" | "succeeded" | "canceled" | "superseded";

/** Fila de public.trial_charges (lo que lee la app). */
export type TrialChargeRow = {
  id: number;
  user_id: string;
  idem_key: string;
  kind: ChargeKind;
  plan: PlanId;
  billing: Billing;
  amount_minor: number;
  trial_started_at: string;
  trial_ends_at: string;
  charge_at: string;
  next_attempt_at: string | null;
  status: ChargeStatus;
  attempts: number;
  last_attempt_at: string | null;
  provider_subscription_id: string | null;
  last_error: string | null;
  reminder_sent_at: string | null;
  failure_notified_attempt: number | null;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Lo que la persona puede leer de su tarjeta (0026: sin IDs de ONVO). */
export type CardRow = { brand: string | null; last4: string | null; exp_month: number | null; exp_year: number | null; status: "active" | "disconnected" };

const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);
const iso = (t: number) => new Date(t).toISOString();

/** ¿Ya terminó la beta? Desde ahí la prueba pide tarjeta. */
export const cardRequired = (now = new Date(), betaEndsAt = BETA_ENDS_AT) => now.getTime() >= Date.parse(betaEndsAt);

/** ¿La cuenta se creó durante la beta (sin tarjeta)? */
export const signedUpInBeta = (createdAt: string | null | undefined, betaEndsAt = BETA_ENDS_AT) => !(ms(createdAt) >= Date.parse(betaEndsAt));

/** Monto del plan en centavos de USD. Lo decide el servidor con plans.ts, nunca el cliente. Sin descuentos por nivel. */
export function amountMinorFor(plan: PlanId, billing: Billing): number {
  const p = PLANS.find((x) => x.id === plan);
  if (!p) throw new Error(`plan desconocido: ${plan}`);
  return Math.round(p.price[billing] * 100);
}

/** Clave de idempotencia de la prueba: una por persona y para siempre (UNIQUE en 0026). */
export const idemKeyFor = (userId: string) => `trial:${userId}`;
/** Clave de cada intento de cobro: la lleva la suscripción de ONVO en `metadata` para reconocerla después de un corte. */
export const attemptKeyFor = (row: Pick<TrialChargeRow, "idem_key" | "attempts">) => `${row.idem_key}:${row.attempts}`;

/** Qué tipo de primer cobro corresponde a una tarjeta que se guarda ahora. */
export function kindFor({ createdAt, now = new Date(), betaEndsAt = BETA_ENDS_AT }: { createdAt: string | null | undefined; now?: Date; betaEndsAt?: string }): ChargeKind {
  if (!cardRequired(now, betaEndsAt)) return "beta";
  return signedUpInBeta(createdAt, betaEndsAt) ? "inmediato" : "prueba";
}

/** Fechas de la prueba y del cobro para una tarjeta guardada ahora. El cobro siempre es al terminar la prueba. */
export function scheduleFor(kind: ChargeKind, now = new Date(), betaEndsAt = BETA_ENDS_AT, trialDays = TRIAL_DAYS) {
  const t = now.getTime();
  const end = kind === "prueba" ? t + trialDays * DAY_MS : kind === "beta" ? Math.max(t, Date.parse(betaEndsAt)) : t;
  return { trialStartedAt: iso(t), trialEndsAt: iso(end), chargeAt: iso(end) };
}

/** ¿Toca intentar el cobro ahora? Solo programados o con reintento, con la fecha ya cumplida. */
export function isDue(row: Pick<TrialChargeRow, "status" | "next_attempt_at"> | null | undefined, now = new Date()): boolean {
  if (!row || (row.status !== "scheduled" && row.status !== "retry_scheduled")) return false;
  const t = ms(row.next_attempt_at);
  return Number.isFinite(t) && t <= now.getTime();
}

/** ¿Toca el aviso de "En 2 días se cobra tu plan"? Una sola vez, en los 2 días antes del cobro. */
export function reminderDue(row: Pick<TrialChargeRow, "status" | "kind" | "charge_at" | "reminder_sent_at"> | null | undefined, now = new Date()): boolean {
  if (!row || row.status !== "scheduled" || row.kind === "inmediato" || row.reminder_sent_at) return false;
  const at = ms(row.charge_at);
  const t = now.getTime();
  return Number.isFinite(at) && t >= at - REMINDER_DAYS_BEFORE * DAY_MS && t < at;
}

/**
 * Qué pasa después de un cobro rechazado. Solo el primer intento (día 7) tiene reintento automático, un día después (día 8).
 * Un intento con una tarjeta nueva que también falla no se reintenta solo: la persona vuelve a cambiar la tarjeta.
 */
export function afterDecline(row: Pick<TrialChargeRow, "attempts">, now = new Date()): { status: "retry_scheduled" | "failed"; nextAttemptAt: string | null } {
  if (row.attempts <= 1) return { status: "retry_scheduled", nextAttemptAt: iso(now.getTime() + RETRY_AFTER_DAYS * DAY_MS) };
  return { status: "failed", nextAttemptAt: null };
}

/** ¿Se puede cancelar el cobro programado (sin costo)? Antes del cobro, o para dejar de reintentar uno fallido. */
export function canCancel(row: Pick<TrialChargeRow, "status"> | null | undefined): boolean {
  return !!row && (row.status === "scheduled" || row.status === "retry_scheduled" || row.status === "failed");
}

/** ¿Se puede cambiar el plan que se cobrará? Solo mientras el cobro esté programado y no haya llegado su fecha. */
export function canChangePlan(row: Pick<TrialChargeRow, "status" | "charge_at"> | null | undefined, now = new Date()): boolean {
  return !!row && row.status === "scheduled" && ms(row.charge_at) > now.getTime();
}

/**
 * Prueba de 7 días vigente. Misma regla que public._trial_live() (0026): cuenta creada desde el fin de la beta, fila de tarjeta
 * (activa o desconectada después de cancelar), cobro programado o cancelado y todavía antes del día del cobro.
 */
export function trialLive(row: Pick<TrialChargeRow, "kind" | "status" | "trial_ends_at"> | null | undefined, card: Pick<CardRow, "status"> | null | undefined, createdAt: string | null | undefined, now = new Date(), betaEndsAt = BETA_ENDS_AT): boolean {
  if (!row || !card || row.kind !== "prueba") return false;
  if (row.status !== "scheduled" && row.status !== "canceled") return false;
  if (signedUpInBeta(createdAt, betaEndsAt)) return false;
  return now.getTime() < ms(row.trial_ends_at);
}

/** Qué hacer cuando la persona guarda (o cambia) su tarjeta. */
export type CardSavedPlan =
  | { do: "create"; kind: ChargeKind }
  | { do: "keep" }
  | { do: "resume" }
  | { do: "charge_now" }
  | { do: "busy" }
  | { do: "card_only" };

export function onCardSaved(row: Pick<TrialChargeRow, "status" | "trial_ends_at" | "attempts"> | null | undefined, ctx: { createdAt: string | null | undefined; now?: Date; betaEndsAt?: string }): CardSavedPlan {
  const now = ctx.now ?? new Date();
  if (!row) return { do: "create", kind: kindFor({ createdAt: ctx.createdAt, now, betaEndsAt: ctx.betaEndsAt }) };
  switch (row.status) {
    case "scheduled": return { do: "keep" };
    case "canceled": return now.getTime() < ms(row.trial_ends_at) ? { do: "resume" } : row.attempts >= MAX_ATTEMPTS ? { do: "card_only" } : { do: "charge_now" };
    case "retry_scheduled":
    case "failed": return row.attempts >= MAX_ATTEMPTS ? { do: "card_only" } : { do: "charge_now" };
    case "charging":
    case "pending":
    case "unknown": return { do: "busy" };
    default: return { do: "card_only" };
  }
}

/** Qué ofrece la pantalla para agregar tarjeta. */
export type CardStep =
  | "none"
  /** Cuenta nueva (desde el fin de la beta) sin prueba todavía: elegir plan y tarjeta para empezar los 7 días. */
  | "trial"
  /** Beta: cuenta sin tarjeta. Aviso para agregarla antes del fin de la beta (se cobra ese día, sin días extra). */
  | "beta"
  /** Muro: cuenta de la beta después del fin de la beta, o cobro rechazado. Agregar o cambiar la tarjeta cobra en ese momento. */
  | "pay";

export function cardStepFor(i: { paidAccess: boolean; createdAt: string | null | undefined; row: Pick<TrialChargeRow, "status" | "trial_ends_at"> | null | undefined; now?: Date; betaEndsAt?: string }): CardStep {
  const now = i.now ?? new Date();
  if (i.paidAccess) return "none";
  const row = i.row;
  if (!row) {
    if (!cardRequired(now, i.betaEndsAt)) return "beta";
    return signedUpInBeta(i.createdAt, i.betaEndsAt) ? "pay" : "trial";
  }
  if (row.status === "retry_scheduled" || row.status === "failed") return "pay";
  if (row.status === "canceled" && now.getTime() >= ms(row.trial_ends_at)) return "pay";
  return "none";
}

/** Estado del primer cobro para las pantallas. */
export type ChargePhase = "programado" | "procesando" | "reintento" | "fallido" | "cancelado" | "cobrado";
export type ChargeView = {
  kind: ChargeKind;
  phase: ChargePhase;
  plan: PlanId;
  billing: Billing;
  /** USD. */
  amount: number;
  chargeAt: string;
  trialEndsAt: string;
  retryAt: string | null;
  /** Días que faltan para el cobro (redondeado hacia arriba). 0 si ya pasó. */
  daysToCharge: number;
  canCancel: boolean;
  canChangePlan: boolean;
  /** El cobro ya tocaba y aún no se intentó (lo dispara la visita o el cron). */
  due: boolean;
  /** Toca el aviso de "En 2 días se cobra tu plan" y aún no salió. */
  remind: boolean;
};

export function chargeView(row: TrialChargeRow | null | undefined, now = new Date()): ChargeView | null {
  if (!row) return null;
  const phase: ChargePhase | null =
    row.status === "scheduled" ? "programado"
    : row.status === "charging" || row.status === "pending" || row.status === "unknown" ? "procesando"
    : row.status === "retry_scheduled" ? "reintento"
    : row.status === "failed" ? "fallido"
    : row.status === "canceled" ? "cancelado"
    : row.status === "succeeded" ? "cobrado"
    : null;
  if (!phase) return null;
  const at = ms(row.charge_at);
  return {
    kind: row.kind, phase, plan: row.plan, billing: row.billing, amount: row.amount_minor / 100,
    chargeAt: row.charge_at, trialEndsAt: row.trial_ends_at,
    retryAt: row.status === "retry_scheduled" ? row.next_attempt_at : null,
    daysToCharge: Math.max(0, Math.ceil((at - now.getTime()) / DAY_MS)),
    canCancel: canCancel(row), canChangePlan: canChangePlan(row, now), due: isDue(row, now), remind: reminderDue(row, now),
  };
}

/** Aviso de arriba en la app según la tarjeta y el cobro. Puro (testeado). */
export type CardBanner = "beta-add" | "beta-scheduled" | "failed" | "processing" | "trial" | "beta" | "none";

export function bannerFor(i: { betaLive: boolean; fromSubscription: boolean; cardStep: CardStep; charge: Pick<ChargeView, "kind" | "phase"> | null | undefined; trial: boolean }): CardBanner {
  const ph = i.charge?.phase;
  if (ph === "reintento" || ph === "fallido") return "failed";
  if (ph === "procesando") return "processing";
  if (i.betaLive && !i.fromSubscription) {
    if (i.cardStep === "beta") return "beta-add";
    if (i.charge?.kind === "beta" && ph === "programado") return "beta-scheduled";
    return "beta";
  }
  return i.trial ? "trial" : "none";
}

// ───────────── Textos (honestos y con la fecha exacta) ─────────────

const usd2 = (n: number) => `$${(Math.round(n * 100) / 100).toFixed(2)}`;

/** La frase que va en todas partes desde el fin de la beta. */
export const TRIAL_CARD_LINE = `${TRIAL_DAYS} días gratis. Hoy no te cobramos. El día ${TRIAL_DAYS} se cobra tu plan, salvo que canceles antes.`;

/** Aviso 2 días antes del cobro (día 5). */
export function reminderLine(amount: number, kind: ChargeKind = "prueba", chargeDay?: string): string {
  if (kind === "beta") return `En ${REMINDER_DAYS_BEFORE} días se cobra tu plan de ${usd2(amount)}${chargeDay ? `, el ${chargeDay}` : ""}. Puedes cancelar sin costo antes de esa fecha.`;
  return `En ${REMINDER_DAYS_BEFORE} días se cobra tu plan de ${usd2(amount)}. Puedes cancelar sin costo hasta el día ${TRIAL_DAYS}.`;
}

/** Plan y periodo en palabras: "Entreno + Nutrición, mensual". */
export function planLine(plan: PlanId, billing: Billing): string {
  const p = PLANS.find((x) => x.id === plan)!;
  return `${p.name}, ${billing === "anual" ? "anual" : "mensual"}`;
}
