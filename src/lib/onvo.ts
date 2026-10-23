// Cliente REST mínimo de ONVO Pay. SOLO SERVIDOR: usa ONVO_SECRET_KEY.
import "server-only";
// Nunca importes este archivo desde un componente "use client".
//
// Referencias (verificado contra la documentación pública, oct 2026):
//   Autenticación  https://docs.onvopay.com/en/authentication.md   → Authorization: Bearer onvo_{test|live}_secret_key_…
//   Base URL       https://docs.onvopay.com/openapi.yaml          → https://api.onvopay.com
//   Clientes       https://docs.onvopay.com/en/api/crear-un-cliente.md          POST /v1/customers
//   Suscripciones  https://docs.onvopay.com/en/payments/subscriptions.md        POST /v1/subscriptions (items[{priceId,quantity}], paymentBehavior)
//                  https://docs.onvopay.com/en/api/obtener-un-cargo-recurrente.md  GET /v1/subscriptions/{id}
//                  https://docs.onvopay.com/en/api/cancelar-un-cargo-recurrente.md DELETE /v1/subscriptions/{id}
//                  (sin paymentBehavior + paymentMethodId = cobra el primer periodo de inmediato: primer cobro de la prueba)
//                  https://docs.onvopay.com/en/api/obtener-los-cargos-recurrentes-de-un-cliente GET /v1/customers/{id}/subscriptions
//   Tarjetas       https://docs.onvopay.com/en/api/crear-un-metodo-de-pago      POST /v1/payment-methods (NAVEGADOR, llave publicable)
//                  https://docs.onvopay.com/en/api/obtener-un-metodo-de-pago    GET /v1/payment-methods/{id}
//                  https://docs.onvopay.com/en/api/desconectar-un-metodo-de-pago POST /v1/payment-methods/{id}/detach
//                  (verificar-un-metodo-de-pago es para cuentas bancarias que piden confirmación manual: no se usa con tarjetas)
//   SDK web        https://docs.onvopay.com/en/integrations/sdk.md              paymentType "subscription" + subscriptionId
//   Webhooks       https://docs.onvopay.com/en/webhooks.md                      cabecera X-Webhook-Secret (prefijo webhook_secret_)
import { createHash, timingSafeEqual } from "node:crypto";
import { PLANS, type Billing, type PlanId } from "./plans";
import { parseIntent } from "./checkout-intent";
import { errCode, logError } from "./log";
import { resilientFetch } from "./resilient-fetch";

export const ONVO_API = "https://api.onvopay.com";

if (typeof window !== "undefined") {
  throw new Error("src/lib/onvo.ts es solo para el servidor");
}

// ───────────────────────── Configuración ─────────────────────────

const PRICE_ENV: Record<PlanId, Record<Billing, string>> = {
  entreno: { mes: "ONVO_PRICE_ENTRENO_MES", anual: "ONVO_PRICE_ENTRENO_ANUAL" },
  completo: { mes: "ONVO_PRICE_COMPLETO_MES", anual: "ONVO_PRICE_COMPLETO_ANUAL" },
};

/** ID de precio recurrente de ONVO para un plan + periodo (configurado en variables de entorno). */
export function priceIdFor(plan: PlanId, billing: Billing, env: NodeJS.ProcessEnv = process.env): string | null {
  return env[PRICE_ENV[plan][billing]]?.trim() || null;
}

/** Inverso: ¿a qué plan/periodo corresponde un priceId de ONVO? */
export function planFromPriceId(priceId: string | null | undefined, env: NodeJS.ProcessEnv = process.env): { plan: PlanId; billing: Billing } | null {
  if (!priceId) return null;
  for (const plan of Object.keys(PRICE_ENV) as PlanId[]) {
    for (const billing of ["mes", "anual"] as Billing[]) {
      if (priceIdFor(plan, billing, env) === priceId) return { plan, billing };
    }
  }
  return null;
}

/** ¿Están todas las llaves y precios necesarios para cobrar? */
export function isOnvoConfigured(env: NodeJS.ProcessEnv = process.env) {
  const prices = PLANS.every((p) => priceIdFor(p.id, "mes", env) && priceIdFor(p.id, "anual", env));
  return Boolean(env.ONVO_SECRET_KEY && env.NEXT_PUBLIC_ONVO_PUBLISHABLE_KEY && env.ONVO_WEBHOOK_SECRET && prices);
}

/** ¿Se pueden cobrar pagos únicos (retos Premium)? No necesita los precios de los planes, solo las llaves y el webhook. */
export function isOnvoOneTimeReady(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.ONVO_SECRET_KEY && env.NEXT_PUBLIC_ONVO_PUBLISHABLE_KEY && env.ONVO_WEBHOOK_SECRET);
}

/** Valida plan/periodo que llegan del cliente contra plans.ts (nunca confiamos en precios del cliente). */
export const parsePlanBilling = parseIntent;

/** Monto esperado en centavos de USD según plans.ts. */
export function expectedAmountMinor(plan: PlanId, billing: Billing) {
  const p = PLANS.find((x) => x.id === plan)!;
  return Math.round(p.price[billing] * 100);
}

// ───────────────────────── REST ─────────────────────────

export class OnvoError extends Error {
  constructor(message: string, public status: number, public body?: unknown) {
    super(message);
    this.name = "OnvoError";
  }
}

// Tiempo límite en todo; un reintento solo en lecturas (GET). Crear clientes, suscripciones o cobros nunca se reintenta solo.
const onvoFetch = resilientFetch({ readTimeoutMs: 10_000, writeTimeoutMs: 15_000, retries: 1, backoffMs: 400 });

async function onvo<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
  const key = process.env.ONVO_SECRET_KEY;
  if (!key) throw new OnvoError("ONVO_SECRET_KEY no está configurada", 503);
  let res: Response;
  try {
    res = await onvoFetch(`${ONVO_API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch (e) {
    // Red caída o tiempo agotado: 503 para que cada ruta muestre su mensaje de "intenta en un momento".
    logError("onvo", errCode(e) === "TimeoutError" ? "timeout" : "network", { method });
    throw new OnvoError("ONVO no respondió", 503);
  }
  if (!res.ok) logError("onvo", `http_${res.status}`, { method });
  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) {
    // La forma exacta del error no está documentada (https://docs.onvopay.com/en/reference/errors.md): leemos `message` si existe.
    const msg = (json && typeof json === "object" && "message" in json ? String((json as { message: unknown }).message) : null) ?? `ONVO ${res.status}`;
    throw new OnvoError(msg, res.status, json);
  }
  return json as T;
}

export type OnvoCustomer = { id: string; email?: string | null; name?: string | null };

/** POST /v1/customers. Campos del objeto Customer según openapi.yaml: name, email, phone, description… */
export function createCustomer(input: { email: string; name?: string; userId: string }) {
  return onvo<OnvoCustomer>("POST", "/v1/customers", {
    email: input.email,
    name: input.name || undefined,
    description: `Banana Burn, usuario ${input.userId}`,
  });
}

/** GET /v1/customers/{id} */
export function getCustomer(id: string) {
  return onvo<OnvoCustomer>("GET", `/v1/customers/${encodeURIComponent(id)}`);
}

/**
 * Objeto Subscription de ONVO. El esquema completo NO está publicado en la documentación;
 * solo confiamos en `id`. El resto es opcional y se lee de forma defensiva.
 */
export type OnvoSubscription = { id: string; status?: string; [k: string]: unknown };

/**
 * Crea la suscripción en modo diferido: `paymentBehavior: "allow_incomplete"` sin `paymentMethodId`.
 * El primer cobro lo confirma el comprador en el SDK web de ONVO (`paymentType: "subscription"`),
 * así los datos de tarjeta/SINPE nunca pasan por nuestro servidor.
 * Doc: https://docs.onvopay.com/en/payments/subscriptions.md · https://docs.onvopay.com/en/integrations/sdk.md
 */
export function createSubscription(input: { customerId: string; plan: PlanId; billing: Billing; userId: string }) {
  const priceId = priceIdFor(input.plan, input.billing);
  if (!priceId) throw new OnvoError(`Falta el precio de ONVO para ${input.plan}/${input.billing}`, 503);
  const name = PLANS.find((p) => p.id === input.plan)!.name;
  return onvo<OnvoSubscription>("POST", "/v1/subscriptions", {
    customerId: input.customerId,
    paymentBehavior: "allow_incomplete",
    description: `Banana Burn, ${name} (${input.billing === "mes" ? "mensual" : "anual"})`,
    items: [{ priceId, quantity: 1 }],
    metadata: { userId: input.userId, plan: input.plan, billing: input.billing },
  });
}

/**
 * Primer cobro después de la prueba: crea la suscripción CON `paymentMethodId` y SIN `paymentBehavior`, así ONVO crea la
 * primera factura y la cobra de inmediato con la tarjeta guardada (comportamiento por defecto documentado en
 * https://docs.onvopay.com/en/payments/subscriptions.md). ONVO no documenta pruebas gratis nativas ni una llave de
 * idempotencia: la idempotencia es nuestra (trial_charges) y `metadata.trialKey` + `metadata.attempt` permiten reconocer
 * la suscripción si la respuesta se pierde (listCustomerSubscriptions). Nunca se reintenta sola (POST).
 */
export function createChargedSubscription(input: { customerId: string; paymentMethodId: string; plan: PlanId; billing: Billing; userId: string; trialKey: string; attempt: number }) {
  const priceId = priceIdFor(input.plan, input.billing);
  if (!priceId) throw new OnvoError(`Falta el precio de ONVO para ${input.plan}/${input.billing}`, 503);
  const name = PLANS.find((p) => p.id === input.plan)!.name;
  return onvo<OnvoSubscription>("POST", "/v1/subscriptions", {
    customerId: input.customerId,
    paymentMethodId: input.paymentMethodId,
    description: `Banana Burn, ${name} (${input.billing === "mes" ? "mensual" : "anual"})`,
    items: [{ priceId, quantity: 1 }],
    metadata: { userId: input.userId, plan: input.plan, billing: input.billing, trialKey: input.trialKey, attempt: String(input.attempt) },
  });
}

/**
 * GET /v1/customers/{id}/subscriptions (https://docs.onvopay.com/en/api/obtener-los-cargos-recurrentes-de-un-cliente).
 * La forma de la respuesta no está documentada: aceptamos un arreglo o `{ data: [...] }` y leemos `metadata` de forma defensiva.
 */
export async function listCustomerSubscriptions(customerId: string): Promise<OnvoSubscription[]> {
  const r = await onvo<unknown>("GET", `/v1/customers/${encodeURIComponent(customerId)}/subscriptions`);
  return listOf<OnvoSubscription>(r);
}

/** Lista de ONVO: arreglo directo o `{ data: [...] }`. Pura (testeada). */
export function listOf<T extends { id: string }>(r: unknown): T[] {
  const arr = Array.isArray(r) ? r : r && typeof r === "object" && Array.isArray((r as { data?: unknown }).data) ? (r as { data: unknown[] }).data : [];
  return arr.filter((x): x is T => !!x && typeof x === "object" && typeof (x as { id?: unknown }).id === "string");
}

/** ¿Esta suscripción de ONVO es la de este intento de cobro? (metadata que pusimos al crearla). Pura (testeada). */
export function matchesAttempt(sub: OnvoSubscription, trialKey: string, attempt: number): boolean {
  const md = sub.metadata && typeof sub.metadata === "object" ? (sub.metadata as Record<string, unknown>) : null;
  return !!md && md.trialKey === trialKey && String(md.attempt) === String(attempt);
}

/** Estados con los que ONVO podría responder una suscripción cuyo primer cobro ya se sabe rechazado (no documentados). */
const FIRST_CHARGE_FAILED = new Set(["incomplete_expired", "unpaid", "past_due", "canceled", "cancelled", "failed"]);
export const firstChargeFailed = (sub: OnvoSubscription) => typeof sub.status === "string" && FIRST_CHARGE_FAILED.has(sub.status.toLowerCase());

// ───────────────────────── Tarjetas guardadas ─────────────────────────

/**
 * Método de pago de ONVO (esquema PaymentMethod de openapi.yaml): id, customerId, status (awaiting_authorization,
 * requires-verification, active, detached, suspended, ada-rejected), type y `card` { brand (visa|mastercard), last4, expMonth, expYear }.
 */
export type OnvoPaymentMethod = { id: string; customerId?: string | null; status?: string; type?: string; card?: { brand?: string; last4?: string; expMonth?: number; expYear?: number } | null; [k: string]: unknown };

/** GET /v1/payment-methods/{id} (https://docs.onvopay.com/en/api/obtener-un-metodo-de-pago). Con la llave secreta. */
export function getPaymentMethod(id: string) {
  return onvo<OnvoPaymentMethod>("GET", `/v1/payment-methods/${encodeURIComponent(id)}`);
}

/**
 * POST /v1/payment-methods/{id}/detach (https://docs.onvopay.com/en/api/desconectar-un-metodo-de-pago).
 * La documentación no dice qué llave usa ni el cuerpo: usamos la secreta y sin cuerpo.
 */
export function detachPaymentMethod(id: string) {
  return onvo<OnvoPaymentMethod | null>("POST", `/v1/payment-methods/${encodeURIComponent(id)}/detach`);
}

export type SavedCard = { paymentMethodId: string; customerId: string; brand: string | null; last4: string | null; expMonth: number | null; expYear: number | null };

/**
 * Valida una tarjeta que el navegador acaba de crear en ONVO antes de guardarla (pura, testeada). Los datos salen de ONVO
 * (servidor a servidor), nunca del navegador: el cliente solo manda el ID.
 * - Debe ser una tarjeta (`type: card`), del cliente de ONVO de esta persona y estar `active`.
 * - `requires-verification` u otros estados no sirven para cobrar sin la persona presente.
 */
export function checkPaymentMethod(pm: OnvoPaymentMethod | null | undefined, expectedCustomerId: string): { ok: true; card: SavedCard } | { ok: false; reason: "no_existe" | "otro_cliente" | "no_es_tarjeta" | "no_activa" } {
  if (!pm || typeof pm.id !== "string" || !pm.id) return { ok: false, reason: "no_existe" };
  if (pm.customerId !== expectedCustomerId) return { ok: false, reason: "otro_cliente" };
  if (pm.type && pm.type !== "card") return { ok: false, reason: "no_es_tarjeta" };
  if ((pm.status ?? "").toLowerCase() !== "active") return { ok: false, reason: "no_activa" };
  const c = pm.card && typeof pm.card === "object" ? pm.card : {};
  const brand = typeof c.brand === "string" && /^[a-z_]{1,20}$/.test(c.brand.toLowerCase()) ? c.brand.toLowerCase() : null;
  const last4 = typeof c.last4 === "string" && /^\d{4}$/.test(c.last4) ? c.last4 : null;
  const mm = Number(c.expMonth), yy = Number(c.expYear);
  return {
    ok: true,
    card: {
      paymentMethodId: pm.id, customerId: expectedCustomerId, brand, last4,
      expMonth: Number.isInteger(mm) && mm >= 1 && mm <= 12 ? mm : null,
      expYear: Number.isInteger(yy) && yy >= 2000 && yy <= 2100 ? yy : null,
    },
  };
}

/** GET /v1/subscriptions/{id} */
export function getSubscription(id: string) {
  return onvo<OnvoSubscription>("GET", `/v1/subscriptions/${encodeURIComponent(id)}`);
}

/**
 * Cancela la suscripción en ONVO para que no haya más cobros.
 * DELETE /v1/subscriptions/{id} — https://docs.onvopay.com/en/api/cancelar-un-cargo-recurrente.md
 *
 * TODO(onvo): la documentación no dice si DELETE cancela de inmediato o al final del periodo, ni si
 * existe un `cancelAtPeriodEnd`. Por eso el "cancelar al final del periodo" se implementa de nuestro
 * lado: cortamos la renovación en ONVO ya y conservamos el acceso hasta `current_period_end` en la BD.
 * Si ONVO publica un parámetro de fin de periodo, cámbialo solo aquí.
 */
export function cancelSubscription(id: string) {
  return onvo<OnvoSubscription | null>("DELETE", `/v1/subscriptions/${encodeURIComponent(id)}`);
}

/**
 * Estado de una suscripción leído desde ONVO (fuente de verdad, llamada servidor→servidor).
 * TODO(onvo): el esquema Subscription no está documentado. Asumimos `status` con valores tipo
 * "active" y periodos `currentPeriodStart`/`currentPeriodEnd` o `periodStart`/`periodEnd`
 * (estos últimos sí aparecen en el webhook subscription.renewal.succeeded). Ajusta aquí si difiere.
 */
export async function fetchSubscriptionState(id: string): Promise<{ active: boolean; status: string | null; periodStart: string | null; periodEnd: string | null }> {
  const s = await getSubscription(id);
  const status = typeof s.status === "string" ? s.status.toLowerCase() : null;
  const str = (k: string) => (typeof s[k] === "string" ? (s[k] as string) : null);
  return {
    active: status === "active" || status === "trialing",
    status,
    periodStart: str("currentPeriodStart") ?? str("periodStart"),
    periodEnd: str("currentPeriodEnd") ?? str("periodEnd"),
  };
}

// ───────────────────────── Pagos únicos (retos de la tienda) ─────────────────────────

/** PaymentIntent de ONVO (esquema parcial publicado en openapi.yaml; leemos de forma defensiva). */
export type OnvoPaymentIntent = { id: string; status?: string; amount?: number; currency?: string; customerId?: string; [k: string]: unknown };

/**
 * Crea un cobro único en USD. El monto lo calcula el servidor (precio del reto en la BD menos el descuento por nivel),
 * nunca el cliente. El comprador lo confirma con el SDK web (`paymentType: "one_time"` + `paymentIntentId`).
 * Doc: https://docs.onvopay.com/en/integrations/sdk.md (POST /v1/payment-intents con amount en centavos, currency, description).
 */
export function createPaymentIntent(input: { amountMinor: number; customerId: string; description: string; metadata?: Record<string, string> }) {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor < 50) throw new OnvoError("Monto inválido para ONVO (mínimo 50 centavos de USD)", 400);
  return onvo<OnvoPaymentIntent>("POST", "/v1/payment-intents", {
    amount: input.amountMinor,
    currency: "USD",
    customerId: input.customerId,
    description: input.description.slice(0, 200),
    metadata: input.metadata,
  });
}

/** GET /v1/payment-intents/{id}: fuente de verdad cuando el webhook no trae el monto. */
export function getPaymentIntent(id: string) {
  return onvo<OnvoPaymentIntent>("GET", `/v1/payment-intents/${encodeURIComponent(id)}`);
}

// ───────────────────────── Webhooks ─────────────────────────

export const WEBHOOK_HEADER = "x-webhook-secret";

/**
 * ONVO no firma con HMAC: envía el secreto del webhook en la cabecera `X-Webhook-Secret`
 * (https://docs.onvopay.com/en/webhooks.md). Comparamos en tiempo constante.
 */
export function verifyWebhook(headerValue: string | null | undefined, secret: string | null | undefined): boolean {
  if (!headerValue || !secret) return false;
  const a = createHash("sha256").update(headerValue.trim()).digest();
  const b = createHash("sha256").update(secret.trim()).digest();
  return timingSafeEqual(a, b);
}

/** Eventos documentados en https://docs.onvopay.com/en/webhooks.md */
export type OnvoEventType =
  | "payment-intent.succeeded"
  | "payment-intent.failed"
  | "payment-intent.deferred"
  | "subscription.renewal.succeeded"
  | "subscription.renewal.failed"
  | "checkout-session.succeeded"
  | "mobile-transfer.received";

export type OnvoEvent = { type: string; data: Record<string, unknown> };

export function parseEvent(raw: string): OnvoEvent | null {
  try {
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return null;
    const { type, data } = j as { type?: unknown; data?: unknown };
    if (typeof type !== "string" || !type) return null;
    return { type, data: data && typeof data === "object" ? (data as Record<string, unknown>) : {} };
  } catch {
    return null;
  }
}

const s = (v: unknown) => (typeof v === "string" && v ? v : null);
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const customerIdOf = (d: Record<string, unknown>) =>
  s(d.customerId) ?? (d.customer && typeof d.customer === "object" ? s((d.customer as Record<string, unknown>).id) : null);

/**
 * Clave de idempotencia. ONVO no documenta un ID de evento, así que la derivamos de los campos
 * que identifican cada evento; si faltan, usamos el hash del cuerpo.
 */
export function eventKey(evt: OnvoEvent, rawBody: string): string {
  const d = evt.data;
  const pi = s(d.paymentIntentId);
  switch (evt.type) {
    case "subscription.renewal.succeeded":
      if (pi) return `${evt.type}:${pi}`;
      break;
    case "subscription.renewal.failed":
      if (pi) return `${evt.type}:${pi}:${n(d.attemptCount) ?? s(d.lastPaymentAttempt) ?? "0"}`;
      break;
    case "payment-intent.succeeded":
    case "payment-intent.failed":
    case "payment-intent.deferred":
      if (s(d.id)) return `${evt.type}:${s(d.id)}`;
      break;
  }
  return `${evt.type}:sha256:${createHash("sha256").update(rawBody).digest("hex")}`;
}

/** Acción a aplicar en nuestra BD a partir de un evento de ONVO. Función pura (testeada). */
export type WebhookAction =
  | { kind: "activate"; subscriptionId: string; customerId: string | null; periodStart: string | null; periodEnd: string | null; amountMinor: number | null; currency: string | null; paymentIntentId: string | null }
  | { kind: "renewal_failed"; subscriptionId: string; terminal: boolean; subscriptionStatus: string | null; paymentIntentId: string | null; periodEnd: string | null }
  | { kind: "verify_customer"; customerId: string; paymentIntentId: string | null; amountMinor: number | null; currency: string | null }
  /** Pago único sin cliente en el evento: solo puede ser la compra de un reto (se busca por el ID del PaymentIntent). */
  | { kind: "payment_intent"; paymentIntentId: string; amountMinor: number | null; currency: string | null }
  | { kind: "ignore"; reason: string };

/** Estados de suscripción que significan "ya no se va a cobrar más". */
const TERMINAL = new Set(["canceled", "cancelled", "unpaid", "incomplete_expired", "expired", "ended"]);

export function actionForEvent(evt: OnvoEvent): WebhookAction {
  const d = evt.data;
  switch (evt.type) {
    case "subscription.renewal.succeeded": {
      // data: mode, status (draft|open|paid|void|uncollectible), currency, total, periodStart, periodEnd, subscriptionId, paymentIntentId, customerId
      const sub = s(d.subscriptionId);
      if (!sub) return { kind: "ignore", reason: "sin subscriptionId" };
      const st = s(d.status)?.toLowerCase();
      if (st && st !== "paid") return { kind: "ignore", reason: `factura en estado ${st}` };
      return { kind: "activate", subscriptionId: sub, customerId: customerIdOf(d), periodStart: s(d.periodStart), periodEnd: s(d.periodEnd), amountMinor: n(d.total), currency: s(d.currency), paymentIntentId: s(d.paymentIntentId) };
    }
    case "subscription.renewal.failed": {
      // data: subscriptionId, paymentIntentId, invoiceStatus, subscriptionStatus, attemptCount, nextPaymentAttempt, periodEnd, customer{…}, error{…}
      const sub = s(d.subscriptionId);
      if (!sub) return { kind: "ignore", reason: "sin subscriptionId" };
      const subStatus = s(d.subscriptionStatus)?.toLowerCase() ?? null;
      const terminal = (subStatus !== null && TERMINAL.has(subStatus)) || (d.nextPaymentAttempt === null && "nextPaymentAttempt" in d && subStatus !== "active");
      return { kind: "renewal_failed", subscriptionId: sub, terminal, subscriptionStatus: subStatus, paymentIntentId: s(d.paymentIntentId), periodEnd: s(d.periodEnd) };
    }
    case "payment-intent.succeeded": {
      // El primer cobro de una suscripción confirmada con el SDK podría llegar solo como payment-intent.succeeded.
      // No otorgamos con este evento a ciegas: el webhook consulta el estado de la suscripción en ONVO.
      const cust = customerIdOf(d);
      if (!cust) return s(d.id) ? { kind: "payment_intent", paymentIntentId: s(d.id)!, amountMinor: n(d.amount), currency: s(d.currency) } : { kind: "ignore", reason: "payment intent sin cliente ni id" };
      return { kind: "verify_customer", customerId: cust, paymentIntentId: s(d.id), amountMinor: n(d.amount), currency: s(d.currency) };
    }
    case "payment-intent.failed":
    case "payment-intent.deferred":
      return { kind: "ignore", reason: "solo se registra (el acceso se decide con eventos de suscripción)" };
    case "checkout-session.succeeded":
      return { kind: "ignore", reason: "no usamos Checkout de un solo pago para suscripciones" };
    case "mobile-transfer.received":
      return { kind: "ignore", reason: "no es comprobante de pago por sí solo" };
    default:
      return { kind: "ignore", reason: `evento desconocido: ${evt.type}` };
  }
}

/** Plan del perfil que corresponde a una suscripción. */
export function profilePlanFor(sub: { plan: string | null; status: string; current_period_end: string | null; cancel_at_period_end?: boolean | null }, now = new Date()): "entreno" | "completo" | "free" {
  const plan = sub.plan === "entreno" || sub.plan === "completo" ? sub.plan : null;
  if (!plan) return "free";
  const end = sub.current_period_end ? new Date(sub.current_period_end).getTime() : 0;
  const graceMs = 3 * 24 * 3600 * 1000;
  if (sub.status === "active" || sub.status === "trialing") return !end || end + graceMs > now.getTime() ? plan : "free";
  if (sub.status === "past_due") return end + graceMs > now.getTime() ? plan : "free";
  if (sub.status === "canceled") return sub.cancel_at_period_end && end > now.getTime() ? plan : "free";
  return "free";
}

/** Fin de periodo estimado cuando ONVO no lo informa (se corrige con el siguiente evento de renovación). */
export function estimatePeriodEnd(start: Date, billing: Billing) {
  const d = new Date(start);
  if (billing === "anual") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}
