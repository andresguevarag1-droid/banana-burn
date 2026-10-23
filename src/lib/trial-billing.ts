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
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/supabase/admin";
import type { Viewer } from "@/lib/supabase/server";
import { BillingError, getOrCreateCustomer } from "@/lib/billing";
import { PLANS, type Billing, type PlanId } from "@/lib/plans";
import {
  OnvoError, cancelSubscription, checkPaymentMethod, createChargedSubscription, detachPaymentMethod, firstChargeFailed,
  getPaymentMethod, getSubscription, isOnvoConfigured, listCustomerSubscriptions, matchesAttempt, priceIdFor, profilePlanFor,
} from "@/lib/onvo";
import {
  STALE_CHARGING_MS, UNKNOWN_GIVE_UP_MS, afterDecline, amountMinorFor, attemptKeyFor, canCancel, canChangePlan, chargeMoved, chargeView,
  idemKeyFor, isDue, onCardSaved, reminderDue, reminderLine, scheduleFor, type CardRow, type ChargeView, type TrialChargeRow,
} from "@/lib/trial";
import { notifyInApp, sendChargeCanceled, sendChargeReminder, sendPaymentFailed, sendTrialStarted } from "@/lib/email";
import { sendPush, type PushSub } from "@/lib/push";
import { errInfo } from "@/lib/security/log";

export const CHARGE_COLS = "id,user_id,idem_key,kind,plan,billing,amount_minor,trial_started_at,trial_ends_at,charge_at,next_attempt_at,status,attempts,last_attempt_at,provider_subscription_id,last_error,reminder_sent_at,failure_notified_attempt,canceled_at,created_at,updated_at";
const CARD_COLS = "user_id,provider_customer_id,provider_payment_method_id,brand,last4,exp_month,exp_year,status";
type CardFull = CardRow & { user_id: string; provider_customer_id: string; provider_payment_method_id: string };

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
async function hasLivePaidSubscription(db: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await db.from("subscriptions").select("plan,status,current_period_end,cancel_at_period_end").eq("user_id", userId).in("status", ["active", "trialing", "past_due", "canceled"]);
  return ((data as { plan: string | null; status: string; current_period_end: string | null; cancel_at_period_end: boolean }[] | null) ?? []).some((r) => profilePlanFor(r) !== "free");
}

// ───────────────────────── Avisos ─────────────────────────

async function pushTo(db: SupabaseClient, userId: string, payload: { title: string; body: string; url: string; tag: string }) {
  try {
    const { data: prefs } = await db.from("notification_prefs").select("push_reminders").eq("user_id", userId).maybeSingle();
    if (prefs?.push_reminders === false) return 0;
    const { data: subs } = await db.from("push_subscriptions").select("endpoint,p256dh,auth").eq("user_id", userId);
    return subs?.length ? await sendPush(db, subs as PushSub[], payload) : 0;
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
  const line = reminderLine(amount, row.kind, fmtDay(row.charge_at), moved);
  const card = cardLabel(await loadCard(db, row.user_id));
  await notifyInApp(row.user_id, { kind: "cobro_pronto", title: "En 2 días se cobra tu plan", body: line, url: "/app/suscripcion" }).catch(() => false);
  await sendChargeReminder({ userId: row.user_id, chargeId: row.id, plan: planName(row.plan), amount, chargeAt: row.charge_at, kind: row.kind, card, moved }).catch(() => null);
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
  if (busy && (busy.status === "charging" || busy.status === "pending" || busy.status === "unknown")) throw new BillingError("Estamos procesando tu cobro. Revisa en unos minutos.", 409);
  return { customerId: await getOrCreateCustomer(db, v) };
}

export type SaveCardResult = { card: { brand: string | null; last4: string | null }; charge: ChargeView | null; outcome: "programado" | "reanudado" | "sin_cambio" | AttemptResult };

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
  if (await hasLivePaidSubscription(db, v.id)) throw new BillingError("Ya tienes un plan activo.", 409);

  let row = await loadRow(db, v.id);
  const { data: prof } = await db.from("profiles").select("created_at").eq("id", v.id).maybeSingle();
  const plan = onCardSaved(row, { createdAt: (prof?.created_at as string | undefined) ?? null, now });
  if (plan.do === "busy") throw new BillingError("Estamos procesando tu cobro. Revisa en unos minutos.", 409);

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
  const prev = await loadCard(db, v.id);
  const { error: upErr } = await db.from("payment_methods").upsert({
    user_id: v.id, provider: "onvo", provider_customer_id: customerId, provider_payment_method_id: c.paymentMethodId,
    brand: c.brand, last4: c.last4, exp_month: c.expMonth, exp_year: c.expYear, status: "active", disconnected_at: null, updated_at: now.toISOString(),
  }, { onConflict: "user_id" });
  if (upErr) throw new BillingError("No pudimos guardar tu tarjeta. Intenta de nuevo.", 500);
  // La tarjeta anterior ya no se usa: la desconectamos en ONVO (si falla, solo queda sin usar).
  if (prev && prev.provider_payment_method_id !== c.paymentMethodId && prev.status === "active") {
    await detachPaymentMethod(prev.provider_payment_method_id).catch((e) => log("no se pudo desconectar la tarjeta anterior", { userId: v.id, error: errInfo(e) }));
  }
  const card = { brand: c.brand, last4: c.last4 };
  const amount = amountMinorFor(input.plan, input.billing);
  const planFields = { plan: input.plan, billing: input.billing, amount_minor: amount };

  if (plan.do === "create") {
    const s = scheduleFor(plan.kind, now);
    const ins = await db.from("trial_charges").insert({
      user_id: v.id, idem_key: idemKeyFor(v.id), kind: plan.kind, ...planFields,
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
    await sendTrialStarted({ userId: v.id, chargeId: row.id, plan: planName(row.plan), amount: amount / 100, chargeAt: row.charge_at, kind: row.kind, card: cardLabel(card) }).catch(() => null);
    await notifyInApp(v.id, { kind: "prueba", title: row.kind === "prueba" ? "Tu prueba gratis de 7 días empezó" : "Tu tarjeta quedó guardada", body: `Hoy no te cobramos. El ${fmtDay(row.charge_at)} se cobra tu plan, salvo que canceles antes.`, url: "/app/suscripcion" }).catch(() => false);
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
  const { error } = await db.from("trial_charges").update({ plan, billing, amount_minor: amountMinorFor(plan, billing), updated_at: now.toISOString() }).eq("id", row!.id).eq("status", "scheduled");
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
  try {
    await detachPaymentMethod(card.provider_payment_method_id);
  } catch (e) {
    if (!(e instanceof OnvoError && e.status === 404)) {
      log("no se pudo desconectar la tarjeta en ONVO", { userId, error: errInfo(e) });
      return false;
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

export type AttemptResult = "omitido" | "aplazado" | "enviado" | "rechazado" | "por_confirmar" | "reemplazado" | "sin_tarjeta" | "sin_config";

/**
 * Un intento de cobro. Idempotente: el UPDATE condicional (estado + intentos + fecha cumplida) deja pasar a un solo proceso.
 * Crea la suscripción en ONVO con la tarjeta guardada (cobra el primer periodo ya) y registra la fila en `subscriptions`
 * como `incomplete`: la activa el webhook.
 */
export async function attemptCharge(db: SupabaseClient, row: TrialChargeRow, now = new Date()): Promise<AttemptResult> {
  if (!isDue(row, now)) return "omitido";
  if (!isOnvoConfigured()) { alert("cobro pendiente pero ONVO no está configurado", { chargeId: row.id }); return "sin_config"; }
  // Nunca se cobra a un tester durante su mes de tester: la base aplaza el cobro al final y aquí no se intenta.
  if (await testerHold(db, row.user_id)) { log("cobro aplazado por mes de tester", { userId: row.user_id, chargeId: row.id }); return "aplazado"; }
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

async function recordSubscription(db: SupabaseClient, r: TrialChargeRow, customerId: string, subId: string) {
  const { data: exists } = await db.from("subscriptions").select("id").eq("provider_subscription_id", subId).maybeSingle();
  if (exists) return;
  const { error } = await db.from("subscriptions").insert({
    user_id: r.user_id, provider: "onvo", provider_customer_id: customerId, provider_subscription_id: subId,
    status: "incomplete", price_id: priceIdFor(r.plan, r.billing), plan: r.plan, billing: r.billing,
  });
  if (error) throw new Error(`subscriptions: ${error.message}`);
}

/** Rechazo: cancela la suscripción en ONVO (para que ONVO no reintente por su cuenta), muro y un solo reintento al día 8. */
async function decline(db: SupabaseClient, r: TrialChargeRow, reason: string, subId: string | null, now = new Date()): Promise<"rechazado"> {
  if (subId) {
    await cancelSubscription(subId).catch((e) => log("no se pudo cancelar la suscripción rechazada en ONVO", { subscriptionId: subId, error: errInfo(e) }));
    await db.from("subscriptions").update({ status: "expired", updated_at: nowIso() }).eq("provider_subscription_id", subId).eq("status", "incomplete");
  }
  const next = afterDecline(r, now);
  await db.from("trial_charges").update({ status: next.status, next_attempt_at: next.nextAttemptAt, last_error: reason.slice(0, 300), updated_at: nowIso() })
    .eq("id", r.id).in("status", ["charging", "pending", "unknown"]);
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
 * Intento "por confirmar" (la respuesta de ONVO se perdió). Busca la suscripción de ESTE intento por metadata. Si ONVO no
 * guarda metadata (no documentado), nunca se reintenta: queda para revisión manual.
 */
async function reconcileUnknown(db: SupabaseClient, r: TrialChargeRow, now = new Date()): Promise<"vinculado" | "reprogramado" | "sigue"> {
  const card = await loadCard(db, r.user_id);
  if (!card) return "sigue";
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
    log("intento por confirmar no llegó a ONVO: se reprograma", { chargeId: r.id });
    return "reprogramado";
  }
  if (old) alert("intento por confirmar sin forma segura de verificarlo: revisar en el panel de ONVO", { chargeId: r.id, userId: r.user_id });
  return "sigue";
}

/** "pending" sin webhook después de una hora: si ONVO ya marcó la suscripción como fallida, es un rechazo. Nunca activa. */
async function checkPending(db: SupabaseClient, r: TrialChargeRow, now = new Date()) {
  if (!r.provider_subscription_id || now.getTime() - Date.parse(r.updated_at) < 3600_000) return;
  try {
    const sub = await getSubscription(r.provider_subscription_id);
    if (firstChargeFailed(sub)) await decline(db, r, `ONVO: ${String(sub.status)}`, r.provider_subscription_id, now);
    else if (now.getTime() - Date.parse(r.updated_at) > 24 * 3600_000) alert("cobro sin webhook de ONVO hace más de un día", { chargeId: r.id, subscriptionId: r.provider_subscription_id, onvo: sub.status ?? null });
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

export type SweepStats = { reminders: number; attempted: number; sent: number; declined: number; unknown: number; tidied: number; errors: number };

/** Cron diario (/api/cron/recordatorios): avisos del día 5, cobros del día 7 y reintentos del día 8, y reconciliación. */
export async function sweepTrialCharges(now = new Date(), opts: { deadline?: number; limit?: number } = {}): Promise<SweepStats> {
  const out: SweepStats = { reminders: 0, attempted: 0, sent: 0, declined: 0, unknown: 0, tidied: 0, errors: 0 };
  const db = adminClient();
  if (!db) return out;
  const time = () => !opts.deadline || Date.now() < opts.deadline;
  const limit = Math.min(opts.limit ?? 100, 500);
  const at = now.toISOString();
  try {
    const soon = new Date(now.getTime() + 2 * 864e5).toISOString();
    const { data: rem } = await db.from("trial_charges").select(CHARGE_COLS).eq("status", "scheduled").is("reminder_sent_at", null).gt("charge_at", at).lte("charge_at", soon).order("charge_at").limit(limit);
    for (const r of (rem as TrialChargeRow[] | null) ?? []) { if (!time()) break; if (await sendReminderIfDue(db, r, now)) out.reminders++; }

    const { data: open } = await db.from("trial_charges").select(CHARGE_COLS).in("status", ["charging", "unknown", "pending"]).order("updated_at").limit(limit);
    for (const r of (open as TrialChargeRow[] | null) ?? []) { if (!time()) break; await tidy(db, r, now); out.tidied++; }

    const { data: due } = await db.from("trial_charges").select(CHARGE_COLS).in("status", ["scheduled", "retry_scheduled"]).lte("next_attempt_at", at).order("next_attempt_at").limit(limit);
    for (const r of (due as TrialChargeRow[] | null) ?? []) {
      if (!time()) break;
      out.attempted++;
      const res = await attemptCharge(db, r, now).catch((e) => { out.errors++; log("intento falló", { chargeId: r.id, error: errInfo(e) }); return null; });
      if (res === "enviado") out.sent++;
      else if (res === "rechazado" || res === "sin_tarjeta") out.declined++;
      else if (res === "por_confirmar") out.unknown++;
    }
  } catch (e) {
    out.errors++;
    log("barrido falló", { error: errInfo(e) });
  }
  if (out.reminders || out.attempted || out.tidied) log("barrido", out);
  return out;
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
