import "server-only";
// Tilopay (0042): cobros fuera de Costa Rica con nuestro propio motor de cobro. Servidor, service_role.
//
//   1. startTilopayCard(): pide a Tilopay la página segura para guardar la tarjeta y devuelve su URL. La persona vuelve a
//      /api/pagos/tilopay/vuelta con un estado firmado (HMAC, 2 horas) y la sesión abierta.
//   2. handleTilopayReturn(): guarda el token (saveVerifiedCard, mismas reglas de prueba que ONVO) o, en una compra directa,
//      confirma la orden CONSULTANDO a Tilopay (los parámetros del navegador nunca dan acceso solos).
//   3. sweepTilopayRenewals(): cron diario. Cobra con la tarjeta guardada al vencer el periodo; si se rechaza, past_due y
//      reintento diario hasta 3 veces; después se cancela.
// Regla de oro: solo la respuesta de Tilopay servidor a servidor (cobro o consulta) da acceso, vía activateVerified().
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/supabase/admin";
import type { Viewer } from "@/lib/supabase/server";
import type { SubscriptionRow } from "@/lib/entitlements";
import { PLANS, type Billing, type PlanId } from "@/lib/plans";
import { BillingError, SUB_COLS, activateVerified, recordAppEvent, syncProfilePlan } from "@/lib/billing";
import { cardSaveContext, emailOf, replaceCard, saveVerifiedCard, type SaveCardResult, type VerifiedCard } from "@/lib/trial-billing";
import { chargeBusy } from "@/lib/trial";
import { recordServerError } from "@/lib/monitor/server";
import { estimatePeriodEnd, expectedAmountMinor, profilePlanFor } from "@/lib/onvo";
import {
  chargeSavedCard, checkoutOrderNumber, consultOrder, createPaymentUrl, createTokenizeUrl, isTilopayConfigured, readReturn, tilopayOfferedTo,
  renewalOrderNumber, signState, tilopayCustomerId, tilopaySubId, type ChargeOutcome, type ReturnState,
} from "@/lib/tilopay";
import { sendPaymentFailed, sendSubscriptionCanceled } from "@/lib/email";
import { errInfo } from "@/lib/security/log";
import { logInfo } from "@/lib/log";
import { PENDING_PREFIX, RENEWAL_REVIEW_AFTER_MS, REVIEW_PREFIX, pendingRef, renewalNext, type RenewalStep } from "@/lib/tilopay-renewal";
export { RENEWAL_MAX_ATTEMPTS, renewalNext, type RenewalStep } from "@/lib/tilopay-renewal";

const log = (msg: string, meta?: Record<string, unknown>) => console.info(JSON.stringify({ scope: "tilopay", msg, ...meta }));
const alert = (msg: string, meta?: Record<string, unknown>) => console.error(JSON.stringify({ scope: "tilopay", msg: `ALERTA ${msg}`, ...meta }));
const nowIso = () => new Date().toISOString();
const planName = (p: PlanId | null) => PLANS.find((x) => x.id === p)?.name ?? "Banana Burn";

function admin(): SupabaseClient {
  const a = adminClient();
  if (!a) throw new BillingError("Pagos no configurados: falta SUPABASE_SERVICE_ROLE_KEY.", 503);
  return a;
}

/** Iniciar: solo a quien se le ofrece (modo staff = solo el equipo). La vuelta solo exige el motor encendido. */
function offered(v: Viewer) {
  if (!tilopayOfferedTo(v.role)) throw new BillingError("Los pagos con tarjetas de otros países aún no están activos.", 503);
}

function ready() {
  if (!isTilopayConfigured()) throw new BillingError("Los pagos con tarjetas de otros países aún no están activos.", 503);
}

/** Adónde vuelve la persona después de Tilopay. */
export type ReturnTo = "suscripcion" | "app";
const returnUrl = (origin: string, state: string) => `${origin}/api/pagos/tilopay/vuelta?s=${encodeURIComponent(state)}`;

// ───────────────────────── 1. Guardar tarjeta (prueba) ─────────────────────────

export async function startTilopayCard(v: Viewer, plan: PlanId, billing: Billing, origin: string): Promise<{ url: string }> {
  ready();
  offered(v);
  const db = admin();
  // Mismas reglas que con ONVO: si ya paga (y no puede cambiar la tarjeta de su plan) o hay un cobro en curso, no se abre la
  // página. Con un plan de Tilopay que se renueva, guardar la tarjeta la cambia para la renovación (trial-billing.ts).
  await cardSaveContext(db, v, new Date(), "tilopay");
  const state = signState({ u: v.id, p: "tarjeta", plan, billing, n: randomBytes(9).toString("base64url") });
  const url = await createTokenizeUrl({ redirect: returnUrl(origin, state), email: v.email, name: v.name });
  log("página para guardar tarjeta", { userId: v.id });
  return { url };
}

// ───────────────────────── Compra directa (página de pago) ─────────────────────────

export async function startTilopayCheckout(v: Viewer, plan: PlanId, billing: Billing, origin: string, country: string | null): Promise<{ url: string }> {
  ready();
  offered(v);
  const db = admin();
  const { data: rows } = await db.from("subscriptions").select(SUB_COLS).eq("user_id", v.id).order("created_at", { ascending: false }).limit(20);
  const subs = (rows as SubscriptionRow[] | null) ?? [];
  if (subs.some((r) => r.plan === plan && r.billing === billing && profilePlanFor(r) !== "free" && !r.cancel_at_period_end && r.status !== "canceled")) throw new BillingError("Ya tienes este plan activo.", 409);
  const { data: tc } = await db.from("trial_charges").select("status,last_error").eq("user_id", v.id).maybeSingle();
  if (chargeBusy(tc as { status: "unknown"; last_error: string | null } | null)) throw new BillingError("Estamos procesando el cobro de tu plan con tu tarjeta guardada. Revisa en unos minutos.", 409);

  const order = checkoutOrderNumber(randomBytes(12).toString("hex"));
  const subId = tilopaySubId(order);
  const { error } = await db.from("subscriptions").insert({
    user_id: v.id, provider: "tilopay", provider_customer_id: tilopayCustomerId(v.id), provider_subscription_id: subId,
    status: "incomplete", price_id: null, plan, billing,
  });
  if (error) throw new BillingError("No se pudo iniciar el pago. Intenta de nuevo.", 500);
  const state = signState({ u: v.id, p: "pago", plan, billing, n: randomBytes(9).toString("base64url"), o: order });
  const url = await createPaymentUrl({
    redirect: returnUrl(origin, state), email: v.email, name: v.name, amountMinor: expectedAmountMinor(plan, billing), orderNumber: order,
    country, returnData: Buffer.from(order).toString("base64"),
  });
  await recordAppEvent(db, `app.checkout_started:${subId}`, "app.checkout_started", v.id, subId, { plan, billing, provider: "tilopay" });
  log("checkout iniciado", { userId: v.id, plan, billing });
  return { url };
}

// ───────────────────────── 2. La vuelta ─────────────────────────

export type ReturnOutcome = "tarjeta_ok" | "pago_ok" | "confirmando" | "rechazada" | "sin_tarjeta";

let namesLogged = false;

export async function handleTilopayReturn(v: Viewer, s: ReturnState, q: URLSearchParams, now = new Date()): Promise<{ outcome: ReturnOutcome; result?: SaveCardResult }> {
  ready();
  const db = admin();
  const r = readReturn(q);
  // Los parámetros de vuelta de Tilopay no están documentados: anotamos SOLO sus nombres (nunca valores) para confirmarlos.
  if (!namesLogged) {
    namesLogged = true;
    logInfo("pagos", "tilopay_return_params", { purpose: s.p, names: [...new Set([...q.keys()])].filter((k) => k !== "s").sort().join(",").slice(0, 300) });
  }

  if (s.p === "tarjeta") {
    // Tilopay dijo que no (code distinto de "1"): nunca se guarda un token, aunque venga en la URL.
    if (r.code && r.code !== "1") return { outcome: "rechazada" };
    if (!r.token) return { outcome: "sin_tarjeta" };
    // El token viene del navegador (la vuelta de processTokenize no está documentada y no hay consulta para verificarlo).
    // Lo protege: el estado firmado de ESTA persona (la ruta), que no esté guardado en otra cuenta (storeCard) y que un
    // token inventado no da nada: la prueba gratis no depende de la tarjeta y el 50 % es solo el monto del primer cobro,
    // que con un token falso se rechaza (muro, como cualquier rechazo).
    const ctx = await cardSaveContext(db, v, now, "tilopay");
    const card: VerifiedCard = { provider: "tilopay", customerId: tilopayCustomerId(v.id), paymentMethodId: r.token, brand: r.brand, last4: r.last4, expMonth: null, expYear: null };
    if (ctx.mode === "replace") return { outcome: "tarjeta_ok", result: await replaceCard(db, v, card, ctx.subs, now) };
    const result = await saveVerifiedCard(db, v, card, { plan: s.plan, billing: s.billing }, ctx.row, ctx.plan, now);
    return { outcome: result.outcome === "rechazado" ? "rechazada" : result.outcome === "por_confirmar" ? "confirmando" : "tarjeta_ok", result };
  }

  // Compra directa: el número de orden viene del estado firmado, no del navegador.
  const order = s.o;
  if (!order) return { outcome: "rechazada" };
  if (r.order && r.order !== order) { alert("vuelta con otra orden", { userId: v.id }); return { outcome: "rechazada" }; }
  const outcome = await confirmCheckout(db, order, r.token, now, v.id);
  if (outcome === "rechazada" && r.code === "1") return { outcome: "confirmando" };
  return { outcome };
}

/**
 * Confirma una compra directa consultando la orden en Tilopay. Aprobada y con el monto esperado: activa y guarda la tarjeta
 * para las renovaciones. Rechazada: la suscripción pendiente vence. Sin respuesta clara: queda pendiente (el cron insiste).
 */
async function confirmCheckout(db: SupabaseClient, order: string, browserToken: string | null, now: Date, viewerId: string | null = null): Promise<ReturnOutcome> {
  const subId = tilopaySubId(order);
  const { data } = await db.from("subscriptions").select(SUB_COLS).eq("provider_subscription_id", subId).maybeSingle();
  const sub0 = data as SubscriptionRow | null;
  if (!sub0) return "rechazada";
  if (viewerId && sub0.user_id !== viewerId) { alert("vuelta de una compra de otra cuenta", { userId: viewerId }); return "rechazada"; }
  if (sub0.status === "active") return "pago_ok";
  // Siempre se consulta a Tilopay, aunque la fila ya no esté pendiente (p. ej. otro plan la reemplazó): si el cobro se
  // aprobó, nunca se pierde en silencio.
  const res = await consultOrder(order);
  if (res.state === "declined") {
    await db.from("subscriptions").update({ status: "expired", updated_at: nowIso() }).eq("id", sub0.id).eq("status", "incomplete");
    return "rechazada";
  }
  if (res.state !== "approved") return sub0.status === "incomplete" ? "confirmando" : "rechazada";
  let sub = sub0;
  if (sub0.status !== "incomplete") {
    // Aprobada pero la fila ya venció o se canceló. Si ya tiene otro plan pagado vigente, pagó dos veces: alerta de reembolso.
    const { data: others } = await db.from("subscriptions").select(SUB_COLS).eq("user_id", sub0.user_id).neq("id", sub0.id).in("status", ["active", "trialing", "past_due"]);
    if (((others as SubscriptionRow[] | null) ?? []).some((o) => profilePlanFor(o) !== "free")) {
      alert("compra Tilopay aprobada con otro plan ya activo: revisar reembolso", { userId: sub0.user_id, order });
      recordServerError("pagos/reembolso", "refund_review");
      return "pago_ok";
    }
    // Sin otro plan: se reactiva la fila y se activa con el cobro verificado.
    const { data: back } = await db.from("subscriptions").update({ status: "incomplete", cancel_at_period_end: false, canceled_at: null, updated_at: nowIso() }).eq("id", sub0.id).in("status", ["expired", "canceled"]).select(SUB_COLS);
    const row = (back as SubscriptionRow[] | null)?.[0];
    if (!row) return "confirmando";
    sub = row;
    log("compra Tilopay aprobada después de vencer: se reactiva", { userId: sub.user_id });
  }
  // La tarjeta para renovar: la que dice Tilopay en la consulta; la del navegador solo si no es de otra cuenta.
  let token = res.token;
  if (!token && browserToken) {
    const { data: taken } = await db.from("payment_methods").select("user_id").eq("provider_payment_method_id", browserToken).neq("user_id", sub.user_id).limit(1);
    token = taken?.length ? null : browserToken;
  }
  if (token) {
    const { error } = await db.from("payment_methods").upsert({
      user_id: sub.user_id, provider: "tilopay", provider_customer_id: tilopayCustomerId(sub.user_id), provider_payment_method_id: token,
      brand: null, last4: null, exp_month: null, exp_year: null, status: "active", disconnected_at: null, updated_at: now.toISOString(),
    }, { onConflict: "user_id" });
    if (error) alert("compra Tilopay aprobada pero no se pudo guardar la tarjeta: no podrá renovarse sola", { userId: sub.user_id });
  } else alert("compra Tilopay aprobada sin token de tarjeta: no podrá renovarse sola", { userId: sub.user_id });
  const r = await activateVerified(db, sub, {
    periodStart: now.toISOString(), periodEnd: estimatePeriodEnd(now, sub.billing ?? "mes").toISOString(),
    amountMinor: res.amountMinor, currency: res.currency, reference: order, provider: "tilopay",
  });
  return r.ok ? "pago_ok" : "confirmando";
}

// ───────────────────────── 3. Renovaciones ─────────────────────────
//
// Nunca se cobra dos veces una renovación: el MISMO UPDATE que reclama la fila (un solo proceso gana) deja la marca
// "por confirmar:<orden>" antes de llamar a Tilopay. Si el proceso se cae (tiempo de la función, error al activar), la
// próxima corrida ve la marca y solo CONSULTA esa orden. La marca se quita al saber el resultado. Más de un día sin
// respuesta: "revisar:<orden>", alerta y fila en app_errors (/admin/salud); se sigue consultando cada 6 horas.

type RenewalRow = SubscriptionRow & { renewal_attempts: number; next_renewal_attempt_at: string | null; last_renewal_error: string | null };
const RENEW_COLS = `${SUB_COLS},renewal_attempts,next_renewal_attempt_at,last_renewal_error`;

export type RenewalStats = { due: number; renewed: number; failed: number; canceled: number; pending: number; checkouts: number; errors: number };

type SweepOpts = { deadline?: number; limit?: number; chargeBy?: number };

export async function sweepTilopayRenewals(now = new Date(), opts: SweepOpts = {}): Promise<RenewalStats | null> {
  const out: RenewalStats = { due: 0, renewed: 0, failed: 0, canceled: 0, pending: 0, checkouts: 0, errors: 0 };
  if (!isTilopayConfigured()) return null;
  const db = adminClient();
  if (!db) return null;
  const time = () => !opts.deadline || Date.now() < opts.deadline;
  // Un cobro nuevo puede tardar hasta 20 s: no se empieza si no alcanza el tiempo de la función. Las consultas sí.
  const canCharge = () => time() && (!opts.chargeBy || Date.now() < opts.chargeBy);
  const limit = Math.min(opts.limit ?? 100, 500);
  const at = now.toISOString();
  const count = (res: string | null) => {
    if (res === "renewed") out.renewed++;
    else if (res === "retry") out.failed++;
    else if (res === "cancel") out.canceled++;
    else if (res === "wait") out.pending++;
  };
  try {
    // 1) Cobros por confirmar, aunque la persona haya cancelado después: se resuelven primero (solo consulta).
    const { data: pend, error: e1 } = await db.from("subscriptions").select(RENEW_COLS).eq("provider", "tilopay").in("status", ["active", "past_due"])
      .not("last_renewal_error", "is", null).lte("next_renewal_attempt_at", at).order("next_renewal_attempt_at").limit(limit);
    if (e1) throw new Error(e1.message);
    for (const r of ((pend as RenewalRow[] | null) ?? []).filter((x) => pendingRef(x.last_renewal_error))) {
      if (!time()) break;
      out.due++;
      count(await renewOne(db, r, now, canCharge).catch((e) => { out.errors++; log("renovación falló", { subId: r.id, error: errInfo(e) }); return null; }));
    }
    // 2) Renovaciones que vencieron (sin cancelar).
    const { data, error } = await db.from("subscriptions").select(RENEW_COLS).eq("provider", "tilopay").in("status", ["active", "past_due"]).eq("cancel_at_period_end", false)
      .lte("current_period_end", at).or(`next_renewal_attempt_at.is.null,next_renewal_attempt_at.lte.${at}`).order("current_period_end").limit(limit);
    if (error) throw new Error(error.message);
    for (const r of ((data as RenewalRow[] | null) ?? []).filter((x) => !pendingRef(x.last_renewal_error))) {
      if (!canCharge()) break;
      out.due++;
      count(await renewOne(db, r, now, canCharge).catch((e) => { out.errors++; log("renovación falló", { subId: r.id, error: errInfo(e) }); return null; }));
    }
    // 3) Canceladas por la persona que ya llegaron al fin del periodo: quedan canceladas (con ONVO lo hace su webhook).
    //    Las que tienen un cobro por confirmar esperan a saber el resultado (paso 1).
    const { data: ending } = await db.from("subscriptions").select("id,user_id,last_renewal_error").eq("provider", "tilopay").in("status", ["active", "past_due"]).eq("cancel_at_period_end", true).lte("current_period_end", at).limit(limit);
    for (const e of ((ending as { id: number; user_id: string; last_renewal_error: string | null }[] | null) ?? []).filter((x) => !pendingRef(x.last_renewal_error))) {
      if (!time()) break;
      const { data: done } = await db.from("subscriptions").update({ status: "canceled", next_renewal_attempt_at: null, last_event_at: at, updated_at: at }).eq("id", e.id).eq("cancel_at_period_end", true).in("status", ["active", "past_due"]).select("id");
      if (done?.length) { out.canceled++; await syncProfilePlan(db, e.user_id); }
    }
    // 4) Compras directas pendientes de las últimas 24 h: se vuelve a consultar la orden.
    const { data: inc } = await db.from("subscriptions").select("provider_subscription_id,created_at").eq("provider", "tilopay").eq("status", "incomplete").like("provider_subscription_id", "tlp:bbc-%")
      .gte("created_at", new Date(now.getTime() - 864e5).toISOString()).lte("created_at", new Date(now.getTime() - 10 * 60_000).toISOString()).limit(limit);
    for (const s of (inc as { provider_subscription_id: string }[] | null) ?? []) {
      if (!time()) break;
      out.checkouts++;
      await confirmCheckout(db, s.provider_subscription_id.slice(4), null, now).catch((e) => { out.errors++; log("consulta de compra falló", { error: errInfo(e) }); });
    }
  } catch (e) {
    out.errors++;
    log("barrido de renovaciones falló", { error: errInfo(e) });
  }
  if (out.due || out.checkouts) log("barrido de renovaciones", out);
  return out;
}

/** Reintento inmediato de las renovaciones de una persona (p. ej. justo después de cambiar la tarjeta). Nunca lanza. */
export async function renewDueForUser(userId: string, now = new Date()): Promise<void> {
  const db = adminClient();
  if (!db || !isTilopayConfigured()) return;
  const at = now.toISOString();
  const { data } = await db.from("subscriptions").select(RENEW_COLS).eq("user_id", userId).eq("provider", "tilopay").in("status", ["active", "past_due"])
    .lte("current_period_end", at).lte("next_renewal_attempt_at", at).limit(5);
  for (const r of (data as RenewalRow[] | null) ?? []) {
    if (r.cancel_at_period_end && !pendingRef(r.last_renewal_error)) continue;
    await renewOne(db, r, now, () => true).catch((e) => log("renovación inmediata falló", { subId: r.id, error: errInfo(e) }));
  }
}

async function renewOne(db: SupabaseClient, r: RenewalRow, now: Date, canCharge: () => boolean): Promise<RenewalStep["do"] | "omitido"> {
  if (!r.plan || !r.billing || !r.current_period_end) return "omitido";
  const at = now.toISOString();
  const waiting = pendingRef(r.last_renewal_error);
  if (!waiting && (r.cancel_at_period_end || !canCharge())) return "omitido";
  // Reclamo: un solo proceso gana (los intentos y el próximo intento tienen que seguir igual). Un cobro NUEVO deja en el
  // mismo UPDATE la marca "por confirmar:<orden>" y exige que la persona no haya cancelado.
  const attempt = waiting ? r.renewal_attempts : r.renewal_attempts + 1;
  const order = waiting ?? renewalOrderNumber(r.id, r.current_period_end, attempt);
  const claimFields: Record<string, unknown> = { renewal_attempts: attempt, next_renewal_attempt_at: new Date(now.getTime() + 15 * 60_000).toISOString(), updated_at: at };
  if (!waiting) claimFields.last_renewal_error = `${PENDING_PREFIX}${order}`;
  let claim = db.from("subscriptions").update(claimFields).eq("id", r.id).eq("renewal_attempts", r.renewal_attempts).eq("current_period_end", r.current_period_end);
  claim = r.next_renewal_attempt_at ? claim.eq("next_renewal_attempt_at", r.next_renewal_attempt_at) : claim.is("next_renewal_attempt_at", null);
  if (!waiting) claim = claim.eq("cancel_at_period_end", false);
  const { data: won } = await claim.select("id");
  if (!won?.length) return "omitido";

  const amount = expectedAmountMinor(r.plan, r.billing);
  let outcome: ChargeOutcome["state"] | "sin_tarjeta";
  let reason = "";
  if (waiting) {
    const c = await consultOrder(order);
    outcome = c.state;
    reason = c.state === "declined" ? "rechazado (consulta)" : "sin respuesta de la consulta";
  } else {
    const { data: card } = await db.from("payment_methods").select("provider,provider_payment_method_id,status").eq("user_id", r.user_id).maybeSingle();
    const email = await emailOf(db, r.user_id);
    if (!card || card.provider !== "tilopay" || card.status !== "active" || !email) {
      outcome = "sin_tarjeta";
      reason = "sin tarjeta de Tilopay guardada";
    } else {
      const c = await chargeSavedCard({ token: card.provider_payment_method_id as string, email, amountMinor: amount, orderNumber: order });
      outcome = c.state;
      reason = c.state === "declined" ? c.description : c.state === "unknown" ? c.error : "";
    }
  }

  const step = renewalNext(attempt, outcome, now);
  if (step.do === "renewed") {
    const start = r.current_period_end;
    const end = estimatePeriodEnd(new Date(start), r.billing).toISOString();
    // activateVerified es idempotente por la orden (payment_events): si se cae aquí, la consulta lo vuelve a activar sin cobrar.
    await activateVerified(db, r, { periodStart: start, periodEnd: end, amountMinor: amount, currency: "USD", reference: order, provider: "tilopay" });
    await db.from("subscriptions").update({ renewal_attempts: 0, next_renewal_attempt_at: null, last_renewal_error: null, updated_at: nowIso() }).eq("id", r.id);
    log("renovación cobrada", { userId: r.user_id, subId: r.id });
    return "renewed";
  }
  if (step.do === "wait") {
    // Más de un día sin respuesta: revisión del equipo (se sigue consultando cada 6 horas, nunca se cobra de nuevo).
    const stuck = now.getTime() - Date.parse(r.current_period_end) > RENEWAL_REVIEW_AFTER_MS;
    await db.from("subscriptions").update({
      next_renewal_attempt_at: stuck ? new Date(now.getTime() + 6 * 3600_000).toISOString() : step.nextAt,
      last_renewal_error: `${stuck ? REVIEW_PREFIX : PENDING_PREFIX}${order}`, updated_at: nowIso(),
    }).eq("id", r.id);
    alert(stuck ? "renovación Tilopay sin confirmar hace más de un día: revisar en el portal de Tilopay" : "renovación Tilopay por confirmar", { subId: r.id, order });
    if (stuck) recordServerError("pagos/renovacion-por-confirmar", "renewal_review");
    return "wait";
  }
  const pn = planName(r.plan);
  if (step.do === "retry") {
    await db.from("subscriptions").update({ status: "past_due", next_renewal_attempt_at: step.nextAt, last_renewal_error: reason.slice(0, 300) || "rechazado", last_event_at: nowIso(), updated_at: nowIso() }).eq("id", r.id);
    await syncProfilePlan(db, r.user_id);
    await sendPaymentFailed({ userId: r.user_id, plan: pn, amount: amount / 100, currency: "USD", reference: `${order}:rechazo`, retryDate: step.nextAt, updateUrl: "/app/suscripcion#tarjeta" }).catch(() => null);
    log("renovación rechazada", { userId: r.user_id, subId: r.id, attempt });
    return "retry";
  }
  await db.from("subscriptions").update({ status: "canceled", cancel_at_period_end: false, canceled_at: nowIso(), next_renewal_attempt_at: null, last_renewal_error: reason.slice(0, 300) || "rechazado", last_event_at: nowIso(), updated_at: nowIso() }).eq("id", r.id);
  await syncProfilePlan(db, r.user_id);
  await sendSubscriptionCanceled({ userId: r.user_id, plan: pn, accessUntil: r.current_period_end, subscriptionId: r.provider_subscription_id ?? undefined }).catch(() => null);
  log("renovación cancelada tras los reintentos", { userId: r.user_id, subId: r.id });
  return "cancel";
}
