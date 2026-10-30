import "server-only";
// Tarjeta guardada y primer cobro programado (servidor, service_role). Reglas puras en trial.ts; tabla en 0026.
//
// Flujo:
//   1. prepareCard(): crea (o reutiliza) el cliente de ONVO. El navegador crea la tarjeta DIRECTO en ONVO con la llave
//      publicable (POST /v1/payment-methods) y nos manda solo el ID. El número nunca pasa por aquí.
//   2. saveCard(): lee la tarjeta en ONVO con la llave secreta (dueño, tipo y estado), la guarda (marca y últimos 4) y
//      programa el primer cobro en trial_charges (día 7, fin de la beta o ya).
//   3. attemptCharge(): cuando toca (cron diario o visita a la app), reclama la fila con un UPDATE condicional (un solo
//      proceso gana), crea la suscripción en ONVO con la tarjeta guardada y sin allow_incomplete (ONVO cobra el primer
//      periodo de inmediato) y la deja "pending". El plan pagado lo da SOLO el webhook (billing.ts → trialOnActivated).
//   4. Rechazo: muro de planes, aviso por correo, push y campanita, y un solo reintento automático al día siguiente.
// Nunca cobra dos veces: una fila por persona, un intento a la vez, y si la respuesta de ONVO se pierde el intento queda
// "por confirmar" hasta encontrar su suscripción por metadata (o confirmar que no existe).
//
// Tilopay (0042, fuera de Costa Rica): la tarjeta se guarda en la página segura de Tilopay (tilopay-billing.ts) y llega
// aquí ya leída por saveVerifiedCard(). El cobro del día 7 es síncrono (processRecurrentPayment): si Tilopay lo aprueba,
// se activa en el momento con activateVerified(); si la respuesta se pierde, queda "por confirmar" y se consulta la orden.
//
// Primer mes con 50 % (0043): quien guarda la tarjeta antes de su primer cobro y nunca pagó gana `promo` en su fila. Si el
// plan es mensual, el primer cobro es la mitad (firstChargeMinor). Tilopay cobra ese monto con la tarjeta guardada y
// renueva al precio normal. ONVO no tiene cupones para suscripciones (solo para sesiones de Checkout de links de un solo
// uso), así que el primer mes es un cobro único (PaymentIntent confirmado por el servidor con la tarjeta guardada,
// onvoIntroCharge) y al terminar ese mes onvo-intro.ts crea la suscripción normal a precio completo con la misma tarjeta.
//
// Llave única (0062, charge-keys.ts): justo antes de llamar al procesador se reserva (usuario, "primer_cobro", procesador).
// Si ya está reservada no se cobra; se libera solo cuando se sabe que no se cobró (rechazo o intento devuelto).
// Simulacro (dryRun): previewCharge() repite las revisiones de attemptCharge solo leyendo, sin procesador ni avisos.
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/supabase/admin";
import type { Viewer } from "@/lib/supabase/server";
import { BillingError, INTRO_PREFIX, activateVerified, getOrCreateCustomer, isIntroSub, SUB_COLS } from "@/lib/billing";
import type { SubscriptionRow } from "@/lib/entitlements";
import { chargeSavedCard, consultOrder, isTilopayConfigured, removeCardToken, tilopaySubId, trialOrderNumber } from "@/lib/tilopay";
import type { PayProvider } from "@/lib/pay-provider";
import { BETA_GRACE_UNTIL, PLANS, type Billing, type PlanId } from "@/lib/plans";
import { cardFingerprint, promoUsedByCard, recordCardFingerprint } from "@/lib/card-fingerprint";
import { recordServerError } from "@/lib/monitor/server";
import { REPLACE_MARKER, renewalInFlight } from "@/lib/tilopay-renewal";
import {
  OnvoError, cancelSubscription, checkPaymentMethod, confirmPaymentIntent, createChargedSubscription, createPaymentIntent, detachPaymentMethod, firstChargeFailed,
  estimatePeriodEnd, expectedAmountMinor, getPaymentIntent, intentOutcome, getPaymentMethod, getSubscription, isOnvoConfigured, listCustomerSubscriptions, matchesAttempt, priceIdFor, profilePlanFor,
} from "@/lib/onvo";
import {
  REVIEW_AFTER_MS, REVIEW_PREFIX, STALE_CHARGING_MS, UNKNOWN_GIVE_UP_MS, afterDecline, attemptKeyFor, canCancel, canChangePlan, chargeBusy, chargeMoved, chargeView,
  firstChargeMinor, idemKeyFor, inReview, isDue, onCardSaved, promoApplies, promoFor, reminderDue, reminderLine, scheduleFor, type CardRow, type CardSavedPlan, type ChargeView, type TrialChargeRow,
} from "@/lib/trial";
import { notifyInApp, sendChargeCanceled, sendChargeReminder, sendPaymentFailed, sendTrialStarted } from "@/lib/email";
import { pushToUser } from "@/lib/push";
import { errInfo } from "@/lib/security/log";
import { FIRST_CHARGE_PERIOD, chargeKeyHeld, releaseChargeKey, reserveChargeKey } from "@/lib/charge-keys";
import { readOnly } from "@/lib/supabase/read-only";
import { readAll, type PlannedCharge } from "@/lib/cobros-simulacro";

export const CHARGE_COLS = "id,user_id,idem_key,kind,plan,billing,amount_minor,promo,trial_started_at,trial_ends_at,charge_at,next_attempt_at,status,attempts,last_attempt_at,provider_subscription_id,last_error,reminder_sent_at,failure_notified_attempt,canceled_at,created_at,updated_at";
const CARD_COLS = "user_id,provider,provider_customer_id,provider_payment_method_id,brand,last4,exp_month,exp_year,status";
type CardFull = CardRow & { user_id: string; provider?: string | null; provider_customer_id: string; provider_payment_method_id: string };
const providerOf = (c: { provider?: string | null } | null | undefined): PayProvider => (c?.provider === "tilopay" ? "tilopay" : "onvo");

const log = (msg: string, meta?: Record<string, unknown>) => console.info(JSON.stringify({ scope: "cobro-prueba", msg, ...meta }));
const alert = (msg: string, meta?: Record<string, unknown>) => console.error(JSON.stringify({ scope: "cobro-prueba", msg: `ALERTA ${msg}`, ...meta }));

function admin(): SupabaseClient {
  const a = adminClient();
  if (!a) throw new BillingError("Pagos no configurados: falta SUPABASE_SERVICE_ROLE_KEY.", 503);
  return a;
}

const planName = (p: PlanId) => PLANS.find((x) => x.id === p)!.name;
const cardLabel = (c: Pick<CardRow, "brand" | "last4"> | null | undefined) => (c?.last4 ? `${c.brand ? c.brand.charAt(0).toUpperCase() + c.brand.slice(1) : "Tarjeta"} terminada en ${c.last4}` : null);
const nowIso = () => new Date().toISOString();

async function loadRow(db: SupabaseClient, userId: string): Promise<TrialChargeRow | null> {
  const { data } = await db.from("trial_charges").select(CHARGE_COLS).eq("user_id", userId).maybeSingle();
  const row = (data as TrialChargeRow | null) ?? null;
  const hold = row ? await holdInfo(db, row.id) : null;
  return row && hold ? { ...row, ...hold } : row;
}
async function loadCard(db: SupabaseClient, userId: string): Promise<CardFull | null> {
  const { data } = await db.from("payment_methods").select(CARD_COLS).eq("user_id", userId).maybeSingle();
  return (data as CardFull | null) ?? null;
}

/** ¿Tiene una suscripción pagada vigente? (la prueba o el cobro programado ya no aplican). */
export async function hasLivePaidSubscription(db: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await db.from("subscriptions").select("plan,status,current_period_end,cancel_at_period_end").eq("user_id", userId).in("status", ["active", "trialing", "past_due", "canceled"]);
  return ((data as { plan: string | null; status: string; current_period_end: string | null; cancel_at_period_end: boolean }[] | null) ?? []).some((r) => profilePlanFor(r) !== "free");
}

/** Suscripciones pagadas vigentes, con las columnas de renovación (0042). */
export type LiveSub = SubscriptionRow & { renewal_attempts?: number; next_renewal_attempt_at?: string | null; last_renewal_error?: string | null };
const LIVE_COLS = `${SUB_COLS},renewal_attempts,next_renewal_attempt_at,last_renewal_error`;
async function livePaidSubs(db: SupabaseClient, userId: string): Promise<LiveSub[]> {
  const { data } = await db.from("subscriptions").select(LIVE_COLS).eq("user_id", userId).in("status", ["active", "trialing", "past_due", "canceled"]);
  return ((data as LiveSub[] | null) ?? []).filter((r) => profilePlanFor(r) !== "free");
}
const subProvider = (s: Pick<SubscriptionRow, "provider">): PayProvider => (s.provider === "tilopay" ? "tilopay" : "onvo");

/** ¿Pagó un plan alguna vez? (una fila activada tiene current_period_start). Sin esto gana el 50 % del primer mes. */
async function paidBefore(db: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await db.from("subscriptions").select("current_period_start").eq("user_id", userId).limit(50);
  return ((data as { current_period_start: string | null }[] | null) ?? []).some((r) => Boolean(r.current_period_start));
}

// ───────────────────────── Avisos ─────────────────────────

async function pushTo(db: SupabaseClient, userId: string, payload: { title: string; body: string; url: string; tag: string }) {
  try {
    const { data: prefs } = await db.from("notification_prefs").select("push_reminders").eq("user_id", userId).maybeSingle();
    if (prefs?.push_reminders === false) return 0;
    return await pushToUser(db, userId, payload);
  } catch (e) {
    log("push falló", { userId, error: errInfo(e) });
    return 0;
  }
}

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("es-419", { day: "numeric", month: "long", timeZone: "America/Costa_Rica" });

/**
 * Testers de la beta (0029): mientras la persona sea tester no se le cobra. Esta revisión va justo antes de avisar o cobrar:
 * si es tester, la base aplaza el cobro (programado o reintento) al final de su mes de tester y devuelve esa fecha.
 * Sin 0029 aplicada (o si falla) devuelve null y todo sigue como antes.
 */
export async function testerHold(db: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await db.rpc("tester_hold_charge", { p_user: userId });
  return !error && typeof data === "string" && Number.isFinite(Date.parse(data)) ? data : null;
}

/** Columnas de 0029 (fecha original y aplazado por tester), aparte: sin la migración, el resto sigue funcionando. */
export async function holdInfo(db: SupabaseClient, chargeId: number): Promise<Pick<TrialChargeRow, "moved_from" | "tester_hold"> | null> {
  const { data, error } = await db.from("trial_charges").select("moved_from,tester_hold").eq("id", chargeId).maybeSingle();
  return error || !data ? null : (data as Pick<TrialChargeRow, "moved_from" | "tester_hold">);
}

/** Día 5 (o 2 días antes del fin de la beta): correo, push y campanita. Se reclama con reminder_sent_at: una sola vez. */
export async function sendReminderIfDue(db: SupabaseClient, row: TrialChargeRow, now = new Date()): Promise<boolean> {
  if (!reminderDue(row, now)) return false;
  // Tester: si el cobro caía antes del final de su mes de tester, la base lo aplazó (y el aviso sale 2 días antes de la fecha nueva).
  const until = await testerHold(db, row.user_id);
  if (until && Date.parse(row.charge_at) < Date.parse(until)) return false;
  const { data: claimed } = await db.from("trial_charges").update({ reminder_sent_at: now.toISOString(), updated_at: now.toISOString() }).eq("id", row.id).eq("status", "scheduled").is("reminder_sent_at", null).select("id");
  if (!claimed?.length) return false;
  const amount = row.amount_minor / 100;
  const moved = chargeMoved(await holdInfo(db, row.id));
  const promo = promoApplies(row.promo, row.billing);
  const line = reminderLine(amount, row.kind, fmtDay(row.charge_at), moved, promo);
  const card = cardLabel(await loadCard(db, row.user_id));
  await notifyInApp(row.user_id, { kind: "cobro_pronto", title: "En 2 días se cobra tu plan", body: line, url: "/app/suscripcion" }).catch(() => false);
  await sendChargeReminder({ userId: row.user_id, chargeId: row.id, plan: planName(row.plan), amount, chargeAt: row.charge_at, kind: row.kind, card, moved, promo }).catch(() => null);
  await pushTo(db, row.user_id, { title: "En 2 días se cobra tu plan", body: line, url: "/app/suscripcion", tag: `cobro-${row.id}` });
  log("aviso de cobro enviado", { userId: row.user_id, chargeId: row.id });
  return true;
}

async function notifyDecline(db: SupabaseClient, row: TrialChargeRow, retryAt: string | null) {
  // Un aviso por intento: dos procesos a la vez no lo mandan dos veces.
  const { data: claimed } = await db.from("trial_charges").update({ failure_notified_attempt: row.attempts })
    .eq("id", row.id).or(`failure_notified_attempt.is.null,failure_notified_attempt.lt.${row.attempts}`).select("id");
  if (!claimed?.length) return;
  const amount = row.amount_minor / 100;
  await sendPaymentFailed({ userId: row.user_id, plan: planName(row.plan), amount, currency: "USD", reference: `${attemptKeyFor(row)}:rechazo`, retryDate: retryAt, updateUrl: "/app/suscripcion#tarjeta", paused: true }).catch(() => null);
  await pushTo(db, row.user_id, { title: "No pudimos cobrar tu plan", body: retryAt ? `Lo intentaremos de nuevo el ${fmtDay(retryAt)}. Cambia tu tarjeta para seguir hoy.` : "Cambia tu tarjeta para seguir. Tu progreso sigue guardado.", url: "/app/suscripcion#tarjeta", tag: `cobro-fallido-${row.id}` });
}

// ───────────────────────── Paso 1 y 2: guardar la tarjeta ─────────────────────────

/** Cliente de ONVO al que el navegador asocia la tarjeta (con la llave publicable). */
export async function prepareCard(v: Viewer): Promise<{ customerId: string }> {
  const db = admin();
  const busy = await loadRow(db, v.id);
  if (chargeBusy(busy)) throw new BillingError("Estamos procesando tu cobro. Revisa en unos minutos.", 409);
  return { customerId: await getOrCreateCustomer(db, v) };
}

export type SaveCardResult = { card: { brand: string | null; last4: string | null }; charge: ChargeView | null; outcome: "programado" | "reanudado" | "sin_cambio" | "tarjeta_cambiada" | AttemptResult };

const PM_ID = /^[A-Za-z0-9_-]{1,100}$/;

/**
 * Guarda la tarjeta que el navegador creó en ONVO y programa (o reanuda, o cobra) el primer cobro.
 * `plan`/`billing` los valida el servidor; el monto sale de plans.ts (sin descuentos por nivel: esos son solo de programas Premium).
 */
export async function saveCard(v: Viewer, input: { paymentMethodId: string; plan: PlanId; billing: Billing }, now = new Date()): Promise<SaveCardResult> {
  const db = admin();
  if (!PM_ID.test(input.paymentMethodId)) throw new BillingError("Tarjeta inválida.", 400);
  if (!priceIdFor(input.plan, input.billing)) throw new BillingError("Este plan aún no está disponible para pago.", 503);
  const { data: cust } = await db.from("billing_customers").select("provider_customer_id").eq("user_id", v.id).maybeSingle();
  const customerId = cust?.provider_customer_id as string | undefined;
  if (!customerId) throw new BillingError("Vuelve a intentarlo: no encontramos tu registro de pago.", 409);
  const ctx = await cardSaveContext(db, v, now, "onvo");

  // Fuente de verdad: la tarjeta según ONVO (servidor a servidor). El navegador solo mandó el ID.
  let pm;
  try {
    pm = await getPaymentMethod(input.paymentMethodId);
  } catch (e) {
    if (e instanceof OnvoError && e.status === 404) throw new BillingError("No encontramos esa tarjeta. Intenta de nuevo.", 400);
    throw e;
  }
  const check = checkPaymentMethod(pm, customerId);
  if (!check.ok) {
    log("tarjeta rechazada al guardar", { userId: v.id, reason: check.reason });
    throw new BillingError(check.reason === "no_activa" ? "Tu banco no aprobó la tarjeta para pagos recurrentes. Prueba con otra." : "No pudimos usar esa tarjeta. Prueba con otra.", 400);
  }
  const c = check.card;
  // Huella del procesador si ONVO la devuelve (no documentada); si no, card-fingerprint.ts usa marca, últimos 4 y vencimiento.
  const raw = pm as unknown as { fingerprint?: unknown; card?: { fingerprint?: unknown } | null };
  const fpRaw = typeof raw.fingerprint === "string" ? raw.fingerprint : typeof raw.card?.fingerprint === "string" ? raw.card.fingerprint : null;
  const verified: VerifiedCard = { provider: "onvo", ...c, customerId, providerFingerprint: fpRaw };
  if (ctx.mode === "replace") return replaceCard(db, v, verified, ctx.subs, now);
  return saveVerifiedCard(db, v, verified, { plan: input.plan, billing: input.billing }, ctx.row, ctx.plan, now);
}

export type VerifiedCard = { provider: PayProvider; customerId: string; paymentMethodId: string; brand: string | null; last4: string | null; expMonth: number | null; expYear: number | null; providerFingerprint?: string | null };

/** Quita en su procesador una tarjeta que ya no se usa (si falla, solo queda sin usar). */
async function releaseCard(userId: string, c: Pick<CardFull, "provider" | "provider_payment_method_id">, email: string | null) {
  if (providerOf(c) === "tilopay") {
    if (!(await removeCardToken(c.provider_payment_method_id, email ?? ""))) log("Tilopay no confirmó que quitó la tarjeta anterior", { userId });
    return;
  }
  await detachPaymentMethod(c.provider_payment_method_id).catch((e) => log("no se pudo desconectar la tarjeta anterior", { userId, error: errInfo(e) }));
}

export type CardSaveCtx = { mode: "trial"; row: TrialChargeRow | null; plan: CardSavedPlan } | { mode: "replace"; subs: LiveSub[] };

/**
 * Qué significa guardar una tarjeta ahora (ONVO y Tilopay, mismas reglas):
 *   - "trial": no paga un plan. El cobro programado de la prueba se crea, se reanuda o se cobra (trial.ts → onCardSaved).
 *   - "replace": paga un plan que se renueva con la tarjeta guardada y la cambia (p. ej. desde el aviso de pago rechazado,
 *     /app/suscripcion#tarjeta). Tilopay y el primer mes con 50 % los cobramos nosotros: la tarjeta nueva se usa en la
 *     próxima renovación (y si la renovación falló, se reintenta ya). Una suscripción normal de ONVO no deja cambiar su
 *     tarjeta (no hay endpoint documentado): solo con la renovación fallida se crea una nueva con la tarjeta nueva.
 * La tarjeta tiene que ser del mismo procesador que el plan.
 */
export async function cardSaveContext(db: SupabaseClient, v: Viewer, now = new Date(), provider: PayProvider = "onvo"): Promise<CardSaveCtx> {
  const live = await livePaidSubs(db, v.id);
  if (live.length) {
    const renewing = live.filter((s) => ["active", "trialing", "past_due"].includes(s.status) && !s.cancel_at_period_end);
    const replaceable = renewing.length > 0 && renewing.every((s) => subProvider(s) === "tilopay" || isIntroSub(s.provider_subscription_id) || s.status === "past_due");
    if (!replaceable) throw new BillingError("Ya tienes un plan activo.", 409);
    const other = renewing.find((s) => subProvider(s) !== provider);
    if (other) throw new BillingError(subProvider(other) === "tilopay" ? "Tu plan se cobra con una tarjeta de otro país. Toca “¿Tu tarjeta es de otro país?” para cambiarla." : "Tu plan se cobra con una tarjeta de Costa Rica. Toca “¿Tu tarjeta es de Costa Rica?” para cambiarla.", 409);
    return { mode: "replace", subs: renewing };
  }
  const row = await loadRow(db, v.id);
  const { data: prof } = await db.from("profiles").select("created_at").eq("id", v.id).maybeSingle();
  const plan = onCardSaved(row, { createdAt: (prof?.created_at as string | undefined) ?? null, now });
  if (plan.do === "busy") throw new BillingError("Estamos procesando tu cobro. Revisa en unos minutos.", 409);
  return { mode: "trial", row, plan };
}

/** Guarda la tarjeta (y quita la anterior en su procesador). Si el token ya es de otra cuenta, no se guarda. */
async function storeCard(db: SupabaseClient, v: Viewer, c: VerifiedCard, now: Date) {
  const { data: taken } = await db.from("payment_methods").select("user_id").eq("provider_payment_method_id", c.paymentMethodId).neq("user_id", v.id).limit(1);
  if (taken?.length) {
    alert("tarjeta guardada en otra cuenta: no se acepta", { userId: v.id, provider: c.provider });
    throw new BillingError("No pudimos usar esa tarjeta. Prueba con otra.", 400);
  }
  const prev = await loadCard(db, v.id);
  const { error: upErr } = await db.from("payment_methods").upsert({
    user_id: v.id, provider: c.provider, provider_customer_id: c.customerId, provider_payment_method_id: c.paymentMethodId,
    brand: c.brand, last4: c.last4, exp_month: c.expMonth, exp_year: c.expYear, status: "active", disconnected_at: null, updated_at: now.toISOString(),
  }, { onConflict: "user_id" });
  if (upErr) {
    // Carrera con otra cuenta (índice único del token): es un error, nunca un "guardada".
    if ((upErr as { code?: string }).code === "23505") throw new BillingError("No pudimos usar esa tarjeta. Prueba con otra.", 400);
    throw new BillingError("No pudimos guardar tu tarjeta. Intenta de nuevo.", 500);
  }
  // La tarjeta anterior ya no se usa: se quita en su procesador.
  if (prev && prev.provider_payment_method_id !== c.paymentMethodId && prev.status === "active") await releaseCard(v.id, prev, v.email);
  return { brand: c.brand, last4: c.last4 };
}

/**
 * Cambia la tarjeta con que se renueva un plan pagado. Si la renovación estaba rechazada (past_due), se reintenta ya con la
 * tarjeta nueva, salvo que haya un cobro por confirmar (ahí nunca se cobra de nuevo: lo resuelve la consulta).
 */
export async function replaceCard(db: SupabaseClient, v: Viewer, c: VerifiedCard, subs: LiveSub[], now = new Date()): Promise<SaveCardResult> {
  const card = await storeCard(db, v, c, now);
  await recordCardFingerprint(db, v.id, cardFingerprint(c), c.provider, false);
  const at = now.toISOString();
  let tilopayRetry = false, onvoRetry = false;
  for (const s of subs) {
    if (s.status !== "past_due" || renewalInFlight(s.last_renewal_error)) continue;
    if (subProvider(s) === "tilopay") {
      await db.from("subscriptions").update({ next_renewal_attempt_at: at, updated_at: at }).eq("id", s.id).eq("status", "past_due");
      tilopayRetry = true;
    } else if (isIntroSub(s.provider_subscription_id)) {
      await db.from("subscriptions").update({ next_renewal_attempt_at: at, updated_at: at }).eq("id", s.id).eq("status", "past_due");
      onvoRetry = true;
    } else {
      await db.from("subscriptions").update({ last_renewal_error: REPLACE_MARKER, next_renewal_attempt_at: at, updated_at: at }).eq("id", s.id).eq("status", "past_due");
      onvoRetry = true;
    }
  }
  try {
    if (tilopayRetry) await (await import("@/lib/tilopay-billing")).renewDueForUser(v.id, now);
    if (onvoRetry) await (await import("@/lib/onvo-intro")).convertDueForUser(v.id, now);
  } catch (e) {
    log("reintento con la tarjeta nueva falló (lo toma el cron)", { userId: v.id, error: errInfo(e) });
  }
  log("tarjeta del plan cambiada", { userId: v.id, provider: c.provider, retry: tilopayRetry || onvoRetry });
  return { card, charge: null, outcome: "tarjeta_cambiada" };
}

/**
 * Guarda una tarjeta ya verificada por el servidor (ONVO: leída con la llave secreta; Tilopay: token devuelto a nuestra
 * vuelta firmada) y programa, reanuda o cobra el primer cobro con las reglas de trial.ts.
 */
export async function saveVerifiedCard(db: SupabaseClient, v: Viewer, c: VerifiedCard, input: { plan: PlanId; billing: Billing }, rowIn: TrialChargeRow | null, plan: ReturnType<typeof onCardSaved>, now = new Date()): Promise<SaveCardResult> {
  let row = rowIn;
  const card = await storeCard(db, v, c, now);
  // El monto lo pone el servidor: con el 50 % del primer mes solo si la fila ganó la promoción y el plan es mensual.
  // 0045: una vez por tarjeta, no por cuenta (la misma tarjeta en otra cuenta que ya la ganó o ya pagó no la vuelve a ganar).
  const fp = cardFingerprint(c);
  const promo = plan.do === "create" ? promoFor(plan.kind, (await paidBefore(db, v.id)) || (await promoUsedByCard(db, v.id, fp))) : (row?.promo ?? null);
  await recordCardFingerprint(db, v.id, fp, c.provider, promo !== null);
  const amount = firstChargeMinor(input.plan, input.billing, promo);
  const planFields = { plan: input.plan, billing: input.billing, amount_minor: amount };

  if (plan.do === "create") {
    // La prueba empieza con el alta (0043): guardar la tarjeta no la alarga.
    const { data: prof } = await db.from("profiles").select("created_at").eq("id", v.id).maybeSingle();
    const s = scheduleFor(plan.kind, now, undefined, undefined, (prof?.created_at as string | undefined) ?? null);
    const ins = await db.from("trial_charges").insert({
      user_id: v.id, idem_key: idemKeyFor(v.id), kind: plan.kind, ...planFields, promo,
      trial_started_at: s.trialStartedAt, trial_ends_at: s.trialEndsAt, charge_at: s.chargeAt, next_attempt_at: s.chargeAt, status: "scheduled", attempts: 0,
    }).select(CHARGE_COLS).single();
    if (ins.error) {
      // Carrera (dos pestañas): la otra ya la creó. La clave única de 0026 impide una segunda prueba.
      row = await loadRow(db, v.id);
      if (!row) throw new BillingError("No pudimos programar tu plan. Intenta de nuevo.", 500);
      return { card, charge: chargeView(row, now), outcome: "sin_cambio" };
    }
    row = ins.data as TrialChargeRow;
    // Tester (0029): el cobro pasa al final de su mes de tester antes de avisar la fecha.
    if (row.kind !== "inmediato" && (await testerHold(db, v.id))) row = (await loadRow(db, v.id)) ?? row;
    log("cobro programado", { userId: v.id, chargeId: row.id, kind: row.kind, chargeAt: row.charge_at, plan: row.plan, billing: row.billing });
    if (row.kind === "inmediato") {
      const r = await attemptCharge(db, row, now);
      return { card, charge: chargeView(await loadRow(db, v.id), now), outcome: r };
    }
    const promoOn = promoApplies(row.promo, row.billing);
    await sendTrialStarted({ userId: v.id, chargeId: row.id, plan: planName(row.plan), amount: amount / 100, chargeAt: row.charge_at, kind: row.kind, card: cardLabel(card), promo: promoOn }).catch(() => null);
    await notifyInApp(v.id, { kind: "prueba", title: "Tu tarjeta quedó lista", body: promoOn ? `Hoy no te cobramos. El ${fmtDay(row.charge_at)} se cobra tu primer mes con 50 % de descuento, salvo que canceles antes.` : `Hoy no te cobramos. El ${fmtDay(row.charge_at)} se cobra tu plan, salvo que canceles antes.`, url: "/app/suscripcion" }).catch(() => false);
    return { card, charge: chargeView(row, now), outcome: "programado" };
  }

  if (!row) throw new BillingError("No pudimos programar tu plan. Intenta de nuevo.", 500);

  if (plan.do === "keep") {
    if (canChangePlan(row, now) && (row.plan !== input.plan || row.billing !== input.billing)) {
      await db.from("trial_charges").update({ ...planFields, updated_at: now.toISOString() }).eq("id", row.id).eq("status", "scheduled");
    }
    return { card, charge: chargeView(await loadRow(db, v.id), now), outcome: "sin_cambio" };
  }

  if (plan.do === "resume") {
    await db.from("trial_charges").update({ ...planFields, status: "scheduled", next_attempt_at: row.charge_at, canceled_at: null, updated_at: now.toISOString() }).eq("id", row.id).eq("status", "canceled");
    await testerHold(db, v.id);
    log("cobro reanudado", { userId: v.id, chargeId: row.id });
    return { card, charge: chargeView(await loadRow(db, v.id), now), outcome: "reanudado" };
  }

  if (plan.do === "charge_now") {
    // Tarjeta nueva después de un rechazo, o volver después de cancelar: se cobra ya, con el plan elegido ahora.
    const from = row.status;
    const { data: ready } = await db.from("trial_charges")
      .update({ ...planFields, status: from === "retry_scheduled" ? "retry_scheduled" : "scheduled", next_attempt_at: now.toISOString(), canceled_at: null, updated_at: now.toISOString() })
      .eq("id", row.id).eq("status", from).select(CHARGE_COLS);
    const fresh = (ready as TrialChargeRow[] | null)?.[0];
    if (!fresh) throw new BillingError("Estamos procesando tu cobro. Revisa en unos minutos.", 409);
    const r = await attemptCharge(db, fresh, now);
    return { card, charge: chargeView(await loadRow(db, v.id), now), outcome: r };
  }

  return { card, charge: chargeView(row, now), outcome: "sin_cambio" };
}

/** Cambia el plan que se cobrará (solo con el cobro programado y antes de su fecha). El monto lo pone el servidor. */
export async function changeTrialPlan(v: Viewer, plan: PlanId, billing: Billing, now = new Date()): Promise<ChargeView | null> {
  const db = admin();
  const row = await loadRow(db, v.id);
  if (!canChangePlan(row, now)) throw new BillingError("Ya no se puede cambiar el plan de este cobro.", 409);
  if (!priceIdFor(plan, billing)) throw new BillingError("Este plan aún no está disponible para pago.", 503);
  const { error } = await db.from("trial_charges").update({ plan, billing, amount_minor: firstChargeMinor(plan, billing, row!.promo), updated_at: now.toISOString() }).eq("id", row!.id).eq("status", "scheduled");
  if (error) throw new BillingError("No pudimos cambiar tu plan. Intenta de nuevo.", 500);
  return chargeView(await loadRow(db, v.id), now);
}

/**
 * Cancela el cobro programado: no se cobra y el acceso sigue hasta el fin de la prueba. Con `keepCard: false` la tarjeta
 * se desconecta en ONVO ("Disconnect a Payment Method") y queda marcada como desconectada.
 */
export async function cancelTrial(v: Viewer, keepCard: boolean, now = new Date()): Promise<{ accessUntil: string | null; cardKept: boolean }> {
  const db = admin();
  const row = await loadRow(db, v.id);
  if (!row || !canCancel(row)) {
    if (row && (row.status === "charging" || row.status === "pending" || row.status === "unknown")) throw new BillingError("Ya estamos procesando tu cobro. Si se cobra y no lo querías, escríbenos a hola@bananaburn.app dentro de los 8 días hábiles de retracto.", 409);
    throw new BillingError("No tienes un cobro programado para cancelar.", 404);
  }
  const { data: done } = await db.from("trial_charges").update({ status: "canceled", canceled_at: now.toISOString(), next_attempt_at: null, updated_at: now.toISOString() })
    .eq("id", row.id).in("status", ["scheduled", "retry_scheduled", "failed"]).select("id");
  if (!done?.length) throw new BillingError("Ya estamos procesando tu cobro. Revisa en unos minutos.", 409);
  let cardKept = true;
  if (!keepCard) cardKept = !(await disconnectCard(db, v.id));
  const accessUntil = row.status === "scheduled" && Date.parse(row.trial_ends_at) > now.getTime() ? row.trial_ends_at : null;
  log("cobro cancelado antes de cobrar", { userId: v.id, chargeId: row.id, keepCard, cardKept });
  await sendChargeCanceled({ userId: v.id, chargeId: row.id, plan: planName(row.plan), accessUntil, cardKept }).catch(() => null);
  return { accessUntil, cardKept };
}

/** Deshace la cancelación antes del fin de la prueba, con la tarjeta que dejó guardada. El cobro vuelve a su fecha. */
export async function resumeTrial(v: Viewer, now = new Date()): Promise<ChargeView | null> {
  const db = admin();
  const row = await loadRow(db, v.id);
  if (!row || row.status !== "canceled" || Date.parse(row.trial_ends_at) <= now.getTime()) throw new BillingError("No hay una cancelación que deshacer.", 409);
  const card = await loadCard(db, v.id);
  if (!card || card.status !== "active") throw new BillingError("Agrega tu tarjeta de nuevo para seguir.", 409);
  const { data } = await db.from("trial_charges").update({ status: "scheduled", next_attempt_at: row.charge_at, canceled_at: null, updated_at: now.toISOString() }).eq("id", row.id).eq("status", "canceled").select("id");
  if (!data?.length) throw new BillingError("No pudimos reactivar tu plan. Intenta de nuevo.", 409);
  log("cobro reanudado sin tarjeta nueva", { userId: v.id, chargeId: row.id });
  return chargeView(await loadRow(db, v.id), now);
}

/** Desconecta la tarjeta en ONVO y la marca desconectada. true si quedó desconectada. */
async function disconnectCard(db: SupabaseClient, userId: string): Promise<boolean> {
  const card = await loadCard(db, userId);
  if (!card || card.status !== "active") return true;
  if (providerOf(card) === "tilopay") {
    // La ruta para quitar tarjetas en Tilopay no es pública: si no responde, igual deja de usarse aquí (nunca se cobra).
    const email = await emailOf(db, userId);
    if (!(await removeCardToken(card.provider_payment_method_id, email ?? ""))) log("Tilopay no confirmó que quitó la tarjeta; queda desconectada aquí", { userId });
  } else {
    try {
      await detachPaymentMethod(card.provider_payment_method_id);
    } catch (e) {
      if (!(e instanceof OnvoError && e.status === 404)) {
        log("no se pudo desconectar la tarjeta en ONVO", { userId, error: errInfo(e) });
        return false;
      }
    }
  }
  await db.from("payment_methods").update({ status: "disconnected", disconnected_at: nowIso(), updated_at: nowIso() }).eq("user_id", userId);
  return true;
}

/** Quitar la tarjeta guardada: solo si no hay un cobro programado ni una suscripción que la use para renovar. */
export async function removeCard(v: Viewer): Promise<void> {
  const db = admin();
  const row = await loadRow(db, v.id);
  if (row && ["scheduled", "retry_scheduled", "charging", "pending", "unknown"].includes(row.status)) throw new BillingError("Primero cancela el cobro programado.", 409);
  if (await hasLivePaidSubscription(db, v.id)) throw new BillingError("Tu plan activo usa esta tarjeta para renovarse. Cancela la renovación primero.", 409);
  if (!(await disconnectCard(db, v.id))) throw new BillingError("No pudimos quitar la tarjeta con el procesador de pagos. Intenta de nuevo.", 502);
}

// ───────────────────────── Paso 3: el cobro ─────────────────────────

/** Vigencia de una página de pago (compra directa): mientras tanto no se cobra la tarjeta guardada (doble cobro). */
const CHECKOUT_WINDOW_MS = 2 * 3600_000;

const firstKey = (r: Pick<TrialChargeRow, "user_id">, procesador: PayProvider) => ({ userId: r.user_id, periodo: FIRST_CHARGE_PERIOD, procesador });
/** Reserva la llave del primer cobro (0062) justo antes de llamar al procesador. false = no se cobra. */
const reserveFirst = async (db: SupabaseClient, r: TrialChargeRow, procesador: PayProvider, referencia: string) =>
  (await reserveChargeKey(db, { ...firstKey(r, procesador), origen: "primer_cobro", referencia })) === "reservada";

/** La llave no se pudo reservar (ya hay un cobro de este periodo, o la base no respondió): no se cobra; el intento se devuelve. */
async function keyBlocked(db: SupabaseClient, r: TrialChargeRow, before: Pick<TrialChargeRow, "status" | "attempts">, now: Date): Promise<"aplazado"> {
  await db.from("trial_charges").update({ status: before.status, attempts: before.attempts, next_attempt_at: new Date(now.getTime() + 3600_000).toISOString(), last_error: "llave de cobro ocupada", updated_at: nowIso() }).eq("id", r.id).eq("status", "charging");
  return "aplazado";
}

export type AttemptResult = "omitido" | "aplazado" | "enviado" | "rechazado" | "por_confirmar" | "reemplazado" | "sin_tarjeta" | "sin_config";

/**
 * Un intento de cobro. Idempotente: el UPDATE condicional (estado + intentos + fecha cumplida) deja pasar a un solo proceso.
 * Crea la suscripción en ONVO con la tarjeta guardada (cobra el primer periodo ya) y registra la fila en `subscriptions`
 * como `incomplete`: la activa el webhook.
 */
export async function attemptCharge(db: SupabaseClient, row: TrialChargeRow, now = new Date()): Promise<AttemptResult> {
  if (!isDue(row, now)) return "omitido";
  const provider = providerOf(await loadCard(db, row.user_id));
  if (provider === "onvo" && !isOnvoConfigured()) { alert("cobro pendiente pero ONVO no está configurado", { chargeId: row.id }); return "sin_config"; }
  if (provider === "tilopay" && !isTilopayConfigured()) { alert("cobro pendiente pero Tilopay no está configurado", { chargeId: row.id }); return "sin_config"; }
  // Nunca se cobra a un tester durante su mes de tester: la base aplaza el cobro al final y aquí no se intenta.
  if (await testerHold(db, row.user_id)) { log("cobro aplazado por mes de tester", { userId: row.user_id, chargeId: row.id }); return "aplazado"; }
  // 0053: a un residente de un condominio afiliado no se le cobra su prueba individual (el acceso lo da el condominio).
  // Normalmente el cobro ya quedó reemplazado al vincularse; esto cubre una carrera entre el enlace y el cobro.
  const { data: condoGrant } = await db.from("comp_grants").select("id").eq("user_id", row.user_id).eq("source", "condominio").is("revoked_at", null).gt("expires_at", now.toISOString()).limit(1);
  if (condoGrant?.length) {
    await db.from("trial_charges").update({ status: "superseded", next_attempt_at: null, updated_at: nowIso() }).eq("id", row.id).eq("status", row.status).eq("attempts", row.attempts);
    log("cobro reemplazado: residente de un condominio afiliado", { userId: row.user_id, chargeId: row.id });
    return "reemplazado";
  }
  // 0045: ninguna cuenta de la beta se cobra antes del fin de sus 7 días después del lanzamiento (BETA_GRACE_UNTIL).
  if (row.kind === "beta" && now.getTime() < Date.parse(BETA_GRACE_UNTIL)) {
    await db.from("trial_charges").update({ next_attempt_at: BETA_GRACE_UNTIL, updated_at: nowIso() }).eq("id", row.id).eq("status", row.status).eq("attempts", row.attempts);
    log("cobro de la beta aplazado al fin de sus 7 días", { userId: row.user_id, chargeId: row.id });
    return "aplazado";
  }
  // Está pagando en la página de pago (compra directa) ahora mismo: no se cobra la tarjeta guardada a la vez (doble cobro).
  // La página de pago vale 2 horas; el cobro se intenta después.
  const { data: open } = await db.from("subscriptions").select("provider_subscription_id,created_at").eq("user_id", row.user_id).eq("status", "incomplete").gte("created_at", new Date(now.getTime() - CHECKOUT_WINDOW_MS).toISOString()).limit(10);
  const checkout = ((open as { provider_subscription_id: string | null; created_at: string }[] | null) ?? []).filter((s) => s.provider_subscription_id !== row.provider_subscription_id);
  if (checkout.length) {
    const until = new Date(Math.max(...checkout.map((s) => Date.parse(s.created_at))) + CHECKOUT_WINDOW_MS).toISOString();
    await db.from("trial_charges").update({ next_attempt_at: until, updated_at: nowIso() }).eq("id", row.id).eq("status", row.status).eq("attempts", row.attempts);
    log("cobro aplazado: hay una compra directa en curso", { userId: row.user_id, chargeId: row.id });
    return "aplazado";
  }
  const prev = { status: row.status, attempts: row.attempts, last_attempt_at: row.last_attempt_at };
  const at = now.toISOString();
  const { data: won } = await db.from("trial_charges")
    .update({ status: "charging", attempts: row.attempts + 1, last_attempt_at: at, last_error: null, updated_at: at })
    .eq("id", row.id).eq("status", row.status).eq("attempts", row.attempts).lte("next_attempt_at", at).select(CHARGE_COLS);
  const r = (won as TrialChargeRow[] | null)?.[0];
  if (!r) return "omitido";
  // Lo hicieron tester justo entre la revisión y el reclamo: se devuelve el intento (sin contar) y se aplaza.
  const { data: liveTester } = await db.from("tester_grants").select("id").eq("user_id", r.user_id).is("revoked_at", null).lte("starts_at", at).gt("expires_at", at).limit(1);
  if (liveTester?.length) {
    await db.from("trial_charges").update({ ...prev, updated_at: nowIso() }).eq("id", r.id).eq("status", "charging");
    await testerHold(db, r.user_id);
    log("cobro aplazado por mes de tester", { userId: r.user_id, chargeId: r.id });
    return "aplazado";
  }

  // Ya paga por otro lado (eligió pagar antes desde Mi plan): este cobro sobra.
  if (await hasLivePaidSubscription(db, r.user_id)) {
    await db.from("trial_charges").update({ status: "superseded", next_attempt_at: null, updated_at: at }).eq("id", r.id).eq("status", "charging");
    log("cobro reemplazado por un plan ya pagado", { userId: r.user_id, chargeId: r.id });
    return "reemplazado";
  }
  const card = await loadCard(db, r.user_id);
  if (!card || card.status !== "active") {
    await db.from("trial_charges").update({ status: "failed", next_attempt_at: null, last_error: "sin tarjeta guardada", updated_at: at }).eq("id", r.id).eq("status", "charging");
    await notifyDecline(db, { ...r, status: "failed" }, null);
    return "sin_tarjeta";
  }

  if (providerOf(card) === "tilopay") return tilopayCharge(db, r, row, card, now);
  if (promoApplies(r.promo, r.billing)) return onvoIntroCharge(db, r, row, card, now);

  if (!(await reserveFirst(db, r, "onvo", attemptKeyFor(r)))) return keyBlocked(db, r, prev, now);
  let subId: string | null = null;
  try {
    const sub = await createChargedSubscription({ customerId: card.provider_customer_id, paymentMethodId: card.provider_payment_method_id, plan: r.plan, billing: r.billing, userId: r.user_id, trialKey: r.idem_key, attempt: r.attempts });
    if (!sub?.id) throw new OnvoError("ONVO no devolvió la suscripción", 502);
    subId = sub.id;
    await recordSubscription(db, r, card.provider_customer_id, sub.id);
    if (firstChargeFailed(sub)) return await decline(db, r, `ONVO: ${String(sub.status)}`, sub.id, now);
    await db.from("trial_charges").update({ status: "pending", provider_subscription_id: sub.id, updated_at: nowIso() }).eq("id", r.id).eq("status", "charging");
    log("cobro enviado a ONVO", { userId: r.user_id, chargeId: r.id, attempt: r.attempts, subscriptionId: sub.id });
    // Si el webhook llegó antes que esta fila, quedó en error: se procesa ahora (es el evento autenticado de ONVO).
    await replayWebhooks(db, sub.id, card.provider_customer_id);
    return "enviado";
  } catch (e) {
    if (subId) {
      // La suscripción existe en ONVO pero algo falló después: no se reintenta a ciegas.
      await db.from("trial_charges").update({ status: "pending", provider_subscription_id: subId, updated_at: nowIso() }).eq("id", r.id).eq("status", "charging");
      alert("suscripción creada pero no se pudo registrar", { chargeId: r.id, subscriptionId: subId, error: errInfo(e) });
      return "enviado";
    }
    const status = e instanceof OnvoError ? e.status : 0;
    if (status >= 400 && status < 500 && status !== 401 && status !== 403 && status !== 409 && status !== 429) {
      // Rechazo del banco o datos de la tarjeta: ONVO no creó la suscripción.
      return await decline(db, r, e instanceof Error ? e.message : "rechazado", null, now);
    }
    if (status === 401 || status === 403) {
      // Llave mal configurada: no es culpa de la persona. Se devuelve el intento y se avisa al equipo.
      await releaseChargeKey(db, firstKey(r, "onvo"), `ONVO ${status}`);
      await db.from("trial_charges").update({ status: row.status, attempts: row.attempts, next_attempt_at: new Date(now.getTime() + 3600_000).toISOString(), last_error: `ONVO ${status}`, updated_at: nowIso() }).eq("id", r.id).eq("status", "charging");
      alert("ONVO rechazó la llave al cobrar", { chargeId: r.id, status });
      return "sin_config";
    }
    // Tiempo agotado, red o 5xx: no sabemos si ONVO cobró. Queda por confirmar (nunca se reintenta a ciegas).
    await db.from("trial_charges").update({ status: "unknown", last_error: `sin respuesta de ONVO (${status || "red"})`, updated_at: nowIso() }).eq("id", r.id).eq("status", "charging");
    alert("cobro por confirmar", { chargeId: r.id, attempt: r.attempts, status });
    return "por_confirmar";
  }
}

async function recordSubscription(db: SupabaseClient, r: TrialChargeRow, customerId: string, subId: string, provider: PayProvider = "onvo") {
  const { data: exists } = await db.from("subscriptions").select("id").eq("provider_subscription_id", subId).maybeSingle();
  if (exists) return;
  const { error } = await db.from("subscriptions").insert({
    user_id: r.user_id, provider, provider_customer_id: customerId, provider_subscription_id: subId,
    status: "incomplete", price_id: provider === "onvo" ? priceIdFor(r.plan, r.billing) : null, plan: r.plan, billing: r.billing,
  });
  if (error) throw new Error(`subscriptions: ${error.message}`);
}

/** Correo de la persona (Tilopay lo pide en cada cobro). */
export async function emailOf(db: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await db.auth.admin.getUserById(userId).catch(() => ({ data: null }));
  return data?.user?.email ?? null;
}

// ───────────────────────── Tilopay: el cobro del día 7 ─────────────────────────

/**
 * Cobro con la tarjeta guardada en Tilopay. Síncrono: la respuesta de Tilopay (servidor a servidor) dice si se aprobó.
 * El número de orden es el mismo para este intento: si la respuesta se pierde, la consulta por ese número lo resuelve.
 */
async function tilopayCharge(db: SupabaseClient, r: TrialChargeRow, before: TrialChargeRow, card: CardFull, now: Date): Promise<AttemptResult> {
  const order = trialOrderNumber(r.idem_key, r.attempts);
  const subId = tilopaySubId(order);
  const email = await emailOf(db, r.user_id);
  if (!email) {
    await db.from("trial_charges").update({ status: before.status, attempts: before.attempts, next_attempt_at: new Date(now.getTime() + 3600_000).toISOString(), last_error: "sin correo para Tilopay", updated_at: nowIso() }).eq("id", r.id).eq("status", "charging");
    alert("cobro Tilopay sin correo de la persona", { chargeId: r.id });
    return "sin_config";
  }
  if (!(await reserveFirst(db, r, "tilopay", order))) return keyBlocked(db, r, before, now);
  // La fila de la suscripción va primero (incomplete): si el proceso se cae después del cobro, la consulta la encuentra.
  await recordSubscription(db, r, card.provider_customer_id, subId, "tilopay");
  await db.from("trial_charges").update({ provider_subscription_id: subId, updated_at: nowIso() }).eq("id", r.id).eq("status", "charging");
  const out = await chargeSavedCard({ token: card.provider_payment_method_id, email, amountMinor: r.amount_minor, orderNumber: order });
  if (out.state === "declined") return decline(db, { ...r, provider_subscription_id: subId }, `Tilopay: ${out.description}`, subId, now, "tilopay");
  if (out.state === "unknown") {
    await db.from("trial_charges").update({ status: "unknown", last_error: `sin respuesta de Tilopay (${out.error})`.slice(0, 300), updated_at: nowIso() }).eq("id", r.id).eq("status", "charging");
    alert("cobro Tilopay por confirmar", { chargeId: r.id, attempt: r.attempts });
    return "por_confirmar";
  }
  await db.from("trial_charges").update({ status: "pending", updated_at: nowIso() }).eq("id", r.id).eq("status", "charging");
  log("cobro aprobado por Tilopay", { userId: r.user_id, chargeId: r.id, attempt: r.attempts });
  await activateTilopay(db, subId, r.amount_minor, order, now, expectedFirst(r));
  return "enviado";
}

/**
 * Monto esperado del primer cobro según el servidor (0043): con el 50 % solo si la fila ganó la promoción y es mensual.
 * Nunca se toma el monto guardado sin recalcularlo: si no coincide, se valida contra el precio normal (y no se activa).
 */
function expectedFirst(r: Pick<TrialChargeRow, "plan" | "billing" | "promo" | "amount_minor">): number | null {
  const exp = firstChargeMinor(r.plan, r.billing, r.promo);
  return promoApplies(r.promo, r.billing) && exp === r.amount_minor ? exp : null;
}

// ───────────────────────── ONVO: primer mes con 50 % (cobro único) ─────────────────────────

/**
 * Primer mes con 50 % en ONVO. Pasos:
 *   1. Crea el PaymentIntent por el monto del servidor (amount_minor recalculado). Si falla, no se cobró nada: se devuelve
 *      el intento y se reprograma en una hora.
 *   2. Registra la fila `subscriptions` (onvo-pi:<id>, incomplete) y la anota en trial_charges ANTES de confirmar: si la
 *      respuesta se pierde, la reconciliación consulta ese PaymentIntent.
 *   3. Confirma con la tarjeta guardada (servidor, llave secreta) y vuelve a leer el PaymentIntent (fuente de verdad):
 *      succeeded con el monto y la moneda esperados = activa un mes (activateVerified). requires_action (3DS) o rechazo =
 *      rechazo normal (muro, aviso y reintento al día siguiente). processing = "pending" hasta confirmarlo.
 * Al terminar el mes, onvo-intro.ts crea la suscripción normal (precio completo) con la misma tarjeta.
 */
async function onvoIntroCharge(db: SupabaseClient, r: TrialChargeRow, before: TrialChargeRow, card: CardFull, now: Date): Promise<AttemptResult> {
  const expected = expectedFirst(r);
  if (expected === null) {
    // La fila no cuadra con el servidor: nunca se cobra un monto que el servidor no calculó.
    await db.from("trial_charges").update({ status: before.status, attempts: before.attempts, next_attempt_at: new Date(now.getTime() + 3600_000).toISOString(), last_error: "monto de la promoción no coincide", updated_at: nowIso() }).eq("id", r.id).eq("status", "charging");
    alert("primer mes con 50 %: monto no coincide con el servidor", { chargeId: r.id });
    return "sin_config";
  }
  if (!(await reserveFirst(db, r, "onvo", attemptKeyFor(r)))) return keyBlocked(db, r, before, now);
  let piId: string;
  try {
    const pi = await createPaymentIntent({ amountMinor: expected, customerId: card.provider_customer_id, description: `Banana Burn, ${planName(r.plan)}: primer mes con 50 % de descuento`, metadata: { userId: r.user_id, trialKey: r.idem_key, attempt: String(r.attempts), promo: "primer_mes_50" } });
    if (!pi?.id) throw new OnvoError("ONVO no devolvió el PaymentIntent", 502);
    piId = pi.id;
  } catch (e) {
    // Sin PaymentIntent no hay cobro posible: se devuelve el intento.
    const status = e instanceof OnvoError ? e.status : 0;
    await releaseChargeKey(db, firstKey(r, "onvo"), "sin PaymentIntent");
    await db.from("trial_charges").update({ status: before.status, attempts: before.attempts, next_attempt_at: new Date(now.getTime() + 3600_000).toISOString(), last_error: `ONVO ${status || "red"} al crear el cobro`, updated_at: nowIso() }).eq("id", r.id).eq("status", "charging");
    alert("primer mes con 50 %: no se pudo crear el PaymentIntent", { chargeId: r.id, status });
    return status === 401 || status === 403 ? "sin_config" : "aplazado";
  }
  const subId = `${INTRO_PREFIX}${piId}`;
  await recordSubscription(db, r, card.provider_customer_id, subId, "onvo");
  await db.from("trial_charges").update({ provider_subscription_id: subId, updated_at: nowIso() }).eq("id", r.id).eq("status", "charging");
  try {
    await confirmPaymentIntent(piId, card.provider_payment_method_id);
  } catch (e) {
    const status = e instanceof OnvoError ? e.status : 0;
    if (status >= 400 && status < 500 && status !== 401 && status !== 403 && status !== 409 && status !== 429) return decline(db, { ...r, provider_subscription_id: subId }, e instanceof Error ? e.message : "rechazado", subId, now);
    // 5xx, red o llave: no sabemos si cobró. Se consulta el PaymentIntent (nunca se reintenta a ciegas).
    await db.from("trial_charges").update({ status: "unknown", last_error: `sin respuesta de ONVO al confirmar (${status || "red"})`, updated_at: nowIso() }).eq("id", r.id).eq("status", "charging");
    alert("primer mes con 50 % por confirmar", { chargeId: r.id, status });
    return "por_confirmar";
  }
  return settleIntro(db, { ...r, provider_subscription_id: subId }, piId, expected, now, "charging");
}

/** Lee el PaymentIntent (fuente de verdad) y cierra el intento: activa, rechaza o lo deja pendiente. */
async function settleIntro(db: SupabaseClient, r: TrialChargeRow, piId: string, expected: number, now: Date, from: "charging" | "unknown" | "pending"): Promise<AttemptResult> {
  const subId = `${INTRO_PREFIX}${piId}`;
  let pi;
  try {
    pi = await getPaymentIntent(piId);
  } catch (e) {
    if (from === "charging") await db.from("trial_charges").update({ status: "unknown", last_error: "sin respuesta de ONVO al leer el cobro", updated_at: nowIso() }).eq("id", r.id).eq("status", "charging");
    log("no se pudo leer el PaymentIntent", { chargeId: r.id, error: errInfo(e) });
    return "por_confirmar";
  }
  const out = intentOutcome(pi?.status);
  if (out === "declined") return decline(db, r, `ONVO: ${String(pi?.status)}`, subId, now);
  if (out === "approved") {
    await db.from("trial_charges").update({ status: "pending", updated_at: nowIso() }).eq("id", r.id).eq("status", from);
    const { data } = await db.from("subscriptions").select(SUB_COLS).eq("provider_subscription_id", subId).maybeSingle();
    const sub = data as SubscriptionRow | null;
    if (!sub) { alert("primer mes con 50 % cobrado sin suscripción registrada", { chargeId: r.id, subId }); return "enviado"; }
    const amt = typeof pi.amount === "number" ? pi.amount : null;
    const res = await activateVerified(db, sub, { periodStart: now.toISOString(), periodEnd: estimatePeriodEnd(now, "mes").toISOString(), amountMinor: amt, currency: typeof pi.currency === "string" ? pi.currency : null, reference: piId, provider: "onvo", expectedMinor: expected });
    log("primer mes con 50 % cobrado", { userId: r.user_id, chargeId: r.id, ok: res.ok });
    return "enviado";
  }
  if (out === "processing") {
    await db.from("trial_charges").update({ status: "pending", updated_at: nowIso() }).eq("id", r.id).eq("status", from);
    return "enviado";
  }
  // Nunca se confirmó: no hubo cobro. Desde "charging" es raro (la confirmación respondió): queda por confirmar.
  if (from === "charging") {
    await db.from("trial_charges").update({ status: "unknown", last_error: "ONVO no confirmó el cobro", updated_at: nowIso() }).eq("id", r.id).eq("status", "charging");
    return "por_confirmar";
  }
  return "por_confirmar";
}

/** Reconciliación del primer mes con 50 % (por confirmar o pendiente): se consulta el PaymentIntent. */
async function reconcileIntro(db: SupabaseClient, r: TrialChargeRow, now: Date): Promise<"vinculado" | "reprogramado" | "sigue"> {
  const piId = r.provider_subscription_id!.slice(INTRO_PREFIX.length);
  const expected = expectedFirst(r);
  if (expected === null) { alert("primer mes con 50 % por confirmar con monto que no coincide", { chargeId: r.id }); return "sigue"; }
  let pi;
  try { pi = await getPaymentIntent(piId); } catch { return "sigue"; }
  const out = intentOutcome(pi?.status);
  if (out === "not_confirmed" && now.getTime() - Date.parse(r.last_attempt_at ?? r.updated_at) > UNKNOWN_GIVE_UP_MS) {
    // El PaymentIntent existe pero nunca se confirmó: no hubo cobro. Se devuelve el intento para hacerlo de nuevo.
    await db.from("subscriptions").update({ status: "expired", updated_at: nowIso() }).eq("provider_subscription_id", r.provider_subscription_id!).eq("status", "incomplete");
    await db.from("trial_charges").update({ status: r.attempts <= 1 ? "scheduled" : "retry_scheduled", attempts: Math.max(0, r.attempts - 1), provider_subscription_id: null, next_attempt_at: nowIso(), updated_at: nowIso() }).eq("id", r.id).in("status", ["unknown", "pending"]);
    await releaseChargeKey(db, firstKey(r, "onvo"), "PaymentIntent sin confirmar");
    return "reprogramado";
  }
  if (out === "not_confirmed" || out === "processing") { await reviewIfStuck(db, r, now, `ONVO ${piId}`); return "sigue"; }
  await settleIntro(db, r, piId, expected, now, r.status === "pending" ? "pending" : "unknown");
  return "vinculado";
}

/** Activa la suscripción de un cobro de la prueba que Tilopay aprobó (respuesta del cobro o consulta de la orden). */
async function activateTilopay(db: SupabaseClient, subId: string, amountMinor: number, order: string, now: Date, expectedMinor: number | null = null) {
  const { data } = await db.from("subscriptions").select(SUB_COLS).eq("provider_subscription_id", subId).maybeSingle();
  const sub = data as SubscriptionRow | null;
  if (!sub) { alert("cobro Tilopay aprobado sin suscripción registrada", { subscriptionId: subId }); return; }
  const start = now.toISOString();
  await activateVerified(db, sub, { periodStart: start, periodEnd: estimatePeriodEnd(now, sub.billing ?? "mes").toISOString(), amountMinor, currency: "USD", reference: order, provider: "tilopay", expectedMinor });
}

/** Intento de Tilopay "por confirmar": se consulta la orden. Nunca se reintenta a ciegas. */
async function reconcileTilopay(db: SupabaseClient, r: TrialChargeRow, now: Date): Promise<"vinculado" | "reprogramado" | "sigue"> {
  const order = trialOrderNumber(r.idem_key, r.attempts);
  const res = await consultOrder(order);
  const subId = r.provider_subscription_id ?? tilopaySubId(order);
  if (res.state === "approved") {
    await db.from("trial_charges").update({ status: "pending", updated_at: nowIso() }).eq("id", r.id).eq("status", "unknown");
    await activateTilopay(db, subId, res.amountMinor ?? r.amount_minor, order, now, expectedFirst(r));
    log("cobro Tilopay por confirmar: aprobado", { chargeId: r.id });
    return "vinculado";
  }
  if (res.state === "declined") { await decline(db, r, "Tilopay: rechazado (consulta)", subId, now, "tilopay"); return "vinculado"; }
  if (now.getTime() - Date.parse(r.last_attempt_at ?? r.updated_at) > UNKNOWN_GIVE_UP_MS) alert("cobro Tilopay por confirmar sin respuesta de la consulta: revisar en el portal de Tilopay", { chargeId: r.id, userId: r.user_id, order });
  await reviewIfStuck(db, r, now, `Tilopay ${order}`);
  return "sigue";
}

/** Rechazo: cancela la suscripción en ONVO (para que ONVO no reintente por su cuenta), muro y un solo reintento al día 8. */
async function decline(db: SupabaseClient, r: TrialChargeRow, reason: string, subId: string | null, now = new Date(), provider: PayProvider = "onvo"): Promise<"rechazado"> {
  if (subId) {
    if (provider === "onvo" && !isIntroSub(subId)) await cancelSubscription(subId).catch((e) => log("no se pudo cancelar la suscripción rechazada en ONVO", { subscriptionId: subId, error: errInfo(e) }));
    await db.from("subscriptions").update({ status: "expired", updated_at: nowIso() }).eq("provider_subscription_id", subId).eq("status", "incomplete");
  }
  const next = afterDecline(r, now);
  await db.from("trial_charges").update({ status: next.status, next_attempt_at: next.nextAttemptAt, last_error: reason.slice(0, 300), updated_at: nowIso() })
    .eq("id", r.id).in("status", ["charging", "pending", "unknown"]);
  await releaseChargeKey(db, firstKey(r, provider), "rechazado");
  log("cobro rechazado", { userId: r.user_id, chargeId: r.id, attempt: r.attempts, next: next.status });
  await notifyDecline(db, { ...r, status: next.status }, next.nextAttemptAt);
  return "rechazado";
}

/** Procesa de nuevo los webhooks de esta suscripción que llegaron antes de registrarla (quedaron en error). */
async function replayWebhooks(db: SupabaseClient, subId: string, customerId: string) {
  const since = new Date(Date.now() - 6 * 3600_000).toISOString();
  const [{ data: bySub }, { data: byCust }] = await Promise.all([
    db.from("payment_events").select("id,payload").eq("status", "error").eq("provider_subscription_id", subId).gte("received_at", since).limit(5),
    db.from("payment_events").select("id,payload").eq("status", "error").eq("payload->data->>customerId", customerId).gte("received_at", since).limit(5),
  ]);
  const seen = new Set<number>();
  const { processWebhook } = await import("@/lib/billing");
  for (const e of [...(bySub ?? []), ...(byCust ?? [])] as { id: number; payload: { type?: string; data?: Record<string, unknown> } }[]) {
    if (seen.has(e.id) || typeof e.payload?.type !== "string") continue;
    seen.add(e.id);
    await processWebhook({ type: e.payload.type, data: e.payload.data ?? {} }, JSON.stringify(e.payload)).catch((err) => log("no se pudo reprocesar el webhook", { id: e.id, error: errInfo(err) }));
  }
}

// ───────────────────────── Reconciliación ─────────────────────────

/**
 * Cobro sin confirmar hace más de un día: queda para revisión del equipo (alerta + fila en app_errors, visible en
 * /admin/salud) y deja de bloquear a la persona (puede pagar en la página de pago o guardar otra tarjeta, que no cobra
 * sola). Nunca se reintenta el cobro: la reconciliación sigue consultando al procesador.
 */
async function reviewIfStuck(db: SupabaseClient, r: TrialChargeRow, now: Date, what: string) {
  if (inReview(r)) { recordServerError("pagos/cobro-por-confirmar", "charge_review"); return; }
  if (r.status !== "unknown" && r.status !== "pending") return;
  if (!(now.getTime() - Date.parse(r.last_attempt_at ?? r.updated_at) > REVIEW_AFTER_MS)) return;
  await db.from("trial_charges").update({ last_error: `${REVIEW_PREFIX}${what}`.slice(0, 300), updated_at: nowIso() }).eq("id", r.id).eq("status", r.status);
  alert("cobro sin confirmar hace más de un día: revisar en el panel del procesador; la persona ya puede pagar o cambiar su tarjeta", { chargeId: r.id, userId: r.user_id, what });
  recordServerError("pagos/cobro-por-confirmar", "charge_review");
}

/**
 * Intento "por confirmar" (la respuesta de ONVO se perdió). Busca la suscripción de ESTE intento por metadata. Si ONVO no
 * guarda metadata (no documentado), nunca se reintenta: queda para revisión manual.
 */
async function reconcileUnknown(db: SupabaseClient, r: TrialChargeRow, now = new Date()): Promise<"vinculado" | "reprogramado" | "sigue"> {
  const card = await loadCard(db, r.user_id);
  if (!card) return "sigue";
  if (providerOf(card) === "tilopay" || r.provider_subscription_id?.startsWith("tlp:")) return reconcileTilopay(db, r, now);
  if (isIntroSub(r.provider_subscription_id)) return reconcileIntro(db, r, now);
  let subs;
  try {
    subs = await listCustomerSubscriptions(card.provider_customer_id);
  } catch (e) {
    log("no se pudo listar suscripciones en ONVO", { chargeId: r.id, error: errInfo(e) });
    return "sigue";
  }
  const match = subs.find((s) => matchesAttempt(s, r.idem_key, r.attempts));
  if (match) {
    await recordSubscription(db, r, card.provider_customer_id, match.id);
    if (firstChargeFailed(match)) { await decline(db, r, `ONVO: ${String(match.status)}`, match.id, now); return "vinculado"; }
    await db.from("trial_charges").update({ status: "pending", provider_subscription_id: match.id, updated_at: nowIso() }).eq("id", r.id).eq("status", "unknown");
    await replayWebhooks(db, match.id, card.provider_customer_id);
    log("intento por confirmar vinculado", { chargeId: r.id, subscriptionId: match.id });
    return "vinculado";
  }
  const metadataWorks = subs.length === 0 || subs.every((s) => s.metadata && typeof s.metadata === "object" && "trialKey" in (s.metadata as object));
  const old = now.getTime() - Date.parse(r.last_attempt_at ?? r.updated_at) > UNKNOWN_GIVE_UP_MS;
  if (old && metadataWorks) {
    // ONVO no tiene ninguna suscripción de este intento: no se creó. Se devuelve el intento para hacerlo de nuevo.
    await db.from("trial_charges").update({ status: r.attempts <= 1 ? "scheduled" : "retry_scheduled", attempts: Math.max(0, r.attempts - 1), next_attempt_at: nowIso(), updated_at: nowIso() }).eq("id", r.id).eq("status", "unknown");
    await releaseChargeKey(db, firstKey(r, "onvo"), "no llegó a ONVO");
    log("intento por confirmar no llegó a ONVO: se reprograma", { chargeId: r.id });
    return "reprogramado";
  }
  if (old) alert("intento por confirmar sin forma segura de verificarlo: revisar en el panel de ONVO", { chargeId: r.id, userId: r.user_id });
  await reviewIfStuck(db, r, now, `ONVO ${attemptKeyFor(r)}`);
  return "sigue";
}

/** "pending" sin webhook después de una hora: si ONVO ya marcó la suscripción como fallida, es un rechazo. Nunca activa. */
async function checkPending(db: SupabaseClient, r: TrialChargeRow, now = new Date()) {
  if (!r.provider_subscription_id || now.getTime() - Date.parse(r.updated_at) < 3600_000) return;
  if (isIntroSub(r.provider_subscription_id)) {
    const { data } = await db.from("subscriptions").select("status").eq("provider_subscription_id", r.provider_subscription_id).maybeSingle();
    if (data?.status === "active") { await db.from("trial_charges").update({ status: "succeeded", next_attempt_at: null, updated_at: nowIso() }).eq("id", r.id).eq("status", "pending"); return; }
    await reconcileIntro(db, r, now);
    return;
  }
  if (r.provider_subscription_id.startsWith("tlp:")) {
    // Tilopay aprobó pero la activación no terminó (el proceso se cayó): se vuelve a consultar la orden.
    const { data } = await db.from("subscriptions").select("status").eq("provider_subscription_id", r.provider_subscription_id).maybeSingle();
    if (data?.status === "active") { await db.from("trial_charges").update({ status: "succeeded", next_attempt_at: null, updated_at: nowIso() }).eq("id", r.id).eq("status", "pending"); return; }
    const order = r.provider_subscription_id.slice(4);
    const res = await consultOrder(order);
    if (res.state === "approved") await activateTilopay(db, r.provider_subscription_id, res.amountMinor ?? r.amount_minor, order, now, expectedFirst(r));
    else await reviewIfStuck(db, r, now, `Tilopay ${order}`);
    return;
  }
  try {
    const sub = await getSubscription(r.provider_subscription_id);
    if (firstChargeFailed(sub)) await decline(db, r, `ONVO: ${String(sub.status)}`, r.provider_subscription_id, now);
    else await reviewIfStuck(db, r, now, `ONVO ${r.provider_subscription_id} (${String(sub.status ?? "?")})`.slice(0, 120));
  } catch (e) {
    log("no se pudo consultar la suscripción pendiente", { chargeId: r.id, error: errInfo(e) });
  }
}

async function tidy(db: SupabaseClient, r: TrialChargeRow, now: Date) {
  if (r.status === "charging" && now.getTime() - Date.parse(r.updated_at) > STALE_CHARGING_MS) {
    // El proceso se cayó a la mitad: no sabemos si llegó a ONVO.
    await db.from("trial_charges").update({ status: "unknown", updated_at: nowIso() }).eq("id", r.id).eq("status", "charging");
    return reconcileUnknown(db, { ...r, status: "unknown" }, now);
  }
  if (r.status === "unknown") return reconcileUnknown(db, r, now);
  if (r.status === "pending") return checkPending(db, r, now);
}

// ───────────────────────── Disparadores ─────────────────────────

/** Revisión al abrir la app: aviso del día 5, cobro que ya tocaba y reconciliación. Nunca lanza. */
export async function runDueForUser(userId: string, now = new Date()): Promise<AttemptResult | null> {
  const db = adminClient();
  if (!db) return null;
  try {
    const row = await loadRow(db, userId);
    if (!row) return null;
    await sendReminderIfDue(db, row, now);
    if (isDue(row, now)) return await attemptCharge(db, row, now);
    await tidy(db, row, now);
  } catch (e) {
    log("revisión al abrir la app falló", { userId, error: errInfo(e) });
  }
  return null;
}

export type SweepStats = { reminders: number; attempted: number; sent: number; declined: number; unknown: number; tidied: number; errors: number; planned?: PlannedCharge[] };

/**
 * Cron diario (/api/cron/recordatorios): avisos del día 5, cobros del día 7 y reintentos del día 8, y reconciliación.
 * dryRun: solo calcula y reporta (planned) con un cliente de solo lectura: sin avisos, sin reclamar filas y sin procesador.
 */
export async function sweepTrialCharges(now = new Date(), opts: { deadline?: number; limit?: number; chargeBy?: number; concurrency?: number; skipReminders?: boolean; dryRun?: boolean } = {}): Promise<SweepStats> {
  const out: SweepStats = { reminders: 0, attempted: 0, sent: 0, declined: 0, unknown: 0, tidied: 0, errors: 0 };
  const db = adminClient();
  if (!db) return out;
  if (opts.dryRun) {
    try {
      out.planned = await planTrialCharges(readOnly(db), now);
    } catch (e) {
      out.errors++;
      log("simulacro falló", { error: errInfo(e) });
    }
    return out;
  }
  const time = () => !opts.deadline || Date.now() < opts.deadline;
  const limit = Math.min(opts.limit ?? 100, 500);
  const at = now.toISOString();
  try {
    const soon = new Date(now.getTime() + 2 * 864e5).toISOString();
    const { data: rem } = await db.from("trial_charges").select(CHARGE_COLS).eq("status", "scheduled").is("reminder_sent_at", null).gt("charge_at", at).lte("charge_at", soon).order("charge_at").limit(limit);
    if (!opts.skipReminders) for (const r of (rem as TrialChargeRow[] | null) ?? []) { if (!time()) break; if (await sendReminderIfDue(db, r, now)) out.reminders++; }

    const { data: open } = await db.from("trial_charges").select(CHARGE_COLS).in("status", ["charging", "unknown", "pending"]).order("updated_at").limit(limit);
    for (const r of (open as TrialChargeRow[] | null) ?? []) { if (!time()) break; await tidy(db, r, now); out.tidied++; }

    const { data: due } = await db.from("trial_charges").select(CHARGE_COLS).in("status", ["scheduled", "retry_scheduled"]).lte("next_attempt_at", at).order("next_attempt_at").limit(limit);
    // Varios cobros a la vez (el 8 de noviembre vencen todas las cuentas de la beta con tarjeta): cada fila se reclama con un
    // UPDATE condicional en attemptCharge, así que dos trabajadores nunca cobran la misma.
    const queue = [...((due as TrialChargeRow[] | null) ?? [])];
    const worker = async () => {
      for (let r = queue.shift(); r; r = queue.shift()) {
        // Un cobro nuevo puede tardar hasta 20 s: no se empieza si no alcanza el tiempo de la función (lo toma la próxima corrida).
        if (!time() || (opts.chargeBy && Date.now() >= opts.chargeBy)) return;
        out.attempted++;
        const row = r;
        const res = await attemptCharge(db, row, now).catch((e) => { out.errors++; log("intento falló", { chargeId: row.id, error: errInfo(e) }); return null; });
        if (res === "enviado") out.sent++;
        else if (res === "rechazado" || res === "sin_tarjeta") out.declined++;
        else if (res === "por_confirmar") out.unknown++;
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, Math.min(opts.concurrency ?? 1, 6)) }, worker));
  } catch (e) {
    out.errors++;
    log("barrido falló", { error: errInfo(e) });
  }
  if (out.reminders || out.attempted || out.tidied) log("barrido", out);
  return out;
}

// ───────────────────────── Simulacro (dryRun) ─────────────────────────

const OPEN_STATUSES = ["charging", "unknown", "pending"];

/** Todos los cobros que vencen y los que están en vuelo, sin escribir (db de solo lectura) y sin límite de una corrida. */
async function planTrialCharges(db: SupabaseClient, now: Date): Promise<PlannedCharge[]> {
  const at = now.toISOString();
  const planned: PlannedCharge[] = [];
  // En vuelo: el cron solo consulta al procesador (nunca cobra de nuevo).
  const open = await readAll<TrialChargeRow>((a, b) => db.from("trial_charges").select(CHARGE_COLS).in("status", OPEN_STATUSES).order("id").range(a, b));
  for (const r of open) {
    planned.push({
      userId: r.user_id, fila: r.id, origen: r.kind === "beta" ? "fin_beta" : r.kind, procesador: r.provider_subscription_id?.startsWith("tlp:") ? "tilopay" : "onvo",
      plan: r.plan, billing: r.billing, montoMinor: r.amount_minor, montoEsperadoMinor: firstChargeMinor(r.plan, r.billing, r.promo), promo50: promoApplies(r.promo, r.billing),
      periodo: FIRST_CHARGE_PERIOD, accion: "consultar", motivo: `en vuelo (${r.status})`, cortesia: false, temporadaIncluida: r.billing === "anual",
    });
  }
  const due = await readAll<TrialChargeRow>((a, b) => db.from("trial_charges").select(CHARGE_COLS).in("status", ["scheduled", "retry_scheduled"]).lte("next_attempt_at", at).order("id").range(a, b));
  for (const r of due) {
    const p = await previewCharge(db, r, now);
    if (p) planned.push(p);
  }
  return planned;
}

/**
 * Lo que haría attemptCharge con esta fila, SOLO leyendo: las mismas revisiones y en el mismo orden, sin reclamar la fila,
 * sin llamar a ONVO ni a Tilopay y sin avisos. No lee el correo (dato personal) ni revisa la configuración del procesador:
 * responde "qué se cobraría con los procesadores encendidos".
 */
export async function previewCharge(db: SupabaseClient, row: TrialChargeRow, now = new Date()): Promise<PlannedCharge | null> {
  if (!isDue(row, now)) return null;
  const at = now.toISOString();
  const card = await loadCard(db, row.user_id);
  const provider = card ? providerOf(card) : null;
  const promo = promoApplies(row.promo, row.billing);
  const expected = firstChargeMinor(row.plan, row.billing, row.promo);
  // Lo que se mandaría: Tilopay cobra amount_minor de la fila, ONVO con 50 % el monto recalculado y ONVO normal el precio del plan.
  const amount = provider === "tilopay" ? row.amount_minor : promo ? expected : expectedAmountMinor(row.plan, row.billing);
  const { data: grants } = await db.from("comp_grants").select("source,starts_at").eq("user_id", row.user_id).is("revoked_at", null).gt("expires_at", at).limit(20);
  const g = (grants as { source: string | null; starts_at: string }[] | null) ?? [];
  const p: PlannedCharge = {
    userId: row.user_id, fila: row.id, origen: row.status === "retry_scheduled" ? "reintento" : row.kind === "beta" ? "fin_beta" : row.kind, procesador: provider,
    plan: row.plan, billing: row.billing, montoMinor: amount, montoEsperadoMinor: expected, promo50: promo, periodo: FIRST_CHARGE_PERIOD,
    accion: "cobrar", motivo: null, cortesia: g.some((x) => x.source !== "condominio" && Date.parse(x.starts_at) <= now.getTime()), temporadaIncluida: row.billing === "anual",
  };
  const skip = (motivo: string): PlannedCharge => ({ ...p, accion: "omitir", motivo });
  const { data: tester } = await db.from("tester_grants").select("id").eq("user_id", row.user_id).is("revoked_at", null).lte("starts_at", at).gt("expires_at", at).limit(1);
  if (tester?.length) return skip("tester");
  if (g.some((x) => x.source === "condominio")) return skip("condominio");
  if (row.kind === "beta" && now.getTime() < Date.parse(BETA_GRACE_UNTIL)) return skip("beta_aun_no");
  const { data: open } = await db.from("subscriptions").select("provider_subscription_id").eq("user_id", row.user_id).eq("status", "incomplete").gte("created_at", new Date(now.getTime() - CHECKOUT_WINDOW_MS).toISOString()).limit(10);
  if (((open as { provider_subscription_id: string | null }[] | null) ?? []).some((s) => s.provider_subscription_id !== row.provider_subscription_id)) return skip("compra_en_curso");
  if (await hasLivePaidSubscription(db, row.user_id)) return skip("ya_paga");
  if (!card || card.status !== "active" || !provider) return skip("sin_tarjeta");
  if (provider === "onvo" && promo && expectedFirst(row) === null) return skip("monto_no_coincide");
  const held = await chargeKeyHeld(db, firstKey(row, provider));
  if (held === null) return skip("sin_llaves_0062");
  if (held) return skip("llave_ocupada");
  return p;
}

// ───────────────────────── Ganchos del webhook (billing.ts) ─────────────────────────

/** Una suscripción quedó activa por webhook: si era el cobro de la prueba, queda cobrado; si no, el cobro programado sobra. */
export async function trialOnActivated(db: SupabaseClient, sub: { user_id: string; provider_subscription_id: string | null }) {
  const at = nowIso();
  if (sub.provider_subscription_id) {
    const { data } = await db.from("trial_charges").update({ status: "succeeded", next_attempt_at: null, updated_at: at })
      .eq("provider_subscription_id", sub.provider_subscription_id).in("status", ["pending", "unknown", "charging"]).select("id");
    if (data?.length) { log("cobro de la prueba confirmado por webhook", { userId: sub.user_id, subscriptionId: sub.provider_subscription_id }); return; }
  }
  await db.from("trial_charges").update({ status: "superseded", next_attempt_at: null, updated_at: at }).eq("user_id", sub.user_id).in("status", ["scheduled", "retry_scheduled", "failed"]);
}

/** Webhook de renovación fallida de la suscripción creada por el cobro de la prueba: es el rechazo del día 7. true si era nuestra. */
export async function trialOnRenewalFailed(db: SupabaseClient, subscriptionId: string): Promise<boolean> {
  const { data } = await db.from("trial_charges").select(CHARGE_COLS).eq("provider_subscription_id", subscriptionId).in("status", ["pending", "unknown", "charging"]).maybeSingle();
  const r = data as TrialChargeRow | null;
  if (!r) return false;
  await decline(db, r, "rechazado por el banco (webhook)", subscriptionId);
  return true;
}

/** ¿Un cobro de la prueba de este cliente de ONVO está en vuelo? Entonces un webhook "desconocido" se reintenta (500). */
export async function trialChargeInFlight(db: SupabaseClient, customerId: string | null): Promise<boolean> {
  if (!customerId) return false;
  const { data: pm } = await db.from("payment_methods").select("user_id").eq("provider_customer_id", customerId).maybeSingle();
  if (!pm?.user_id) return false;
  const { data } = await db.from("trial_charges").select("id").eq("user_id", pm.user_id).in("status", ["charging", "unknown"]).maybeSingle();
  return Boolean(data);
}
