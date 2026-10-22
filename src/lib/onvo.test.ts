import { describe, expect, it } from "vitest";
import {
  actionForEvent, eventKey, expectedAmountMinor, isOnvoConfigured, parseEvent, parsePlanBilling,
  planFromPriceId, priceIdFor, profilePlanFor, verifyWebhook, estimatePeriodEnd,
} from "./onvo";

const ENV = {
  ONVO_SECRET_KEY: "onvo_test_secret_key_x",
  NEXT_PUBLIC_ONVO_PUBLISHABLE_KEY: "onvo_test_publishable_key_x",
  ONVO_WEBHOOK_SECRET: "webhook_secret_abc",
  ONVO_PRICE_ENTRENO_MES: "price_em",
  ONVO_PRICE_ENTRENO_ANUAL: "price_ea",
  ONVO_PRICE_COMPLETO_MES: "price_cm",
  ONVO_PRICE_COMPLETO_ANUAL: "price_ca",
} as unknown as NodeJS.ProcessEnv;

describe("verificación del webhook (X-Webhook-Secret)", () => {
  it("acepta el secreto exacto", () => {
    expect(verifyWebhook("webhook_secret_abc", "webhook_secret_abc")).toBe(true);
    expect(verifyWebhook("  webhook_secret_abc ", "webhook_secret_abc")).toBe(true);
  });
  it("rechaza secretos distintos, vacíos o ausentes", () => {
    expect(verifyWebhook("webhook_secret_abd", "webhook_secret_abc")).toBe(false);
    expect(verifyWebhook("webhook_secret_ab", "webhook_secret_abc")).toBe(false);
    expect(verifyWebhook("", "webhook_secret_abc")).toBe(false);
    expect(verifyWebhook(null, "webhook_secret_abc")).toBe(false);
    expect(verifyWebhook("webhook_secret_abc", "")).toBe(false);
    expect(verifyWebhook("webhook_secret_abc", undefined)).toBe(false);
  });
});

describe("planes y precios", () => {
  it("valida plan/periodo del cliente contra plans.ts", () => {
    expect(parsePlanBilling("entreno", "mes")).toEqual({ plan: "entreno", billing: "mes" });
    expect(parsePlanBilling("completo", "anual")).toEqual({ plan: "completo", billing: "anual" });
    expect(parsePlanBilling("pro", "mes")).toBeNull();
    expect(parsePlanBilling("entreno", "semanal")).toBeNull();
    expect(parsePlanBilling({ plan: "x" }, 999)).toBeNull();
  });
  it("mapea plan ↔ priceId de ONVO", () => {
    expect(priceIdFor("completo", "anual", ENV)).toBe("price_ca");
    expect(planFromPriceId("price_em", ENV)).toEqual({ plan: "entreno", billing: "mes" });
    expect(planFromPriceId("price_desconocido", ENV)).toBeNull();
    expect(planFromPriceId(null, ENV)).toBeNull();
  });
  it("monto esperado en centavos según plans.ts", () => {
    expect(expectedAmountMinor("entreno", "mes")).toBe(999);
    expect(expectedAmountMinor("entreno", "anual")).toBe(5999);
    expect(expectedAmountMinor("completo", "mes")).toBe(1499);
    expect(expectedAmountMinor("completo", "anual")).toBe(8999);
  });
  it("configuración completa requerida", () => {
    expect(isOnvoConfigured(ENV)).toBe(true);
    expect(isOnvoConfigured({ ...ENV, ONVO_PRICE_COMPLETO_ANUAL: "" } as NodeJS.ProcessEnv)).toBe(false);
    expect(isOnvoConfigured({} as NodeJS.ProcessEnv)).toBe(false);
  });
});

describe("evento → acción", () => {
  it("renovación pagada activa la suscripción", () => {
    const evt = parseEvent(JSON.stringify({
      type: "subscription.renewal.succeeded",
      data: { mode: "test", status: "paid", currency: "USD", total: 999, periodStart: "2026-11-01T00:00:00Z", periodEnd: "2026-12-01T00:00:00Z", subscriptionId: "sub_1", paymentIntentId: "pi_1", customerId: "cus_1" },
    }))!;
    expect(actionForEvent(evt)).toEqual({ kind: "activate", subscriptionId: "sub_1", customerId: "cus_1", periodStart: "2026-11-01T00:00:00Z", periodEnd: "2026-12-01T00:00:00Z", amountMinor: 999, currency: "USD", paymentIntentId: "pi_1" });
  });
  it("renovación con factura no pagada se ignora", () => {
    expect(actionForEvent({ type: "subscription.renewal.succeeded", data: { subscriptionId: "sub_1", status: "open" } }).kind).toBe("ignore");
    expect(actionForEvent({ type: "subscription.renewal.succeeded", data: {} }).kind).toBe("ignore");
  });
  it("renovación fallida: past_due si habrá reintento, terminal si la suscripción terminó", () => {
    const retry = actionForEvent({ type: "subscription.renewal.failed", data: { subscriptionId: "sub_1", subscriptionStatus: "past_due", nextPaymentAttempt: "2026-12-03T00:00:00Z", attemptCount: 1 } });
    expect(retry).toMatchObject({ kind: "renewal_failed", terminal: false });
    const dead = actionForEvent({ type: "subscription.renewal.failed", data: { subscriptionId: "sub_1", subscriptionStatus: "canceled", attemptCount: 4 } });
    expect(dead).toMatchObject({ kind: "renewal_failed", terminal: true });
    const noMore = actionForEvent({ type: "subscription.renewal.failed", data: { subscriptionId: "sub_1", subscriptionStatus: "past_due", nextPaymentAttempt: null } });
    expect(noMore).toMatchObject({ kind: "renewal_failed", terminal: true });
  });
  it("payment-intent.succeeded pide verificar con ONVO (no otorga a ciegas)", () => {
    const a = actionForEvent({ type: "payment-intent.succeeded", data: { id: "pi_9", amount: 5999, currency: "USD", customer: { id: "cus_2" } } });
    expect(a).toEqual({ kind: "verify_customer", customerId: "cus_2", paymentIntentId: "pi_9", amountMinor: 5999, currency: "USD" });
    expect(actionForEvent({ type: "payment-intent.succeeded", data: { id: "pi_9" } })).toEqual({ kind: "payment_intent", paymentIntentId: "pi_9", amountMinor: null, currency: null });
    expect(actionForEvent({ type: "payment-intent.succeeded", data: {} }).kind).toBe("ignore");
  });
  it("otros eventos solo se registran", () => {
    for (const type of ["payment-intent.failed", "payment-intent.deferred", "checkout-session.succeeded", "mobile-transfer.received", "algo.nuevo"]) {
      expect(actionForEvent({ type, data: {} }).kind).toBe("ignore");
    }
  });
  it("cuerpos inválidos", () => {
    expect(parseEvent("no json")).toBeNull();
    expect(parseEvent(JSON.stringify({ data: {} }))).toBeNull();
    expect(parseEvent(JSON.stringify({ type: "x" }))).toEqual({ type: "x", data: {} });
  });
});

describe("idempotencia", () => {
  it("misma renovación → misma clave; distinta → distinta", () => {
    const a = { type: "subscription.renewal.succeeded", data: { paymentIntentId: "pi_1" } };
    expect(eventKey(a, "{}")).toBe(eventKey(a, "{ }"));
    expect(eventKey(a, "{}")).not.toBe(eventKey({ ...a, data: { paymentIntentId: "pi_2" } }, "{}"));
  });
  it("reintentos de cobro fallido se distinguen por intento", () => {
    const f = (n: number) => eventKey({ type: "subscription.renewal.failed", data: { paymentIntentId: "pi_1", attemptCount: n } }, "");
    expect(f(1)).not.toBe(f(2));
  });
  it("sin identificadores usa hash del cuerpo", () => {
    const k1 = eventKey({ type: "checkout-session.succeeded", data: {} }, '{"a":1}');
    const k2 = eventKey({ type: "checkout-session.succeeded", data: {} }, '{"a":2}');
    expect(k1).toMatch(/^checkout-session\.succeeded:sha256:/);
    expect(k1).not.toBe(k2);
  });
});

describe("plan del perfil según la suscripción", () => {
  const now = new Date("2026-11-15T00:00:00Z");
  const base = { plan: "completo", current_period_end: "2026-12-01T00:00:00Z", cancel_at_period_end: false };
  it("activa vigente → plan", () => expect(profilePlanFor({ ...base, status: "active" }, now)).toBe("completo"));
  it("pendiente de primer pago → free", () => expect(profilePlanFor({ ...base, status: "incomplete" }, now)).toBe("free"));
  it("cancelada al final del periodo conserva acceso hasta el fin", () => {
    expect(profilePlanFor({ ...base, status: "canceled", cancel_at_period_end: true }, now)).toBe("completo");
    expect(profilePlanFor({ ...base, status: "canceled", cancel_at_period_end: true }, new Date("2026-12-02T00:00:00Z"))).toBe("free");
    expect(profilePlanFor({ ...base, status: "canceled", cancel_at_period_end: false }, now)).toBe("free");
  });
  it("pago fallido: gracia de 3 días", () => {
    expect(profilePlanFor({ ...base, status: "past_due" }, new Date("2026-12-03T00:00:00Z"))).toBe("completo");
    expect(profilePlanFor({ ...base, status: "past_due" }, new Date("2026-12-05T00:00:00Z"))).toBe("free");
  });
  it("activa vencida sin renovar → free", () => expect(profilePlanFor({ ...base, status: "active" }, new Date("2026-12-10T00:00:00Z"))).toBe("free"));
  it("plan desconocido → free", () => expect(profilePlanFor({ ...base, plan: "pro", status: "active" }, now)).toBe("free"));
  it("estima fin de periodo", () => {
    expect(estimatePeriodEnd(new Date("2026-01-31T00:00:00Z"), "anual").toISOString()).toBe("2027-01-31T00:00:00.000Z");
    expect(estimatePeriodEnd(new Date("2026-03-10T00:00:00Z"), "mes").toISOString()).toBe("2026-04-10T00:00:00.000Z");
  });
});
