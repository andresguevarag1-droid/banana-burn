// Prueba de 7 días con tarjeta guardada y cobro el día 7. Reglas puras y testeadas (trial.test.ts).
// La base repite la regla de acceso en public._trial_live() (0026) y el servidor la aplica en trial-billing.ts.
//
// Decisiones del dueño (oct 2026, revisadas el 24 oct, 0043):
//   - La prueba NO pide tarjeta. Desde el fin de la beta (BETA_ENDS_AT, 1 nov 2026) cada cuenta nueva tiene 7 días con todo
//     desde el registro (profiles.created_at). Al terminar sin tarjeta: muro de planes. Antes del fin de la beta, todo gratis.
//   - Guardar la tarjeta es opcional y nunca alarga la prueba: el primer cobro es al final de la prueba (alta + 7 días) o
//     al fin de la beta para las cuentas de la beta. Quien la guarda antes de ese cobro y nunca pagó recibe 50 % de
//     descuento en su PRIMER MES (solo plan mensual; el anual va a precio normal). Una sola vez por cuenta.
//   - La tarjeta se GUARDA (no se cobra). ONVO no documenta pruebas nativas, así que el primer cobro lo programamos
//     nosotros (trial_charges).
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
  /** Fecha original del cobro si se movió (0029: mes de tester). */
  moved_from?: string | null;
  /** Hoy está aplazado porque la persona es tester (0029): no se cobra hasta el final de su mes de tester. */
  tester_hold?: boolean | null;
  /** 0043: promoción ganada al guardar la tarjeta antes del primer cobro (50 % del primer mes, solo mensual). */
  promo?: Promo | null;
};

/** Lo que la persona puede leer de su tarjeta (0026: sin IDs de ONVO). */
export type CardRow = { brand: string | null; last4: string | null; exp_month: number | null; exp_year: number | null; status: "active" | "disconnected" };

const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);
const iso = (t: number) => new Date(t).toISOString();

/** ¿Ya terminó la beta? Desde ahí cada cuenta nueva tiene su prueba de 7 días (sin tarjeta, 0043). */
export const cardRequired = (now = new Date(), betaEndsAt = BETA_ENDS_AT) => now.getTime() >= Date.parse(betaEndsAt);

/** ¿La cuenta se creó durante la beta (sin tarjeta)? */
export const signedUpInBeta = (createdAt: string | null | undefined, betaEndsAt = BETA_ENDS_AT) => !(ms(createdAt) >= Date.parse(betaEndsAt));

/** Monto del plan en centavos de USD. Lo decide el servidor con plans.ts, nunca el cliente. Sin descuentos por nivel. */
export function amountMinorFor(plan: PlanId, billing: Billing): number {
  const p = PLANS.find((x) => x.id === plan);
  if (!p) throw new Error(`plan desconocido: ${plan}`);
  return Math.round(p.price[billing] * 100);
}

// ───────────── Primer mes con 50 % (0043) ─────────────

/** Descuento del primer mes para quien deja la tarjeta lista antes del primer cobro. */
export const PROMO_PCT = 50;
/** Nombre de la promoción en trial_charges.promo (CHECK de 0043). */
export const PROMO_ID = "primer_mes_50" as const;
export type Promo = typeof PROMO_ID | null;

/**
 * Monto con descuento, redondeado hacia abajo al centavo: $9.99 → $4.99 y $14.99 → $7.49 (los precios que promete la web).
 * Math.round daría $5.00 y $7.50; preferimos el precio que mostramos.
 */
export const discountedMinor = (fullMinor: number, pct = PROMO_PCT) => Math.floor((fullMinor * (100 - pct)) / 100);

/** ¿El descuento aplica a este cobro? Solo con la promoción ganada y el plan mensual. */
export const promoApplies = (promo: Promo | string | null | undefined, billing: Billing) => promo === PROMO_ID && billing === "mes";

/** Monto del PRIMER cobro: con el 50 % si la promoción aplica (mensual), si no el precio normal. Lo decide el servidor. */
export function firstChargeMinor(plan: PlanId, billing: Billing, promo: Promo | string | null | undefined): number {
  const full = amountMinorFor(plan, billing);
  return promoApplies(promo, billing) ? discountedMinor(full) : full;
}

/** Precio con descuento del primer mes (USD), para mostrar. */
export const promoPrice = (plan: PlanId) => discountedMinor(amountMinorFor(plan, "mes")) / 100;

/**
 * ¿Gana la promoción al guardar la tarjeta ahora? Solo si el primer cobro todavía no llega (prueba o beta: cobro
 * programado a futuro) y nunca pagó un plan. "inmediato" (la prueba ya terminó) va a precio normal.
 */
export const promoFor = (kind: ChargeKind, paidBefore: boolean): Promo => (!paidBefore && (kind === "prueba" || kind === "beta") ? PROMO_ID : null);

/** Clave de idempotencia de la prueba: una por persona y para siempre (UNIQUE en 0026). */
export const idemKeyFor = (userId: string) => `trial:${userId}`;
/** Clave de cada intento de cobro: la lleva la suscripción de ONVO en `metadata` para reconocerla después de un corte. */
export const attemptKeyFor = (row: Pick<TrialChargeRow, "idem_key" | "attempts">) => `${row.idem_key}:${row.attempts}`;

/**
 * Fin de la prueba sin tarjeta (0043): cuentas creadas desde el fin de la beta, alta + 7 días. null para las de la beta
 * (ellas tuvieron la beta gratis y no tienen días extra) o sin fecha de alta.
 */
export function trialEndFor(createdAt: string | null | undefined, betaEndsAt = BETA_ENDS_AT, trialDays = TRIAL_DAYS): string | null {
  const c = ms(createdAt);
  if (!Number.isFinite(c) || signedUpInBeta(createdAt, betaEndsAt)) return null;
  return iso(c + trialDays * DAY_MS);
}

/** Qué tipo de primer cobro corresponde a una tarjeta que se guarda ahora. */
export function kindFor({ createdAt, now = new Date(), betaEndsAt = BETA_ENDS_AT }: { createdAt: string | null | undefined; now?: Date; betaEndsAt?: string }): ChargeKind {
  if (!cardRequired(now, betaEndsAt)) return "beta";
  const end = trialEndFor(createdAt, betaEndsAt);
  // Cuenta nueva con la prueba corriendo: el cobro queda para el final de SU prueba. Si ya terminó (o es de la beta): ya.
  return end && Date.parse(end) > now.getTime() ? "prueba" : "inmediato";
}

/**
 * Fechas de la prueba y del cobro para una tarjeta guardada ahora. El cobro siempre es al terminar la prueba, y guardar la
 * tarjeta no la alarga: la prueba empieza con el alta (`createdAt`), no al guardar la tarjeta.
 */
export function scheduleFor(kind: ChargeKind, now = new Date(), betaEndsAt = BETA_ENDS_AT, trialDays = TRIAL_DAYS, createdAt?: string | null) {
  const t = now.getTime();
  const c = ms(createdAt);
  const start = kind === "prueba" && Number.isFinite(c) && c <= t ? c : t;
  const end = kind === "prueba" ? start + trialDays * DAY_MS : kind === "beta" ? Math.max(t, Date.parse(betaEndsAt)) : t;
  return { trialStartedAt: iso(start), trialEndsAt: iso(end), chargeAt: iso(end) };
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
 * Prueba de 7 días vigente. Misma regla que public._trial_live() (0043): cuenta creada desde el fin de la beta y todavía
 * dentro de sus 7 días desde el alta. Con o sin tarjeta: la tarjeta solo programa el primer cobro (y gana el 50 %).
 */
export function trialLive(createdAt: string | null | undefined, now = new Date(), betaEndsAt = BETA_ENDS_AT): boolean {
  const end = trialEndFor(createdAt, betaEndsAt);
  return !!end && now.getTime() < Date.parse(end);
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
  /** Cuenta nueva (desde el fin de la beta) en su prueba sin tarjeta: puede dejarla lista y ganar el 50 % del primer mes. */
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
    return trialLive(i.createdAt, now, i.betaEndsAt) ? "trial" : "pay";
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
  /** USD. Lo que se cobra en el primer cobro (con el 50 % si aplica). */
  amount: number;
  /** USD. Precio normal del plan (lo que se cobra desde el segundo periodo). */
  fullAmount: number;
  /** El primer cobro lleva el 50 % del primer mes. */
  promo: boolean;
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
  /** Aplazado al final del mes de tester (0029): mientras sea tester no se cobra. */
  testerHold: boolean;
  /** La fecha del cobro ya no es la original (se movió por el mes de tester). */
  moved: boolean;
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
    fullAmount: amountMinorFor(row.plan, row.billing) / 100, promo: promoApplies(row.promo, row.billing),
    chargeAt: row.charge_at, trialEndsAt: row.trial_ends_at,
    retryAt: row.status === "retry_scheduled" ? row.next_attempt_at : null,
    daysToCharge: Math.max(0, Math.ceil((at - now.getTime()) / DAY_MS)),
    canCancel: canCancel(row), canChangePlan: canChangePlan(row, now), due: isDue(row, now), remind: reminderDue(row, now),
    testerHold: !!row.tester_hold && (row.status === "scheduled" || row.status === "retry_scheduled") && ms(row.next_attempt_at) > now.getTime(),
    moved: !!row.moved_from,
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

/** La frase de la prueba desde el fin de la beta (0043): sin tarjeta. */
export const TRIAL_LINE = `${TRIAL_DAYS} días gratis con todo incluido, sin tarjeta.`;

/** Título de la oferta para dejar la tarjeta lista. */
export const PROMO_TITLE = `Deja tu tarjeta lista y paga ${PROMO_PCT} % menos tu primer mes`;

/** La oferta en una frase (sin fecha). */
export const PROMO_LINE = `Si dejas tu tarjeta lista, tu primer mes cuesta ${PROMO_PCT} % menos. Hoy no te cobramos y cancelas cuando quieras desde Mi plan.`;

/** La oferta con la fecha exacta del cobro. */
export const promoChargeLine = (chargeDay: string) => `Hoy no te cobramos. El ${chargeDay} se cobra tu primer mes con ${PROMO_PCT} % de descuento, salvo que canceles antes. Cancela cuando quieras desde Mi plan.`;

/** Condiciones de la promoción (Términos, Mi plan). */
export const PROMO_TERMS = `El ${PROMO_PCT} % de descuento aplica solo al primer mes del plan mensual, una vez por cuenta, si guardas tu tarjeta antes de tu primer cobro y nunca pagaste un plan. Desde el segundo mes se cobra el precio normal. El plan anual no tiene este descuento.`;

/** Por qué el cobro no está en su fecha original: el mes de tester sigue ("tester") o ya terminó antes ("ajustado"). */
export type ChargeMoved = "tester" | "ajustado" | null;

/** De la fila: aplazado por tester hoy, movido antes, o en su fecha original. */
export const chargeMoved = (row: Pick<TrialChargeRow, "moved_from" | "tester_hold"> | null | undefined): ChargeMoved => (row?.tester_hold ? "tester" : row?.moved_from ? "ajustado" : null);

/** Aviso 2 días antes del cobro (día 5, o 2 días antes de la fecha a la que se movió). */
export function reminderLine(amount: number, kind: ChargeKind = "prueba", chargeDay?: string, moved: ChargeMoved = null, promo = false): string {
  if (promo) return `En ${REMINDER_DAYS_BEFORE} días se cobra tu primer mes con ${PROMO_PCT} % de descuento: ${usd2(amount)}${chargeDay ? `, el ${chargeDay}` : ""}. Puedes cancelar sin costo antes de esa fecha.`;
  if (moved === "tester") return `Tu mes de tester termina en ${REMINDER_DAYS_BEFORE} días. ${chargeDay ? `El ${chargeDay}` : "Ese día"} se cobra tu plan de ${usd2(amount)}. Puedes cancelar sin costo antes de esa fecha.`;
  if (kind === "beta" || moved) return `En ${REMINDER_DAYS_BEFORE} días se cobra tu plan de ${usd2(amount)}${chargeDay ? `, el ${chargeDay}` : ""}. Puedes cancelar sin costo antes de esa fecha.`;
  return `En ${REMINDER_DAYS_BEFORE} días se cobra tu plan de ${usd2(amount)}. Puedes cancelar sin costo hasta el día ${TRIAL_DAYS}.`;
}

/** Plan y periodo en palabras: "Entreno + Nutrición, mensual". */
export function planLine(plan: PlanId, billing: Billing): string {
  const p = PLANS.find((x) => x.id === plan)!;
  return `${p.name}, ${billing === "anual" ? "anual" : "mensual"}`;
}
