import "server-only";
// Orquestación de pagos (servidor): ONVO + Supabase con service_role.
// Regla de oro: SOLO processWebhook() sube a un usuario a plan pagado.
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/supabase/admin";
import type { Viewer } from "@/lib/supabase/server";
import type { SubscriptionRow } from "@/lib/entitlements";
import { PLANS, type Billing, type PlanId } from "@/lib/plans";
import { sendPaymentFailed, sendPaymentReceipt, sendSubscriptionCanceled } from "@/lib/email";
import {
  OnvoError, actionForEvent, cancelSubscription, createCustomer, createSubscription, estimatePeriodEnd, eventKey,
  expectedAmountMinor, fetchSubscriptionState, priceIdFor, profilePlanFor, type OnvoEvent,
} from "@/lib/onvo";

const SUB_COLS = "id,user_id,provider_customer_id,provider_subscription_id,status,price_id,plan,billing,cancel_at_period_end,canceled_at,current_period_start,current_period_end,created_at";

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

async function getOrCreateCustomer(db: SupabaseClient, v: Viewer): Promise<string> {
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

  // Reutiliza una pendiente reciente del mismo plan (doble clic, volver atrás).
  const hourAgo = Date.now() - 3600_000;
  const pending = subs.find((r) => r.status === "incomplete" && r.plan === plan && r.billing === billing && r.price_id === priceId && new Date(r.created_at).getTime() > hourAgo && r.provider_subscription_id);
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
  const db = admin();
  const { data: rows } = await db.from("subscriptions").select(SUB_COLS).eq("user_id", v.id).in("status", ["active", "trialing", "past_due"]).eq("cancel_at_period_end", false);
  const subs = (rows as SubscriptionRow[] | null) ?? [];
  if (!subs.length) throw new BillingError("No tienes una suscripción activa para cancelar.", 404);
  let endsAt: string | null = null;
  for (const r of subs) {
    if (r.provider_subscription_id) {
      try {
        await cancelSubscription(r.provider_subscription_id);
      } catch (e) {
        // 404 = ya no existe en ONVO -> seguimos; otros errores sí detienen.
        if (!(e instanceof OnvoError && e.status === 404)) {
          log("error cancelando en ONVO", { userId: v.id, subscriptionId: r.provider_subscription_id, error: String(e) });
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

async function recordAppEvent(db: SupabaseClient, key: string, type: string, userId: string, subId: string | null, payload: Record<string, unknown>) {
  const { error } = await db.from("payment_events").insert({ event_key: key, type, user_id: userId, provider_subscription_id: subId, status: "processed", payload, processed_at: new Date().toISOString() });
  if (error && !/duplicate|unique/i.test(error.message)) log("no se pudo registrar evento de app", { key, error: error.message });
}

// ───────────────────────── Webhook ─────────────────────────

export type WebhookResult = { status: "processed" | "ignored" | "duplicate" | "error"; note?: string };

async function setProfilePlan(db: SupabaseClient, userId: string, plan: "entreno" | "completo" | "free") {
  const { error } = await db.from("profiles").update({ plan }).eq("id", userId);
  if (error) throw new Error(`profiles.plan: ${error.message}`);
}

/** Recalcula el plan del perfil a partir de TODAS sus suscripciones y cortesías vigentes (el mejor plan gana). */
async function syncProfilePlan(db: SupabaseClient, userId: string) {
  const [{ data }, { data: comps }] = await Promise.all([
    db.from("subscriptions").select(SUB_COLS).eq("user_id", userId),
    db.from("comp_grants").select("plan").eq("user_id", userId).is("revoked_at", null).gt("expires_at", new Date().toISOString()),
  ]);
  const plans: string[] = [...((data as SubscriptionRow[] | null) ?? []).map((r) => profilePlanFor(r)), ...((comps as { plan: string }[] | null) ?? []).map((c) => c.plan)];
  const plan = plans.includes("completo") ? "completo" : plans.includes("entreno") ? "entreno" : "free";
  await setProfilePlan(db, userId, plan);
  return plan;
}

/** Al activarse un plan nuevo, cancela los demás del usuario (cambio de plan). */
async function cancelOthers(db: SupabaseClient, keep: SubscriptionRow) {
  const { data } = await db.from("subscriptions").select(SUB_COLS).eq("user_id", keep.user_id).neq("id", keep.id).in("status", ["active", "trialing", "past_due", "incomplete"]);
  for (const r of (data as SubscriptionRow[] | null) ?? []) {
    if (r.provider_subscription_id) await cancelSubscription(r.provider_subscription_id).catch((e) => log("no se pudo cancelar plan anterior en ONVO", { id: r.provider_subscription_id, error: String(e) }));
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
  return syncProfilePlan(db, row.user_id);
}

/**
 * Valida el cobro informado por ONVO contra el precio del servidor (plans.ts). Pura y testeada.
 * - Moneda distinta de USD o monto menor al esperado: no se activa.
 * - Monto mayor (p. ej. impuestos): se activa con nota.
 * - ONVO no informó monto: se activa (el evento ya viene autenticado y la suscripción la creamos con el priceId del servidor).
 */
export function checkPaidAmount(row: { plan: PlanId | null; billing: Billing | null }, amountMinor: number | null, currency: string | null): { ok: boolean; note?: string } {
  if (currency && currency.toUpperCase() !== "USD") return { ok: false, note: `moneda ${currency} (se esperaba USD)` };
  if (!row.plan || !row.billing || amountMinor === null) return { ok: true };
  const expected = expectedAmountMinor(row.plan, row.billing);
  if (amountMinor < expected) return { ok: false, note: `monto ${amountMinor} < ${expected} centavos USD de plans.ts` };
  if (amountMinor > expected) return { ok: true, note: `monto ${amountMinor} > ${expected} centavos USD de plans.ts (revisa el precio en ONVO)` };
  return { ok: true };
}

const planName = (p: PlanId | null) => PLANS.find((x) => x.id === p)?.name ?? "Banana Burn";

/** Recibo por correo (idempotente por referencia). Nunca bloquea el webhook. */
async function notifyPaid(row: SubscriptionRow, amountMinor: number | null, currency: string | null, periodEnd: string | null, reference: string) {
  const amount = amountMinor != null ? amountMinor / 100 : row.plan && row.billing ? expectedAmountMinor(row.plan, row.billing) / 100 : 0;
  await sendPaymentReceipt({ userId: row.user_id, plan: planName(row.plan), amount, currency: currency ?? "USD", reference, nextCharge: periodEnd }).catch(() => {});
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

    if (action.kind === "activate") {
      const { data } = await db.from("subscriptions").select(SUB_COLS).eq("provider_subscription_id", action.subscriptionId).maybeSingle();
      const row = data as SubscriptionRow | null;
      if (!row) return finish("ignored", "suscripción desconocida (no creada desde la app)");
      const check = checkPaidAmount(row, action.amountMinor, action.currency);
      if (!check.ok) {
        // Nunca otorgamos un plan con un cobro menor al precio del servidor o en otra moneda. Queda para revisión manual.
        console.error(JSON.stringify({ scope: "pagos", msg: "ALERTA monto inválido: no se activa", userId: row.user_id, subscriptionId: row.provider_subscription_id, note: check.note }));
        return finish("ignored", `NO ACTIVADA: ${check.note}`, row.user_id);
      }
      const note = check.note;
      const plan = await activate(db, row, action);
      await notifyPaid(row, action.amountMinor, action.currency, action.periodEnd, action.paymentIntentId ?? key);
      return finish("processed", note ? `${note}, plan=${plan}` : `plan=${plan}`, row.user_id);
    }

    if (action.kind === "renewal_failed") {
      const { data } = await db.from("subscriptions").select(SUB_COLS).eq("provider_subscription_id", action.subscriptionId).maybeSingle();
      const row = data as SubscriptionRow | null;
      if (!row) return finish("ignored", "suscripción desconocida");
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
    if (!candidates.length) return finish("ignored", "payment intent sin suscripción pendiente");
    for (const row of candidates) {
      if (!row.provider_subscription_id) continue;
      // Fuente de verdad: preguntamos a ONVO por la suscripción (servidor a servidor con la llave secreta).
      const st = await fetchSubscriptionState(row.provider_subscription_id);
      if (st.active) {
        const plan = await activate(db, row, { periodStart: st.periodStart, periodEnd: st.periodEnd, customerId: action.customerId });
        await notifyPaid(row, null, null, st.periodEnd, piId ?? key);
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
