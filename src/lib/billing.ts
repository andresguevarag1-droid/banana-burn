import "server-only";
// Orquestación de pagos (servidor): ONVO y Tilopay + Supabase con service_role.
// Regla de oro: solo un resultado del procesador verificado servidor a servidor sube a un usuario a plan pagado:
//   - ONVO: el webhook autenticado (processWebhook), o la consulta de la suscripción con la llave secreta.
//   - Tilopay: la respuesta del cobro con la tarjeta guardada o la consulta de la orden (tilopay-billing.ts →
//     activateVerified). Los webhooks de Tilopay no vienen firmados: nunca dan acceso.
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/supabase/admin";
import type { Viewer } from "@/lib/supabase/server";
import type { SubscriptionRow } from "@/lib/entitlements";
import { PLANS, type Billing, type PlanId } from "@/lib/plans";
import { sendPaymentFailed, sendPaymentReceipt, sendSubscriptionCanceled } from "@/lib/email";
import { errInfo } from "@/lib/security/log";
import { chargeBusy } from "@/lib/trial";
import { markCardsPaid } from "@/lib/card-fingerprint";
import { recordServerError } from "@/lib/monitor/server";
import {
  OnvoError, actionForEvent, cancelSubscription, createCustomer, createSubscription, estimatePeriodEnd, eventKey,
  expectedAmountMinor, fetchSubscriptionState, priceIdFor, profilePlanFor, type OnvoEvent,
} from "@/lib/onvo";

export const SUB_COLS = "id,user_id,provider,provider_customer_id,provider_subscription_id,status,price_id,plan,billing,cancel_at_period_end,canceled_at,current_period_start,current_period_end,created_at";

/**
 * Primer mes con 50 % en ONVO (0043): ONVO no tiene cupones para suscripciones, así que ese mes es un cobro único
 * (PaymentIntent) y su fila en `subscriptions` lleva este prefijo + el ID del PaymentIntent. No existe como suscripción en
 * ONVO: nunca se cancela allá; al terminar el mes, onvo-intro.ts crea la suscripción normal a precio completo.
 */
export const INTRO_PREFIX = "onvo-pi:";
export const isIntroSub = (id: string | null | undefined) => !!id && id.startsWith(INTRO_PREFIX);

export class BillingError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

function admin(): SupabaseClient {
  const a = adminClient();
  if (!a) throw new BillingError("Pagos no configurados: falta SUPABASE_SERVICE_ROLE_KEY.", 503);
  return a;
}

const log = (msg: string, meta?: Record<string, unknown>) => console.info(JSON.stringify({ scope: "pagos", msg, ...meta }));

// ───────────────────────── Checkout ─────────────────────────

export async function getOrCreateCustomer(db: SupabaseClient, v: Viewer): Promise<string> {
  const { data } = await db.from("billing_customers").select("provider_customer_id").eq("user_id", v.id).maybeSingle();
  if (data?.provider_customer_id) return data.provider_customer_id as string;
  const c = await createCustomer({ email: v.email, name: v.name, userId: v.id });
  if (!c?.id) throw new BillingError("ONVO no devolvió el cliente.", 502);
  const { error } = await db.from("billing_customers").insert({ user_id: v.id, provider_customer_id: c.id });
  if (error) {
    // Carrera: otro request lo creó primero -> usamos el guardado.
    const { data: again } = await db.from("billing_customers").select("provider_customer_id").eq("user_id", v.id).maybeSingle();
    if (again?.provider_customer_id) return again.provider_customer_id as string;
    throw new BillingError("No se pudo guardar el cliente de pago.", 500);
  }
  log("cliente ONVO creado", { userId: v.id, customerId: c.id });
  return c.id;
}

/**
 * Crea (o reutiliza) una suscripción pendiente en ONVO y devuelve la URL de nuestra página de pago,
 * donde el SDK de ONVO confirma el primer cobro. Precio = el configurado en el servidor, nunca el del cliente.
 */
export async function startCheckout(v: Viewer, plan: PlanId, billing: Billing): Promise<{ url: string; subscriptionId: string }> {
  const db = admin();
  const priceId = priceIdFor(plan, billing);
  if (!priceId) throw new BillingError("Este plan aún no está disponible para pago.", 503);

  const { data: rows } = await db.from("subscriptions").select(SUB_COLS).eq("user_id", v.id).order("created_at", { ascending: false }).limit(20);
  const subs = (rows as SubscriptionRow[] | null) ?? [];

  const same = subs.find((r) => r.plan === plan && r.billing === billing && profilePlanFor(r) !== "free" && !r.cancel_at_period_end && r.status !== "canceled");
  if (same) throw new BillingError("Ya tienes este plan activo.", 409);

  // Cobro con la tarjeta guardada (0026) en curso: no abrimos otro pago en paralelo. Sus suscripciones no se reutilizan aquí
  // (las cobra el servidor con la tarjeta guardada, no el SDK).
  const { data: tc } = await db.from("trial_charges").select("status,provider_subscription_id,last_error").eq("user_id", v.id).maybeSingle();
  // Un cobro marcado para revisión (más de un día sin confirmar, trial.ts) ya no bloquea: la persona puede pagar aquí.
  if (chargeBusy(tc as { status: "unknown"; last_error: string | null } | null)) throw new BillingError("Estamos procesando el cobro de tu plan con tu tarjeta guardada. Revisa en unos minutos.", 409);
  const trialSub = (tc?.provider_subscription_id as string | null | undefined) ?? null;

  // Reutiliza una pendiente reciente del mismo plan (doble clic, volver atrás).
  const hourAgo = Date.now() - 3600_000;
  const pending = subs.find((r) => r.status === "incomplete" && r.plan === plan && r.billing === billing && r.price_id === priceId && new Date(r.created_at).getTime() > hourAgo && r.provider_subscription_id && r.provider_subscription_id !== trialSub);
  if (pending) return { url: `/pago/checkout?s=${encodeURIComponent(pending.provider_subscription_id!)}`, subscriptionId: pending.provider_subscription_id! };

  const customerId = await getOrCreateCustomer(db, v);
  const sub = await createSubscription({ customerId, plan, billing, userId: v.id });
  if (!sub?.id) throw new BillingError("ONVO no devolvió la suscripción.", 502);

  const { error } = await db.from("subscriptions").insert({
    user_id: v.id, provider: "onvo", provider_customer_id: customerId, provider_subscription_id: sub.id,
    status: "incomplete", price_id: priceId, plan, billing,
  });
  if (error) {
    log("no se pudo guardar la suscripción pendiente; se cancela en ONVO", { userId: v.id, subscriptionId: sub.id, error: error.message });
    await cancelSubscription(sub.id).catch(() => {});
    throw new BillingError("No se pudo iniciar el pago. Intenta de nuevo.", 500);
  }
  await recordAppEvent(db, `app.checkout_started:${sub.id}`, "app.checkout_started", v.id, sub.id, { plan, billing, priceId });
  log("checkout iniciado", { userId: v.id, subscriptionId: sub.id, plan, billing });
  return { url: `/pago/checkout?s=${encodeURIComponent(sub.id)}`, subscriptionId: sub.id };
}

// ───────────────────────── Cancelación ─────────────────────────

/** Cancela al final del periodo: corta la renovación en ONVO ya y conserva el acceso hasta current_period_end. */
export async function cancelAtPeriodEnd(v: Viewer, reason?: string): Promise<{ endsAt: string | null }> {
  return cancelAtPeriodEndFor(v.id, reason);
}

/** Igual que cancelAtPeriodEnd, por id de cuenta (el panel del superadmin, 0056). */
export async function cancelAtPeriodEndFor(userId: string, reason?: string): Promise<{ endsAt: string | null }> {
  const v = { id: userId };
  const db = admin();
  const { data: rows } = await db.from("subscriptions").select(SUB_COLS).eq("user_id", v.id).in("status", ["active", "trialing", "past_due"]).eq("cancel_at_period_end", false);
  const subs = (rows as SubscriptionRow[] | null) ?? [];
  if (!subs.length) throw new BillingError("No tienes una suscripción activa para cancelar.", 404);
  let endsAt: string | null = null;
  for (const r of subs) {
    // Tilopay y el primer mes con 50 % de ONVO: la renovación la hacemos nosotros, así que cancelar es solo no cobrar el
    // próximo periodo.
    if (r.provider_subscription_id && r.provider !== "tilopay" && !isIntroSub(r.provider_subscription_id)) {
      try {
        await cancelSubscription(r.provider_subscription_id);
      } catch (e) {
        // 404 = ya no existe en ONVO -> seguimos; otros errores sí detienen.
        if (!(e instanceof OnvoError && e.status === 404)) {
          log("error cancelando en ONVO", { userId: v.id, subscriptionId: r.provider_subscription_id, error: errInfo(e) });
          throw new BillingError("No pudimos cancelar con el procesador de pagos. Intenta de nuevo o escríbenos.", 502);
        }
      }
    }
    await db.from("subscriptions").update({ cancel_at_period_end: true, canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", r.id);
    await recordAppEvent(db, `app.cancel_requested:${r.provider_subscription_id ?? r.id}`, "app.cancel_requested", v.id, r.provider_subscription_id, { reason: reason?.slice(0, 200) ?? null });
    if (r.current_period_end && (!endsAt || r.current_period_end > endsAt)) endsAt = r.current_period_end;
  }
  log("cancelación al final del periodo", { userId: v.id, endsAt });
  return { endsAt };
}

export async function recordAppEvent(db: SupabaseClient, key: string, type: string, userId: string, subId: string | null, payload: Record<string, unknown>) {
  const { error } = await db.from("payment_events").insert({ event_key: key, type, user_id: userId, provider_subscription_id: subId, status: "processed", payload, processed_at: new Date().toISOString() });
  if (error && !/duplicate|unique/i.test(error.message)) log("no se pudo registrar evento de app", { key, error: error.message });
}

// ───────────────────────── Webhook ─────────────────────────

export type WebhookResult = { status: "processed" | "ignored" | "duplicate" | "error"; note?: string };

async function setProfilePlan(db: SupabaseClient, userId: string, plan: "entreno" | "completo" | "free") {
  const { error } = await db.from("profiles").update({ plan }).eq("id", userId);
  if (error) throw new Error(`profiles.plan: ${error.message}`);
}

/**
 * Recalcula el plan del perfil a partir de TODAS sus suscripciones y cortesías vigentes (el mejor plan gana).
 * Los regalos y recompensas por referidos (0025) no cuentan: la app y la base los leen directo de comp_grants, y si
 * subieran el plan del perfil nadie lo bajaría al vencer.
 */
export async function syncProfilePlan(db: SupabaseClient, userId: string) {
  const now = new Date().toISOString();
  const [{ data }, { data: comps }] = await Promise.all([
    db.from("subscriptions").select(SUB_COLS).eq("user_id", userId),
    db.from("comp_grants").select("*").eq("user_id", userId).is("revoked_at", null).gt("expires_at", now).lte("starts_at", now),
  ]);
  const legacy = ((comps as { plan: string; source?: string | null }[] | null) ?? []).filter((c) => !c.source || c.source === "cortesia");
  const plans: string[] = [...((data as SubscriptionRow[] | null) ?? []).map((r) => profilePlanFor(r)), ...legacy.map((c) => c.plan)];
  const plan = plans.includes("completo") ? "completo" : plans.includes("entreno") ? "entreno" : "free";
  await setProfilePlan(db, userId, plan);
  return plan;
}

/** Al activarse un plan nuevo, cancela los demás del usuario (cambio de plan). */
async function cancelOthers(db: SupabaseClient, keep: SubscriptionRow) {
  const { data } = await db.from("subscriptions").select(SUB_COLS).eq("user_id", keep.user_id).neq("id", keep.id).in("status", ["active", "trialing", "past_due", "incomplete"]);
  const now = Date.now();
  for (const r of (data as SubscriptionRow[] | null) ?? []) {
    // Un plan PAGADO hace poco se reemplaza (dos cobros casi juntos: compra directa y cobro de la tarjeta, o dos pestañas):
    // el equipo revisa si corresponde un reembolso. Queda en los registros y en app_errors (/admin/salud).
    const paidRecently = r.status !== "incomplete" && !!r.current_period_start && now - Date.parse(r.current_period_start) < 3 * 864e5 && !!r.current_period_end && Date.parse(r.current_period_end) > now + 864e5;
    if (paidRecently) {
      console.error(JSON.stringify({ scope: "pagos", msg: "ALERTA plan pagado hace menos de 3 días reemplazado por otro: revisar reembolso", userId: keep.user_id, replaced: r.provider_subscription_id, by: keep.provider_subscription_id }));
      recordServerError("pagos/reembolso", "refund_review");
    }
    if (r.provider_subscription_id && r.provider !== "tilopay" && !isIntroSub(r.provider_subscription_id)) await cancelSubscription(r.provider_subscription_id).catch((e) => log("no se pudo cancelar plan anterior en ONVO", { id: r.provider_subscription_id, error: errInfo(e) }));
    await db.from("subscriptions").update({ status: r.status === "incomplete" ? "expired" : "canceled", cancel_at_period_end: false, canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", r.id);
    log("plan anterior reemplazado", { userId: keep.user_id, replaced: r.provider_subscription_id, by: keep.provider_subscription_id });
  }
}

async function activate(db: SupabaseClient, row: SubscriptionRow, a: { periodStart: string | null; periodEnd: string | null; customerId: string | null }) {
  const now = new Date();
  const start = a.periodStart ?? row.current_period_start ?? now.toISOString();
  const end = a.periodEnd ?? estimatePeriodEnd(new Date(start), row.billing ?? "mes").toISOString();
  // Eventos fuera de orden: nunca retrocedemos el fin de periodo.
  const keepEnd = row.current_period_end && row.current_period_end > end ? row.current_period_end : end;
  const { error } = await db.from("subscriptions").update({
    status: "active", current_period_start: start, current_period_end: keepEnd,
    provider_customer_id: a.customerId ?? row.provider_customer_id, last_event_at: now.toISOString(), updated_at: now.toISOString(),
  }).eq("id", row.id);
  if (error) throw new Error(`subscriptions: ${error.message}`);
  const updated = { ...row, status: "active", current_period_end: keepEnd };
  await cancelOthers(db, updated);
  // Primer cobro de la prueba (0026): queda cobrado; o, si pagó por otro lado, el cobro programado ya no se hace.
  const { trialOnActivated } = await import("@/lib/trial-billing");
  await trialOnActivated(db, row);
  const plan = await syncProfilePlan(db, row.user_id);
  // 0045: sus tarjetas quedan como "ya pagó" (la promoción del primer mes no vuelve con la misma tarjeta en otra cuenta).
  await markCardsPaid(db, row.user_id);
  if (row.billing === "anual") await referralAnnualPaid(db, row.user_id);
  return plan;
}

/**
 * Referidos: una compra ANUAL confirmada por este webhook (único camino) puede subir la recompensa de quien invitó de
 * 1 mes a un trimestre. Idempotente en la base (renovaciones y reintentos no suman). Nunca hace fallar el webhook.
 */
async function referralAnnualPaid(db: SupabaseClient, userId: string) {
  const { data, error } = await db.rpc("referral_annual_paid", { p_user: userId });
  if (error && !["PGRST202", "42883"].includes(error.code ?? "")) log("referidos: no se pudo anotar la compra anual", { userId, code: error.code ?? null });
  else if (data && data !== "sin_cambio") log("referidos: compra anual", { userId, result: String(data) });
}

/**
 * Valida el cobro informado por ONVO contra el precio del servidor (plans.ts). Pura y testeada.
 * - Moneda distinta de USD o monto menor al esperado: no se activa.
 * - Monto mayor (p. ej. impuestos): se activa con nota.
 * - ONVO no informó monto: se activa (el evento ya viene autenticado y la suscripción la creamos con el priceId del servidor).
 */
export function checkPaidAmount(row: { plan: PlanId | null; billing: Billing | null }, amountMinor: number | null, currency: string | null, expectedMinor?: number | null): { ok: boolean; note?: string } {
  if (currency && currency.toUpperCase() !== "USD") return { ok: false, note: `moneda ${currency} (se esperaba USD)` };
  if (!row.plan || !row.billing || amountMinor === null) return { ok: true };
  // `expectedMinor`: solo el primer cobro con el 50 % del primer mes (0043), calculado por el servidor desde trial_charges.
  const expected = expectedMinor ?? expectedAmountMinor(row.plan, row.billing);
  if (amountMinor < expected) return { ok: false, note: `monto ${amountMinor} < ${expected} centavos USD de plans.ts` };
  if (amountMinor > expected) return { ok: true, note: `monto ${amountMinor} > ${expected} centavos USD de plans.ts (revisa el precio en ONVO)` };
  return { ok: true };
}

const planName = (p: PlanId | null) => PLANS.find((x) => x.id === p)?.name ?? "Banana Burn";

/**
 * Activa (o renueva) una suscripción con un cobro YA verificado servidor a servidor (Tilopay: respuesta del cobro con la
 * tarjeta guardada o consulta de la orden). Valida el monto contra plans.ts, deja el evento en payment_events (idempotente
 * por `reference`), cancela los otros planes, cierra el cobro de la prueba, recalcula el plan y manda el recibo.
 */
export async function activateVerified(db: SupabaseClient, row: SubscriptionRow, a: { periodStart: string; periodEnd: string; amountMinor: number | null; currency: string | null; reference: string; provider: "tilopay" | "onvo"; expectedMinor?: number | null }): Promise<{ ok: boolean; plan?: string; note?: string }> {
  const check = checkPaidAmount(row, a.amountMinor, a.currency, a.expectedMinor);
  const key = `${a.provider}.charge.approved:${a.reference}`;
  const ins = await db.from("payment_events").insert({
    provider: a.provider, event_key: key, type: "charge.approved", user_id: row.user_id, provider_subscription_id: row.provider_subscription_id,
    amount_minor: a.amountMinor, currency: a.currency, period_start: a.periodStart, period_end: a.periodEnd, status: "received", payload: { reference: a.reference },
  }).select("id").single();
  if (ins.error) {
    const { data: prev } = await db.from("payment_events").select("id,status").eq("event_key", key).maybeSingle();
    if (prev?.status === "processed") return { ok: true, note: "duplicado" };
    if (!prev) throw new Error(`payment_events: ${ins.error.message}`);
  }
  const done = async (status: "processed" | "ignored", note: string | null) => { await db.from("payment_events").update({ status, note, processed_at: new Date().toISOString() }).eq("event_key", key); };
  if (!check.ok) {
    console.error(JSON.stringify({ scope: "pagos", msg: "ALERTA monto inválido: no se activa", provider: a.provider, userId: row.user_id, subscriptionId: row.provider_subscription_id, note: check.note }));
    await done("ignored", `NO ACTIVADA: ${check.note}`);
    return { ok: false, note: check.note };
  }
  // Renovación: el periodo nuevo empieza donde terminó el anterior (activate nunca retrocede el fin).
  const plan = await activate(db, row, { periodStart: a.periodStart, periodEnd: a.periodEnd, customerId: null });
  await notifyPaid(db, a.provider, row, a.amountMinor, a.currency, a.periodEnd, a.reference, a.expectedMinor != null && row.plan && row.billing ? expectedAmountMinor(row.plan, row.billing) / 100 : null);
  await done("processed", check.note ? `${check.note}, plan=${plan}` : `plan=${plan}`);
  log("cobro verificado activado", { provider: a.provider, userId: row.user_id, subscriptionId: row.provider_subscription_id, plan });
  return { ok: true, plan };
}

/**
 * Todo pago verificado pasa por aquí (ONVO webhook, primer mes con 50 %, Tilopay, renovaciones y anuales): recibo por correo
 * (idempotente por referencia) y comisión del referidor si la persona llegó con un enlace de referidor (0051, idempotente por
 * pago). Nunca bloquea el webhook ni el cobro.
 */
async function notifyPaid(db: SupabaseClient, provider: "onvo" | "tilopay", row: SubscriptionRow, amountMinor: number | null, currency: string | null, periodEnd: string | null, reference: string, promoFull: number | null = null) {
  const amount = amountMinor != null ? amountMinor / 100 : row.plan && row.billing ? expectedAmountMinor(row.plan, row.billing) / 100 : 0;
  await sendPaymentReceipt({ userId: row.user_id, plan: planName(row.plan), amount, currency: currency ?? "USD", reference, nextCharge: periodEnd, promoFull }).catch(() => {});
  const { affiliateOnPaid } = await import("@/lib/affiliates-server");
  await affiliateOnPaid(db, { userId: row.user_id, provider, reference, amountMinor, currency, plan: row.plan, billing: row.billing }).catch(() => "error");
}

/**
 * Procesa un evento ya verificado. Idempotente: el mismo evento dos veces no hace nada la segunda.
 * Devuelve "error" para que la ruta responda 500 y ONVO reintente.
 */
export async function processWebhook(evt: OnvoEvent, rawBody: string): Promise<WebhookResult> {
  const db = admin();
  const key = eventKey(evt, rawBody);
  const action = actionForEvent(evt);
  const subId = action.kind === "activate" || action.kind === "renewal_failed" ? action.subscriptionId : null;
  const piId = "paymentIntentId" in action ? action.paymentIntentId : null;

  // 1) Registrar (o detectar duplicado).
  const base = {
    event_key: key, type: evt.type, provider_subscription_id: subId, provider_payment_intent_id: piId,
    amount_minor: "amountMinor" in action ? action.amountMinor : null, currency: "currency" in action ? action.currency : null,
    period_start: action.kind === "activate" ? action.periodStart : null,
    period_end: action.kind === "activate" || action.kind === "renewal_failed" ? action.periodEnd : null,
    payload: evt as unknown as Record<string, unknown>,
  };
  const ins = await db.from("payment_events").insert({ ...base, status: "received" }).select("id").single();
  let eventId: number;
  if (ins.error) {
    const { data: prev } = await db.from("payment_events").select("id,status,attempts").eq("event_key", key).maybeSingle();
    if (!prev) throw new Error(`payment_events: ${ins.error.message}`);
    if (prev.status === "processed" || prev.status === "ignored") { log("evento duplicado", { key }); return { status: "duplicate" }; }
    eventId = prev.id as number;
    await db.from("payment_events").update({ attempts: (prev.attempts as number) + 1 }).eq("id", eventId);
  } else eventId = ins.data.id as number;

  const finish = async (status: "processed" | "ignored" | "error", note: string | undefined, userId?: string | null) => {
    await db.from("payment_events").update({ status, note: note ?? null, user_id: userId ?? undefined, processed_at: new Date().toISOString() }).eq("id", eventId);
    log(`webhook ${status}`, { key, type: evt.type, note, userId });
    return { status, note } as WebhookResult;
  };

  try {
    if (action.kind === "ignore") return finish("ignored", action.reason);

    // Pago único: primero vemos si es la compra de un reto de la tienda (se identifica por el ID del PaymentIntent).
    if ((action.kind === "verify_customer" || action.kind === "payment_intent") && action.paymentIntentId) {
      const { grantChallengePurchase } = await import("@/lib/challenge-purchase");
      const g = await grantChallengePurchase(db, action.paymentIntentId, action.amountMinor, action.currency);
      if (g) return finish(g.status, g.note, g.userId);
    }
    if (action.kind === "payment_intent") return finish("ignored", "payment intent sin cliente y sin compra de reto");

    if (action.kind === "activate") {
      const { data } = await db.from("subscriptions").select(SUB_COLS).eq("provider_subscription_id", action.subscriptionId).maybeSingle();
      const row = data as SubscriptionRow | null;
      if (!row) {
        // El cobro con la tarjeta guardada (0026) puede llegar antes de que registremos la suscripción: error = ONVO reintenta,
        // y attemptCharge() lo reprocesa en cuanto la registra.
        const { trialChargeInFlight } = await import("@/lib/trial-billing");
        if (await trialChargeInFlight(db, action.customerId)) return finish("error", "cobro de la prueba aún sin registrar");
        return finish("ignored", "suscripción desconocida (no creada desde la app)");
      }
      const check = checkPaidAmount(row, action.amountMinor, action.currency);
      if (!check.ok) {
        // Nunca otorgamos un plan con un cobro menor al precio del servidor o en otra moneda. Queda para revisión manual.
        console.error(JSON.stringify({ scope: "pagos", msg: "ALERTA monto inválido: no se activa", userId: row.user_id, subscriptionId: row.provider_subscription_id, note: check.note }));
        return finish("ignored", `NO ACTIVADA: ${check.note}`, row.user_id);
      }
      const note = check.note;
      const plan = await activate(db, row, action);
      await notifyPaid(db, "onvo", row, action.amountMinor, action.currency, action.periodEnd, action.paymentIntentId ?? key);
      return finish("processed", note ? `${note}, plan=${plan}` : `plan=${plan}`, row.user_id);
    }

    if (action.kind === "renewal_failed") {
      const { data } = await db.from("subscriptions").select(SUB_COLS).eq("provider_subscription_id", action.subscriptionId).maybeSingle();
      const row = data as SubscriptionRow | null;
      if (!row) return finish("ignored", "suscripción desconocida");
      // Primer cobro de la prueba rechazado: muro, aviso y un solo reintento al día 8 (trial-billing.ts), no past_due.
      const { trialOnRenewalFailed } = await import("@/lib/trial-billing");
      if (await trialOnRenewalFailed(db, action.subscriptionId)) return finish("processed", "rechazo del primer cobro de la prueba", row.user_id);
      const status = action.terminal ? "canceled" : "past_due";
      await db.from("subscriptions").update({ status, cancel_at_period_end: false, canceled_at: action.terminal ? new Date().toISOString() : row.canceled_at, last_event_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", row.id);
      const plan = await syncProfilePlan(db, row.user_id);
      const pn = planName(row.plan);
      if (action.terminal) await sendSubscriptionCanceled({ userId: row.user_id, plan: pn, accessUntil: row.current_period_end, subscriptionId: row.provider_subscription_id ?? undefined }).catch(() => {});
      else await sendPaymentFailed({ userId: row.user_id, plan: pn, amount: row.plan && row.billing ? expectedAmountMinor(row.plan, row.billing) / 100 : 0, currency: "USD", reference: key, updateUrl: "/app/suscripcion" }).catch(() => {});
      return finish("processed", `renovación fallida -> ${status} (ONVO: ${action.subscriptionStatus ?? "?"}), plan=${plan}`, row.user_id);
    }

    // verify_customer: payment-intent.succeeded de un cliente con suscripción pendiente.
    const { data: pend } = await db.from("subscriptions").select(SUB_COLS).eq("provider_customer_id", action.customerId).eq("status", "incomplete").order("created_at", { ascending: false }).limit(3);
    const candidates = (pend as SubscriptionRow[] | null) ?? [];
    if (!candidates.length) {
      const { trialChargeInFlight } = await import("@/lib/trial-billing");
      if (await trialChargeInFlight(db, action.customerId)) return finish("error", "cobro de la prueba aún sin registrar");
      return finish("ignored", "payment intent sin suscripción pendiente");
    }
    for (const row of candidates) {
      // El primer mes con 50 % (cobro único) no es una suscripción de ONVO: lo activa el servidor al confirmar el cobro.
      if (!row.provider_subscription_id || isIntroSub(row.provider_subscription_id)) continue;
      // Fuente de verdad: preguntamos a ONVO por la suscripción (servidor a servidor con la llave secreta).
      const st = await fetchSubscriptionState(row.provider_subscription_id);
      if (st.active) {
        const plan = await activate(db, row, { periodStart: st.periodStart, periodEnd: st.periodEnd, customerId: action.customerId });
        await notifyPaid(db, "onvo", row, null, null, st.periodEnd, piId ?? key);
        return finish("processed", `activada vía payment intent (ONVO status=${st.status}), plan=${plan}`, row.user_id);
      }
    }
    return finish("ignored", "ninguna suscripción pendiente está activa en ONVO", candidates[0].user_id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finish("error", msg.slice(0, 500));
    return { status: "error", note: msg };
  }
}
