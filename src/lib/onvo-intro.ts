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
//   - Nunca dos veces: el MISMO UPDATE que reclama la fila deja "por confirmar:<intento>" antes de llamar a ONVO; si el
//     proceso se cae, la próxima corrida busca la suscripción de ese intento por metadata y nunca crea otra a ciegas.
//
// También (0045) cambia la tarjeta de una suscripción NORMAL de ONVO con la renovación rechazada (past_due): ONVO no tiene
// endpoint documentado para cambiar la tarjeta de una suscripción, así que con la marca "reemplazar" (la pone
// trial-billing.ts → replaceCard) se cancela la vieja en ONVO (deja de reintentar con la tarjeta vieja) y se crea una nueva
// con la tarjeta nueva, con la misma maquinaria.
//
// Llave única (0062, charge-keys.ts): antes de crear la suscripción se reserva (usuario, inicio del periodo, "onvo"); se libera
// solo si no se cobró. Simulacro (dryRun): previewConvert() dice qué se cobraría, solo leyendo y sin llamar a ONVO.
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/supabase/admin";
import type { SubscriptionRow } from "@/lib/entitlements";
import { PLANS, type PlanId } from "@/lib/plans";
import { INTRO_PREFIX, SUB_COLS, isIntroSub, syncProfilePlan } from "@/lib/billing";
import { OnvoError, cancelSubscription, createChargedSubscription, expectedAmountMinor, firstChargeFailed, isOnvoConfigured, listCustomerSubscriptions, matchesAttempt, priceIdFor } from "@/lib/onvo";
import { PENDING_PREFIX, RENEWAL_REVIEW_AFTER_MS, REPLACE_MARKER, REVIEW_PREFIX, SENT_PREFIX, pendingRef, renewalNext } from "@/lib/tilopay-renewal";
import { sendPaymentFailed, sendSubscriptionCanceled } from "@/lib/email";
import { errInfo } from "@/lib/security/log";
import { recordServerError } from "@/lib/monitor/server";
import { chargeKeyHeld, periodOf, releaseChargeKey, reserveChargeKey } from "@/lib/charge-keys";
import { readOnly } from "@/lib/supabase/read-only";
import { readAll, type PlannedCharge } from "@/lib/cobros-simulacro";

const log = (msg: string, meta?: Record<string, unknown>) => console.info(JSON.stringify({ scope: "onvo-primer-mes", msg, ...meta }));
const alert = (msg: string, meta?: Record<string, unknown>) => console.error(JSON.stringify({ scope: "onvo-primer-mes", msg: `ALERTA ${msg}`, ...meta }));
const nowIso = () => new Date().toISOString();
const planName = (p: PlanId | null) => PLANS.find((x) => x.id === p)?.name ?? "Banana Burn";

/** Clave del intento (va en metadata de la suscripción de ONVO para reconocerla si la respuesta se pierde). */
export const introKey = (subRowId: number) => `intro:${subRowId}`;
export { SENT_PREFIX } from "@/lib/tilopay-renewal";

type IntroRow = SubscriptionRow & { updated_at: string; renewal_attempts: number; next_renewal_attempt_at: string | null; last_renewal_error: string | null };
const COLS = `${SUB_COLS},updated_at,renewal_attempts,next_renewal_attempt_at,last_renewal_error`;

export type IntroStats = { due: number; sent: number; failed: number; canceled: number; pending: number; closed: number; errors: number; planned?: PlannedCharge[] };
type Res = "sent" | "retry" | "cancel" | "wait" | "omitido";

/** Primer mes terminado (sin cancelar), o con un intento en vuelo aunque después haya cancelado. Falta el filtro de cancelación. */
const introDue = (db: SupabaseClient, at: string) => db.from("subscriptions").select(COLS).eq("provider", "onvo").like("provider_subscription_id", `${INTRO_PREFIX}%`)
  .in("status", ["active", "past_due"]).lte("current_period_end", at).or(`next_renewal_attempt_at.is.null,next_renewal_attempt_at.lte.${at}`);
/** Suscripciones normales con marca de renovación (de ellas, las de cambio de tarjeta: replacement()). */
const replacementDue = (db: SupabaseClient, at: string) => db.from("subscriptions").select(COLS).eq("provider", "onvo").in("status", ["active", "past_due"])
  .not("last_renewal_error", "is", null).lte("next_renewal_attempt_at", at);
const introPick = (rows: IntroRow[] | null) => (rows ?? []).filter((r) => !r.cancel_at_period_end || inFlight(r.last_renewal_error));
const replacementPick = (rows: IntroRow[] | null) => (rows ?? []).filter((r) => !isIntroSub(r.provider_subscription_id) && replacement(r));

/**
 * Cron diario: el paso a la suscripción normal de quienes terminan su primer mes con 50 % (y los cambios de tarjeta).
 * dryRun: solo calcula y reporta (planned) con un cliente de solo lectura, sin llamar a ONVO.
 */
export async function sweepOnvoIntro(now = new Date(), opts: { deadline?: number; limit?: number; chargeBy?: number; dryRun?: boolean } = {}): Promise<IntroStats | null> {
  if (!opts.dryRun && !isOnvoConfigured()) return null;
  const db = adminClient();
  if (!db) return null;
  const out: IntroStats = { due: 0, sent: 0, failed: 0, canceled: 0, pending: 0, closed: 0, errors: 0 };
  if (opts.dryRun) {
    try {
      out.planned = await planIntro(readOnly(db), now);
    } catch (e) {
      out.errors++;
      log("simulacro falló", { error: errInfo(e) });
    }
    return out;
  }
  const time = () => !opts.deadline || Date.now() < opts.deadline;
  const canCharge = () => time() && (!opts.chargeBy || Date.now() < opts.chargeBy);
  const limit = Math.min(opts.limit ?? 100, 500);
  const at = now.toISOString();
  const run = async (rows: IntroRow[]) => {
    for (const r of rows) {
      if (!time()) break;
      out.due++;
      const res = await convertOne(db, r, now, canCharge).catch((e) => { out.errors++; log("paso a la suscripción normal falló", { subId: r.id, error: errInfo(e) }); return null; });
      if (res === "sent") out.sent++;
      else if (res === "retry") out.failed++;
      else if (res === "cancel") out.canceled++;
      else if (res === "wait") out.pending++;
    }
  };
  try {
    // 1) Primer mes terminado (sin cancelar), o con un intento en vuelo aunque después haya cancelado.
    const { data, error } = await introDue(db, at).order("current_period_end").limit(limit);
    if (error) throw new Error(error.message);
    await run(introPick(data as IntroRow[] | null));
    // 2) Suscripciones normales con la tarjeta cambiada después de un rechazo ("reemplazar" y sus marcas).
    const { data: rep, error: e2 } = await replacementDue(db, at).limit(limit);
    if (e2) throw new Error(e2.message);
    await run(replacementPick(rep as IntroRow[] | null));
    // Canceló durante el primer mes: al llegar el final, la fila queda cancelada (no hay nada que cancelar en ONVO).
    const { data: ending } = await db.from("subscriptions").select("id,user_id,last_renewal_error").eq("provider", "onvo").like("provider_subscription_id", `${INTRO_PREFIX}%`)
      .in("status", ["active", "past_due"]).eq("cancel_at_period_end", true).lte("current_period_end", at).limit(limit);
    for (const e of (ending as { id: number; user_id: string; last_renewal_error: string | null }[] | null) ?? []) {
      if (!time()) break;
      if (inFlight(e.last_renewal_error)) continue;
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

/** Reintento inmediato para una persona (justo después de cambiar la tarjeta). Nunca lanza. */
export async function convertDueForUser(userId: string, now = new Date()): Promise<void> {
  const db = adminClient();
  if (!db || !isOnvoConfigured()) return;
  const at = now.toISOString();
  const { data } = await db.from("subscriptions").select(COLS).eq("user_id", userId).eq("provider", "onvo").in("status", ["active", "past_due"]).lte("next_renewal_attempt_at", at).limit(5);
  for (const r of (data as IntroRow[] | null) ?? []) {
    const due = isIntroSub(r.provider_subscription_id) ? !!r.current_period_end && r.current_period_end <= at : replacement(r);
    if (!due) continue;
    await convertOne(db, r, now, () => true).catch((e) => log("paso inmediato falló", { subId: r.id, error: errInfo(e) }));
  }
}

/** Llave única del cobro (0062): la persona, el inicio del periodo que se cobra y ONVO. */
const keyOf = (r: IntroRow) => ({ userId: r.user_id, periodo: periodOf(r.current_period_end!), procesador: "onvo" as const });

const inFlight = (m: string | null | undefined) => !!m && (m.startsWith(PENDING_PREFIX) || m.startsWith(REVIEW_PREFIX) || m.startsWith(SENT_PREFIX));
/** Fila normal de ONVO en cambio de tarjeta: "reemplazar", sus marcas, o el motivo de un rechazo de ese cambio. */
const replacement = (r: IntroRow) => !!r.last_renewal_error && r.status === "past_due" || r.last_renewal_error === REPLACE_MARKER || inFlight(r.last_renewal_error);

async function convertOne(db: SupabaseClient, r: IntroRow, now: Date, canCharge: () => boolean): Promise<Res> {
  if (!r.plan || !r.billing || !r.current_period_end || !r.provider_customer_id) return "omitido";
  const at = now.toISOString();
  const intro = isIntroSub(r.provider_subscription_id);
  const marker = r.last_renewal_error;
  const sent = marker?.startsWith(SENT_PREFIX) ? marker.slice(SENT_PREFIX.length) : null;
  const ref = pendingRef(marker);
  const waiting = ref !== null && Number.isFinite(Number(ref)) ? Number(ref) : null;
  const fresh = !sent && waiting === null;
  if (fresh && (r.cancel_at_period_end || !canCharge())) return "omitido";
  const attempt = fresh ? r.renewal_attempts + 1 : r.renewal_attempts;
  // Reclamo: un solo proceso gana. Un intento NUEVO deja la marca "por confirmar:<intento>" en el mismo UPDATE.
  const claimFields: Record<string, unknown> = { renewal_attempts: attempt, next_renewal_attempt_at: new Date(now.getTime() + 15 * 60_000).toISOString(), updated_at: at };
  if (fresh) claimFields.last_renewal_error = `${PENDING_PREFIX}${attempt}`;
  let claim = db.from("subscriptions").update(claimFields).eq("id", r.id).eq("renewal_attempts", r.renewal_attempts).eq("current_period_end", r.current_period_end);
  claim = r.next_renewal_attempt_at ? claim.eq("next_renewal_attempt_at", r.next_renewal_attempt_at) : claim.is("next_renewal_attempt_at", null);
  if (fresh) claim = claim.eq("cancel_at_period_end", false);
  const { data: won } = await claim.select("id");
  if (!won?.length) return "omitido";

  const key = intro ? introKey(r.id) : `cambio:${r.id}`;
  // Ya creada antes: esperamos su webhook. Si ONVO la marcó como fallida, es un rechazo.
  if (sent) {
    const { data: s } = await db.from("subscriptions").select("status").eq("provider_subscription_id", sent).maybeSingle();
    if (s?.status === "active") return "sent";
    if (s?.status === "expired") return failed(db, r, attempt, "rechazado por el banco", now);
    await db.from("subscriptions").update({ next_renewal_attempt_at: new Date(now.getTime() + 6 * 3600_000).toISOString(), updated_at: nowIso() }).eq("id", r.id);
    if (now.getTime() - Date.parse(r.current_period_end) > 2 * 864e5) alert("suscripción normal sin webhook de ONVO hace más de 2 días", { subId: r.id, onvo: sent });
    if (r.cancel_at_period_end) alert("canceló con la suscripción normal ya creada en ONVO: revisar si corresponde cancelarla y reembolsar", { subId: r.id, onvo: sent });
    return "wait";
  }

  const { data: card } = await db.from("payment_methods").select("provider,provider_customer_id,provider_payment_method_id,status").eq("user_id", r.user_id).maybeSingle();
  if (!card || card.provider !== "onvo" || card.status !== "active") {
    if (waiting !== null) return stillPending(db, r, now, "sin tarjeta para buscar el intento");
    return failed(db, r, attempt, "sin tarjeta guardada", now);
  }

  // Respuesta perdida antes (o el proceso se cayó): buscamos la suscripción de ESTE intento por metadata.
  if (waiting !== null) {
    const subs = await listCustomerSubscriptions(card.provider_customer_id as string).catch(() => null);
    const match = subs?.find((s) => matchesAttempt(s, key, waiting));
    if (match) return linked(db, r, card.provider_customer_id as string, match, now, attempt);
    // Solo si ONVO guarda metadata en TODAS (la forma segura de saber que el intento no llegó) y pasó media hora.
    const metadataWorks = !!subs && subs.every((s) => s.metadata && typeof s.metadata === "object" && "trialKey" in (s.metadata as object));
    if (subs && metadataWorks && now.getTime() - Date.parse(r.updated_at) > 30 * 60_000) {
      // ONVO no tiene ninguna de este intento: no se creó. Se devuelve el intento para hacerlo de nuevo.
      await db.from("subscriptions").update({ renewal_attempts: Math.max(0, attempt - 1), last_renewal_error: intro ? null : REPLACE_MARKER, next_renewal_attempt_at: nowIso(), updated_at: nowIso() }).eq("id", r.id);
      await releaseChargeKey(db, keyOf(r), "no llegó a ONVO");
      return "wait";
    }
    return stillPending(db, r, now, `intento ${waiting}`);
  }

  // Llave única (0062) antes de tocar ONVO: si ya hay un cobro de este periodo, no se cancela la vieja ni se crea otra.
  const reserved = await reserveChargeKey(db, { ...keyOf(r), origen: intro ? "primer_mes_normal" : "cambio_tarjeta", referencia: `${key}:${attempt}` });
  if (reserved !== "reservada") {
    // No se llamó a ONVO: se devuelve el intento tal como estaba y se mira de nuevo en una hora (la alerta ya salió).
    await db.from("subscriptions").update({ renewal_attempts: r.renewal_attempts, last_renewal_error: marker, next_renewal_attempt_at: new Date(now.getTime() + 3600_000).toISOString(), updated_at: nowIso() }).eq("id", r.id);
    return "wait";
  }
  // Cambio de tarjeta de una suscripción normal: primero se cancela la vieja en ONVO (deja de reintentar con la tarjeta
  // vieja). La fila sigue past_due (con su gracia) hasta que la nueva quede activa.
  if (!intro && r.provider_subscription_id) {
    await cancelSubscription(r.provider_subscription_id).catch((e) => { if (!(e instanceof OnvoError && e.status === 404)) log("no se pudo cancelar la suscripción vieja en ONVO", { subId: r.id, error: errInfo(e) }); });
  }
  try {
    const sub = await createChargedSubscription({ customerId: card.provider_customer_id as string, paymentMethodId: card.provider_payment_method_id as string, plan: r.plan, billing: r.billing, userId: r.user_id, trialKey: key, attempt });
    if (!sub?.id) throw new OnvoError("ONVO no devolvió la suscripción", 502);
    return linked(db, r, card.provider_customer_id as string, sub, now, attempt);
  } catch (e) {
    const status = e instanceof OnvoError ? e.status : 0;
    if (status >= 400 && status < 500 && status !== 401 && status !== 403 && status !== 409 && status !== 429) return failed(db, r, attempt, e instanceof Error ? e.message : "rechazado", now);
    if (status === 401 || status === 403) {
      // Llave mal configurada: no se cobró. Se devuelve el intento.
      await releaseChargeKey(db, keyOf(r), `ONVO ${status}`);
      await db.from("subscriptions").update({ renewal_attempts: r.renewal_attempts, next_renewal_attempt_at: new Date(now.getTime() + 3600_000).toISOString(), last_renewal_error: intro ? `ONVO ${status}` : REPLACE_MARKER, updated_at: nowIso() }).eq("id", r.id);
      alert("ONVO rechazó la llave al pasar a la suscripción normal", { subId: r.id, status });
      return "wait";
    }
    // Sin respuesta: la marca "por confirmar" ya quedó al reclamar; se busca por metadata en una hora.
    await db.from("subscriptions").update({ next_renewal_attempt_at: new Date(now.getTime() + 3600_000).toISOString(), updated_at: nowIso() }).eq("id", r.id);
    alert("paso a la suscripción normal por confirmar", { subId: r.id, status });
    return "wait";
  }
}

/** Sigue por confirmar: se vuelve a buscar en una hora; más de un día después del vencimiento, revisión del equipo. */
async function stillPending(db: SupabaseClient, r: IntroRow, now: Date, what: string): Promise<"wait"> {
  const stuck = now.getTime() - Date.parse(r.current_period_end!) > RENEWAL_REVIEW_AFTER_MS;
  const ref = pendingRef(r.last_renewal_error) ?? "";
  await db.from("subscriptions").update({ next_renewal_attempt_at: new Date(now.getTime() + (stuck ? 6 : 1) * 3600_000).toISOString(), last_renewal_error: `${stuck ? REVIEW_PREFIX : PENDING_PREFIX}${ref}`, updated_at: nowIso() }).eq("id", r.id);
  if (stuck) {
    alert("paso a la suscripción normal sin confirmar hace más de un día: revisar en el panel de ONVO", { subId: r.id, what });
    recordServerError("pagos/renovacion-por-confirmar", "renewal_review");
  }
  return "wait";
}

/** La suscripción normal existe en ONVO: se registra (incomplete) y la activa su webhook. Si ONVO ya la marcó fallida, rechazo. */
async function linked(db: SupabaseClient, r: IntroRow, customerId: string, sub: { id: string; status?: string }, now: Date, attempt: number): Promise<"sent" | "retry" | "cancel"> {
  const { data: exists } = await db.from("subscriptions").select("id").eq("provider_subscription_id", sub.id).maybeSingle();
  if (!exists) {
    const { error } = await db.from("subscriptions").insert({ user_id: r.user_id, provider: "onvo", provider_customer_id: customerId, provider_subscription_id: sub.id, status: "incomplete", price_id: priceIdFor(r.plan!, r.billing!), plan: r.plan, billing: r.billing });
    if (error) alert("suscripción normal creada en ONVO pero no se pudo registrar", { subId: r.id, onvo: sub.id, error: error.message });
  }
  if (firstChargeFailed(sub)) {
    await cancelSubscription(sub.id).catch((e) => log("no se pudo cancelar la suscripción rechazada", { onvo: sub.id, error: errInfo(e) }));
    await db.from("subscriptions").update({ status: "expired", updated_at: nowIso() }).eq("provider_subscription_id", sub.id).eq("status", "incomplete");
    return failed(db, r, attempt, `ONVO: ${String(sub.status)}`, now);
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
  log("suscripción normal creada", { userId: r.user_id, subId: r.id, onvo: sub.id, cambio: !isIntroSub(r.provider_subscription_id) });
  return "sent";
}

async function failed(db: SupabaseClient, r: IntroRow, attempt: number, reason: string, now: Date): Promise<"retry" | "cancel"> {
  const step = renewalNext(attempt, "declined", now);
  const pn = planName(r.plan);
  const amount = r.plan && r.billing ? expectedAmountMinor(r.plan, r.billing) / 100 : 0;
  // El motivo nunca puede parecer una marca (sería tomado por un cobro en vuelo).
  const why = (inFlight(reason) || reason === REPLACE_MARKER ? `rechazado: ${reason}` : reason || "rechazado").slice(0, 300);
  if (r.current_period_end) await releaseChargeKey(db, keyOf(r), "rechazado");
  if (step.do === "retry") {
    await db.from("subscriptions").update({ status: "past_due", next_renewal_attempt_at: step.nextAt, last_renewal_error: why, last_event_at: nowIso(), updated_at: nowIso() }).eq("id", r.id);
    await syncProfilePlan(db, r.user_id);
    await sendPaymentFailed({ userId: r.user_id, plan: pn, amount, currency: "USD", reference: `${introKey(r.id)}:${attempt}:rechazo`, retryDate: step.nextAt, updateUrl: "/app/suscripcion#tarjeta" }).catch(() => null);
    log("paso a la suscripción normal rechazado", { userId: r.user_id, subId: r.id, attempt });
    return "retry";
  }
  await db.from("subscriptions").update({ status: "canceled", cancel_at_period_end: false, canceled_at: nowIso(), next_renewal_attempt_at: null, last_renewal_error: why, last_event_at: nowIso(), updated_at: nowIso() }).eq("id", r.id);
  if (!isIntroSub(r.provider_subscription_id) && r.provider_subscription_id) await cancelSubscription(r.provider_subscription_id).catch(() => null);
  await syncProfilePlan(db, r.user_id);
  await sendSubscriptionCanceled({ userId: r.user_id, plan: pn, accessUntil: r.current_period_end, subscriptionId: r.provider_subscription_id ?? undefined }).catch(() => null);
  log("sin poder cobrar después de los reintentos: se cancela", { userId: r.user_id, subId: r.id });
  return "cancel";
}

// ───────────────────────── Simulacro (dryRun) ─────────────────────────

/** Todas las filas que tocaría el barrido (sin el límite de una corrida), solo leyendo. */
async function planIntro(db: SupabaseClient, now: Date): Promise<PlannedCharge[]> {
  const at = now.toISOString();
  const rows = [
    ...introPick(await readAll<IntroRow>((a, b) => introDue(db, at).order("id").range(a, b))),
    ...replacementPick(await readAll<IntroRow>((a, b) => replacementDue(db, at).order("id").range(a, b))),
  ];
  const out: PlannedCharge[] = [];
  for (const r of rows) {
    const p = await previewConvert(db, r);
    if (p) out.push(p);
  }
  return out;
}

/** Lo que haría convertOne con esta fila, SOLO leyendo: sin reclamarla y sin llamar a ONVO. */
export async function previewConvert(db: SupabaseClient, r: IntroRow): Promise<PlannedCharge | null> {
  if (!r.plan || !r.billing || !r.current_period_end || !r.provider_customer_id) return null;
  const marker = r.last_renewal_error;
  const sent = marker?.startsWith(SENT_PREFIX);
  const ref = pendingRef(marker);
  const fresh = !sent && !(ref !== null && Number.isFinite(Number(ref)));
  if (fresh && r.cancel_at_period_end) return null;
  const amount = expectedAmountMinor(r.plan, r.billing);
  const p: PlannedCharge = {
    userId: r.user_id, fila: r.id, origen: isIntroSub(r.provider_subscription_id) ? "primer_mes_normal" : "cambio_tarjeta", procesador: "onvo", plan: r.plan, billing: r.billing,
    montoMinor: amount, montoEsperadoMinor: amount, promo50: false, periodo: periodOf(r.current_period_end), accion: "cobrar", motivo: null, cortesia: false, temporadaIncluida: r.billing === "anual",
  };
  if (!fresh) return { ...p, accion: "consultar", motivo: sent ? "esperando el webhook de ONVO" : "por confirmar" };
  const { data: card } = await db.from("payment_methods").select("provider,status").eq("user_id", r.user_id).maybeSingle();
  if (!card || card.provider !== "onvo" || card.status !== "active") return { ...p, accion: "omitir", motivo: "sin_tarjeta" };
  const held = await chargeKeyHeld(db, keyOf(r));
  if (held === null) return { ...p, accion: "omitir", motivo: "sin_llaves_0062" };
  if (held) return { ...p, accion: "omitir", motivo: "llave_ocupada" };
  return p;
}
