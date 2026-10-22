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
//   SDK web        https://docs.onvopay.com/en/integrations/sdk.md              paymentType "subscription" + subscriptionId
//   Webhooks       https://docs.onvopay.com/en/webhooks.md                      cabecera X-Webhook-Secret (prefijo webhook_secret_)
import { createHash, timingSafeEqual } from "node:crypto";
import { PLANS, type Billing, type PlanId } from "./plans";
import { parseIntent } from "./checkout-intent";

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

async function onvo<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
  const key = process.env.ONVO_SECRET_KEY;
  if (!key) throw new OnvoError("ONVO_SECRET_KEY no está configurada", 503);
  const res = await fetch(`${ONVO_API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
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
    description: `Banana Burn · usuario ${input.userId}`,
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
    description: `Banana Burn · ${name} (${input.billing === "mes" ? "mensual" : "anual"})`,
    items: [{ priceId, quantity: 1 }],
    metadata: { userId: input.userId, plan: input.plan, billing: input.billing },
  });
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
      if (!cust) return { kind: "ignore", reason: "payment intent sin cliente" };
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
