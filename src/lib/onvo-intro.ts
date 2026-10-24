import "server-only";
// ONVO, después del primer mes con 50 % (0043). Servidor, service_role.
//
// ONVO no tiene cupones para suscripciones (sus cupones solo se aplican a sesiones de Checkout de links de un solo uso), así
// que el primer mes con descuento fue un cobro único (trial-billing.ts → onvoIntroCharge) y su fila en `subscriptions`
// lleva el prefijo onvo-pi:. Al terminar ese mes, este barrido crea la suscripción NORMAL de ONVO a precio completo con la
// tarjeta guardada (createChargedSubscription cobra el primer periodo de inmediato; desde ahí ONVO renueva sola).
//   - Aprobado: la fila nueva queda "incomplete" y la activa el webhook de ONVO (regla de oro); cancelOthers cierra la del
//     primer mes.
//   - Rechazado: la del primer mes pasa a past_due, aviso y reintento diario hasta 3 veces; después se cancela.
//   - Sin respuesta: nunca se reintenta a ciegas; se busca la suscripción de ESTE intento por metadata.
//   - La persona canceló durante el primer mes: no se crea nada y la fila se cierra al final del mes.
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/supabase/admin";
import type { SubscriptionRow } from "@/lib/entitlements";
import { PLANS, type PlanId } from "@/lib/plans";
import { INTRO_PREFIX, SUB_COLS, syncProfilePlan } from "@/lib/billing";
import { OnvoError, cancelSubscription, createChargedSubscription, expectedAmountMinor, firstChargeFailed, isOnvoConfigured, listCustomerSubscriptions, matchesAttempt, priceIdFor } from "@/lib/onvo";
import { renewalNext } from "@/lib/tilopay-renewal";
import { sendPaymentFailed, sendSubscriptionCanceled } from "@/lib/email";
import { errInfo } from "@/lib/security/log";

const log = (msg: string, meta?: Record<string, unknown>) => console.info(JSON.stringify({ scope: "onvo-primer-mes", msg, ...meta }));
const alert = (msg: string, meta?: Record<string, unknown>) => console.error(JSON.stringify({ scope: "onvo-primer-mes", msg: `ALERTA ${msg}`, ...meta }));
const nowIso = () => new Date().toISOString();
const planName = (p: PlanId | null) => PLANS.find((x) => x.id === p)?.name ?? "Banana Burn";

/** Clave del intento (va en metadata de la suscripción de ONVO para reconocerla si la respuesta se pierde). */
export const introKey = (subRowId: number) => `intro:${subRowId}`;
/** Marca en last_renewal_error: ya se creó la suscripción normal y esperamos su webhook. */
export const SENT_PREFIX = "enviado:";
const PENDING_PREFIX = "por confirmar:";

type IntroRow = SubscriptionRow & { updated_at: string; renewal_attempts: number; next_renewal_attempt_at: string | null; last_renewal_error: string | null };
const COLS = `${SUB_COLS},updated_at,renewal_attempts,next_renewal_attempt_at,last_renewal_error`;

export type IntroStats = { due: number; sent: number; failed: number; canceled: number; pending: number; closed: number; errors: number };

/** Cron diario: el paso a la suscripción normal de quienes terminan su primer mes con 50 %. null si ONVO no está listo. */
export async function sweepOnvoIntro(now = new Date(), opts: { deadline?: number; limit?: number } = {}): Promise<IntroStats | null> {
  if (!isOnvoConfigured()) return null;
  const db = adminClient();
  if (!db) return null;
  const out: IntroStats = { due: 0, sent: 0, failed: 0, canceled: 0, pending: 0, closed: 0, errors: 0 };
  const time = () => !opts.deadline || Date.now() < opts.deadline;
  const limit = Math.min(opts.limit ?? 100, 500);
  const at = now.toISOString();
  try {
    const { data, error } = await db.from("subscriptions").select(COLS).eq("provider", "onvo").like("provider_subscription_id", `${INTRO_PREFIX}%`)
      .in("status", ["active", "past_due"]).eq("cancel_at_period_end", false).lte("current_period_end", at)
      .or(`next_renewal_attempt_at.is.null,next_renewal_attempt_at.lte.${at}`).order("current_period_end").limit(limit);
    if (error) throw new Error(error.message);
    for (const r of (data as IntroRow[] | null) ?? []) {
      if (!time()) break;
      out.due++;
      const res = await convertOne(db, r, now).catch((e) => { out.errors++; log("paso a la suscripción normal falló", { subId: r.id, error: errInfo(e) }); return null; });
      if (res === "sent") out.sent++;
      else if (res === "retry") out.failed++;
      else if (res === "cancel") out.canceled++;
      else if (res === "wait") out.pending++;
    }
    // Canceló durante el primer mes: al llegar el final, la fila queda cancelada (no hay nada que cancelar en ONVO).
    const { data: ending } = await db.from("subscriptions").select("id,user_id").eq("provider", "onvo").like("provider_subscription_id", `${INTRO_PREFIX}%`)
      .in("status", ["active", "past_due"]).eq("cancel_at_period_end", true).lte("current_period_end", at).limit(limit);
    for (const e of (ending as { id: number; user_id: string }[] | null) ?? []) {
      if (!time()) break;
      const { data: done } = await db.from("subscriptions").update({ status: "canceled", next_renewal_attempt_at: null, last_event_at: at, updated_at: at }).eq("id", e.id).eq("cancel_at_period_end", true).in("status", ["active", "past_due"]).select("id");
      if (done?.length) { out.closed++; await syncProfilePlan(db, e.user_id); }
    }
  } catch (e) {
    out.errors++;
    log("barrido del primer mes falló", { error: errInfo(e) });
  }
  if (out.due || out.closed) log("barrido del primer mes", out);
  return out;
}

async function convertOne(db: SupabaseClient, r: IntroRow, now: Date): Promise<"sent" | "retry" | "cancel" | "wait" | "omitido"> {
  if (!r.plan || !r.billing || !r.current_period_end || !r.provider_customer_id) return "omitido";
  const at = now.toISOString();
  const sent = r.last_renewal_error?.startsWith(SENT_PREFIX) ? r.last_renewal_error.slice(SENT_PREFIX.length) : null;
  const waiting = r.last_renewal_error?.startsWith(PENDING_PREFIX) ? Number(r.last_renewal_error.slice(PENDING_PREFIX.length)) : null;
  const attempt = sent || waiting ? r.renewal_attempts : r.renewal_attempts + 1;
  // Reclamo: un solo proceso gana.
  let claim = db.from("subscriptions").update({ renewal_attempts: attempt, next_renewal_attempt_at: new Date(now.getTime() + 15 * 60_000).toISOString(), updated_at: at })
    .eq("id", r.id).eq("renewal_attempts", r.renewal_attempts).eq("current_period_end", r.current_period_end);
  claim = r.next_renewal_attempt_at ? claim.eq("next_renewal_attempt_at", r.next_renewal_attempt_at) : claim.is("next_renewal_attempt_at", null);
  const { data: won } = await claim.select("id");
  if (!won?.length) return "omitido";

  const key = introKey(r.id);
  // Ya creada antes: esperamos su webhook. Si ONVO la marcó como fallida, es un rechazo.
  if (sent) {
    const { data: s } = await db.from("subscriptions").select("status").eq("provider_subscription_id", sent).maybeSingle();
    if (s?.status === "active") return "sent";
    if (s?.status === "expired") return failed(db, r, attempt, "rechazado por el banco", now);
    await db.from("subscriptions").update({ next_renewal_attempt_at: new Date(now.getTime() + 6 * 3600_000).toISOString(), updated_at: nowIso() }).eq("id", r.id);
    if (now.getTime() - Date.parse(r.current_period_end) > 2 * 864e5) alert("suscripción normal sin webhook de ONVO hace más de 2 días", { subId: r.id, onvo: sent });
    return "wait";
  }

  const { data: card } = await db.from("payment_methods").select("provider,provider_customer_id,provider_payment_method_id,status").eq("user_id", r.user_id).maybeSingle();
  if (!card || card.provider !== "onvo" || card.status !== "active") return failed(db, r, attempt, "sin tarjeta guardada", now);

  // Respuesta perdida antes: buscamos la suscripción de ESTE intento por metadata.
  if (waiting !== null) {
    const subs = await listCustomerSubscriptions(card.provider_customer_id as string).catch(() => null);
    const match = subs?.find((s) => matchesAttempt(s, key, waiting));
    if (match) return linked(db, r, card.provider_customer_id as string, match, now);
    if (subs && now.getTime() - Date.parse(r.updated_at) > 30 * 60_000) {
      // ONVO no tiene ninguna de este intento: no se creó. Se intenta de nuevo ya.
      await db.from("subscriptions").update({ last_renewal_error: null, next_renewal_attempt_at: null, updated_at: nowIso() }).eq("id", r.id);
      return "wait";
    }
    await db.from("subscriptions").update({ next_renewal_attempt_at: new Date(now.getTime() + 3600_000).toISOString(), updated_at: nowIso() }).eq("id", r.id);
    return "wait";
  }

  try {
    const sub = await createChargedSubscription({ customerId: card.provider_customer_id as string, paymentMethodId: card.provider_payment_method_id as string, plan: r.plan, billing: r.billing, userId: r.user_id, trialKey: key, attempt });
    if (!sub?.id) throw new OnvoError("ONVO no devolvió la suscripción", 502);
    return linked(db, r, card.provider_customer_id as string, sub, now);
  } catch (e) {
    const status = e instanceof OnvoError ? e.status : 0;
    if (status >= 400 && status < 500 && status !== 401 && status !== 403 && status !== 409 && status !== 429) return failed(db, r, attempt, e instanceof Error ? e.message : "rechazado", now);
    if (status === 401 || status === 403) {
      await db.from("subscriptions").update({ renewal_attempts: r.renewal_attempts, next_renewal_attempt_at: new Date(now.getTime() + 3600_000).toISOString(), last_renewal_error: `ONVO ${status}`, updated_at: nowIso() }).eq("id", r.id);
      alert("ONVO rechazó la llave al pasar a la suscripción normal", { subId: r.id, status });
      return "wait";
    }
    await db.from("subscriptions").update({ next_renewal_attempt_at: new Date(now.getTime() + 3600_000).toISOString(), last_renewal_error: `${PENDING_PREFIX}${attempt}`, updated_at: nowIso() }).eq("id", r.id);
    alert("paso a la suscripción normal por confirmar", { subId: r.id, status });
    return "wait";
  }
}

/** La suscripción normal existe en ONVO: se registra (incomplete) y la activa su webhook. Si ONVO ya la marcó fallida, rechazo. */
async function linked(db: SupabaseClient, r: IntroRow, customerId: string, sub: { id: string; status?: string }, now: Date): Promise<"sent" | "retry" | "cancel"> {
  const { data: exists } = await db.from("subscriptions").select("id").eq("provider_subscription_id", sub.id).maybeSingle();
  if (!exists) {
    const { error } = await db.from("subscriptions").insert({ user_id: r.user_id, provider: "onvo", provider_customer_id: customerId, provider_subscription_id: sub.id, status: "incomplete", price_id: priceIdFor(r.plan!, r.billing!), plan: r.plan, billing: r.billing });
    if (error) alert("suscripción normal creada en ONVO pero no se pudo registrar", { subId: r.id, onvo: sub.id, error: error.message });
  }
  if (firstChargeFailed(sub)) {
    await cancelSubscription(sub.id).catch((e) => log("no se pudo cancelar la suscripción rechazada", { onvo: sub.id, error: errInfo(e) }));
    await db.from("subscriptions").update({ status: "expired", updated_at: nowIso() }).eq("provider_subscription_id", sub.id).eq("status", "incomplete");
    return failed(db, r, r.renewal_attempts + (r.last_renewal_error?.startsWith(PENDING_PREFIX) ? 0 : 1), `ONVO: ${String(sub.status)}`, now);
  }
  await db.from("subscriptions").update({ last_renewal_error: `${SENT_PREFIX}${sub.id}`, next_renewal_attempt_at: new Date(now.getTime() + 6 * 3600_000).toISOString(), updated_at: nowIso() }).eq("id", r.id);
  // El webhook pudo llegar antes de registrarla (quedó en error): se reprocesa ahora.
  const since = new Date(now.getTime() - 6 * 3600_000).toISOString();
  const { data: evs } = await db.from("payment_events").select("id,payload").eq("status", "error").eq("provider_subscription_id", sub.id).gte("received_at", since).limit(5);
  if (evs?.length) {
    const { processWebhook } = await import("@/lib/billing");
    for (const e of evs as { id: number; payload: { type?: string; data?: Record<string, unknown> } }[]) {
      if (typeof e.payload?.type === "string") await processWebhook({ type: e.payload.type, data: e.payload.data ?? {} }, JSON.stringify(e.payload)).catch(() => null);
    }
  }
  log("suscripción normal creada después del primer mes", { userId: r.user_id, subId: r.id, onvo: sub.id });
  return "sent";
}

async function failed(db: SupabaseClient, r: IntroRow, attempt: number, reason: string, now: Date): Promise<"retry" | "cancel"> {
  const step = renewalNext(attempt, "declined", now);
  const pn = planName(r.plan);
  const amount = r.plan && r.billing ? expectedAmountMinor(r.plan, r.billing) / 100 : 0;
  if (step.do === "retry") {
    await db.from("subscriptions").update({ status: "past_due", next_renewal_attempt_at: step.nextAt, last_renewal_error: reason.slice(0, 300), last_event_at: nowIso(), updated_at: nowIso() }).eq("id", r.id);
    await syncProfilePlan(db, r.user_id);
    await sendPaymentFailed({ userId: r.user_id, plan: pn, amount, currency: "USD", reference: `${introKey(r.id)}:${attempt}:rechazo`, retryDate: step.nextAt, updateUrl: "/app/suscripcion#tarjeta" }).catch(() => null);
    log("paso a la suscripción normal rechazado", { userId: r.user_id, subId: r.id, attempt });
    return "retry";
  }
  await db.from("subscriptions").update({ status: "canceled", cancel_at_period_end: false, canceled_at: nowIso(), next_renewal_attempt_at: null, last_renewal_error: reason.slice(0, 300), last_event_at: nowIso(), updated_at: nowIso() }).eq("id", r.id);
  await syncProfilePlan(db, r.user_id);
  await sendSubscriptionCanceled({ userId: r.user_id, plan: pn, accessUntil: r.current_period_end, subscriptionId: r.provider_subscription_id ?? undefined }).catch(() => null);
  log("primer mes terminado sin poder cobrar: se cancela", { userId: r.user_id, subId: r.id });
  return "cancel";
}
