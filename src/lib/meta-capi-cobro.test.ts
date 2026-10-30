// #68: Subscribe por la API de Conversiones cuando el cobro automático sale bien (fin de la prueba, primer mes con 50 %,
// suscripción de ONVO creada por la prueba). /pago/exito sigue mandando el suyo desde el píxel; aquí no se toca.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fakeDb } from "./fake-db";
import { DAY_MS, idemKeyFor, scheduleFor, type TrialChargeRow } from "./trial";

vi.mock("server-only", () => ({}));
const state: { db: SupabaseClient | null } = { db: null };
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => state.db }));
const onvo = vi.hoisted(() => ({
  createChargedSubscription: vi.fn(), getPaymentMethod: vi.fn(), detachPaymentMethod: vi.fn(), cancelSubscription: vi.fn(),
  listCustomerSubscriptions: vi.fn(), getSubscription: vi.fn(), createCustomer: vi.fn(),
  createPaymentIntent: vi.fn(), confirmPaymentIntent: vi.fn(), getPaymentIntent: vi.fn(),
}));
vi.mock("@/lib/onvo", async (orig) => {
  const real = await orig<typeof import("./onvo")>();
  return { ...real, ...onvo, isOnvoConfigured: () => true, priceIdFor: (p: string, b: string) => `price_${p}_${b}` };
});
vi.mock("@/lib/email", () => ({
  notifyInApp: vi.fn(async () => true), sendChargeCanceled: vi.fn(async () => ({ ok: true })), sendChargeReminder: vi.fn(async () => ({ ok: true })),
  sendPaymentFailed: vi.fn(async () => ({ ok: true })), sendTrialStarted: vi.fn(async () => ({ ok: true })), sendPaymentReceipt: vi.fn(async () => ({ ok: true })),
  sendSubscriptionCanceled: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/push", () => ({ sendPush: vi.fn(async () => 1) }));

const { OnvoError } = await import("./onvo");
const tb = await import("./trial-billing");
const billing = await import("./billing");
const { chargePayload } = await import("./meta-capi");

const USER = "11111111-1111-4111-8111-111111111111";
const EMAIL = "ana@prueba.test";
const T0 = new Date("2026-11-10T15:00:00.000Z");
const D7 = new Date(T0.getTime() + 7 * DAY_MS);
const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));

function setup(extra: Record<string, Record<string, unknown>[]> = {}) {
  const f = fakeDb({
    profiles: [{ id: USER, created_at: "2026-11-09T12:00:00.000Z", plan: "free", email: EMAIL }],
    billing_customers: [{ user_id: USER, provider_customer_id: "cus_new" }],
    subscriptions: [], trial_charges: [], payment_methods: [], payment_events: [], notification_prefs: [], push_subscriptions: [],
    ...extra,
  }, { trial_charges: ["user_id", "idem_key"], payment_methods: ["provider_payment_method_id"], payment_events: ["event_key"] });
  state.db = f.db;
  return f;
}

function scheduled(f: ReturnType<typeof setup>, over: Partial<TrialChargeRow> = {}) {
  const s = scheduleFor("prueba", T0, "2026-11-01T06:00:00.000Z");
  f.tables.payment_methods.push({ user_id: USER, provider_customer_id: "cus_new", provider_payment_method_id: "pm_1", brand: "visa", last4: "4242", exp_month: 12, exp_year: 2030, status: "active" });
  const r = { id: 1, user_id: USER, idem_key: idemKeyFor(USER), kind: "prueba", plan: "completo", billing: "mes", amount_minor: 749, promo: "primer_mes_50", trial_started_at: s.trialStartedAt, trial_ends_at: s.trialEndsAt, charge_at: s.chargeAt, next_attempt_at: s.chargeAt, status: "scheduled", attempts: 0, last_attempt_at: null, provider_subscription_id: null, last_error: null, reminder_sent_at: null, failure_notified_attempt: null, canceled_at: null, created_at: s.trialStartedAt, updated_at: s.trialStartedAt, ...over };
  f.tables.trial_charges.push(r);
  return r as unknown as TrialChargeRow;
}

/** Cuerpos que llegaron a Meta. */
const sent = () => (fetchMock.mock.calls as unknown as [string, RequestInit][]).map(([url, init]) => ({ url, body: JSON.parse(String(init.body)) }));

beforeEach(() => {
  for (const m of Object.values(onvo)) m.mockReset();
  onvo.cancelSubscription.mockResolvedValue(null);
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("META_CAPI_TOKEN", "token-de-prueba");
  vi.stubEnv("META_CAPI_TEST_CODE", "");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Subscribe del cobro automático", () => {
  it("cobro exitoso: manda 1 evento con el monto real en USD, event_id del cobro y sin datos personales en claro", async () => {
    const f = setup(); const r = scheduled(f);
    onvo.createPaymentIntent.mockResolvedValue({ id: "pi_1" });
    onvo.confirmPaymentIntent.mockResolvedValue({ id: "pi_1", status: "succeeded" });
    onvo.getPaymentIntent.mockResolvedValue({ id: "pi_1", status: "succeeded", amount: 749, currency: "USD" });
    expect(await tb.attemptCharge(f.db, r, D7)).toBe("enviado");
    const out = sent();
    expect(out).toHaveLength(1);
    expect(out[0].url).toMatch(/graph\.facebook\.com\/v23\.0\/\d+\/events\?access_token=/);
    const e = out[0].body.data[0];
    expect(e).toMatchObject({ event_name: "Subscribe", event_id: "onvo.charge.approved:pi_1", action_source: "system_generated", custom_data: { value: 7.49, currency: "USD" } });
    expect(Object.keys(e.user_data)).toEqual(["external_id"]);
    expect(e.user_data.external_id).toMatch(/^[0-9a-f]{64}$/);
    const raw = JSON.stringify(out[0].body);
    expect(raw).not.toContain(USER);
    expect(raw).not.toContain(EMAIL);
  });

  it("cobro rechazado: no manda nada", async () => {
    const f = setup(); const r = scheduled(f);
    onvo.createPaymentIntent.mockResolvedValue({ id: "pi_2" });
    onvo.confirmPaymentIntent.mockResolvedValue({ id: "pi_2", status: "requires_action" });
    onvo.getPaymentIntent.mockResolvedValue({ id: "pi_2", status: "requires_action", amount: 749, currency: "USD" });
    expect(await tb.attemptCharge(f.db, r, D7)).toBe("rechazado");
    onvo.createChargedSubscription.mockRejectedValue(new OnvoError("Fondos insuficientes", 402));
    const f2 = setup();
    expect(await tb.attemptCharge(f2.db, scheduled(f2, { promo: null, amount_minor: 1499 }), D7)).toBe("rechazado");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reintento: la respuesta perdida se confirma después y el cobro reprocesado no duplica el evento", async () => {
    const f = setup(); const r = scheduled(f);
    onvo.createPaymentIntent.mockResolvedValue({ id: "pi_3" });
    onvo.confirmPaymentIntent.mockRejectedValue(new OnvoError("timeout", 504));
    expect(await tb.attemptCharge(f.db, r, D7)).toBe("por_confirmar");
    expect(fetchMock).not.toHaveBeenCalled();
    onvo.getPaymentIntent.mockResolvedValue({ id: "pi_3", status: "succeeded", amount: 749, currency: "USD" });
    await tb.runDueForUser(USER, new Date(D7.getTime() + 0.1 * DAY_MS));
    await tb.runDueForUser(USER, new Date(D7.getTime() + 0.2 * DAY_MS));
    // El mismo cobro verificado otra vez (p. ej. la consulta repetida): payment_events lo marca duplicado.
    const sub = f.tables.subscriptions[0] as never;
    expect(await billing.activateVerified(f.db, sub, { periodStart: D7.toISOString(), periodEnd: D7.toISOString(), amountMinor: 749, currency: "USD", reference: "pi_3", provider: "onvo", expectedMinor: 749, auto: true })).toMatchObject({ note: "duplicado" });
    expect(sent().map((x) => x.body.data[0].event_id)).toEqual(["onvo.charge.approved:pi_3"]);
  });

  it("sin META_CAPI_TOKEN: cobra igual y no manda nada", async () => {
    vi.stubEnv("META_CAPI_TOKEN", "");
    const f = setup(); const r = scheduled(f);
    onvo.createPaymentIntent.mockResolvedValue({ id: "pi_4" });
    onvo.confirmPaymentIntent.mockResolvedValue({ id: "pi_4", status: "succeeded" });
    onvo.getPaymentIntent.mockResolvedValue({ id: "pi_4", status: "succeeded", amount: 749, currency: "USD" });
    expect(await tb.attemptCharge(f.db, r, D7)).toBe("enviado");
    expect(f.tables.profiles[0].plan).toBe("completo");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("un pago a mano verificado (sin auto) no manda: ese Subscribe sale de /pago/exito", async () => {
    const f = setup({ subscriptions: [{ id: 5, user_id: USER, provider: "tilopay", provider_subscription_id: "tp_1", status: "incomplete", plan: "entreno", billing: "mes" }] });
    await billing.activateVerified(f.db, f.tables.subscriptions[0] as never, { periodStart: D7.toISOString(), periodEnd: D7.toISOString(), amountMinor: 999, currency: "USD", reference: "orden_1", provider: "tilopay" });
    expect(f.tables.profiles[0].plan).toBe("entreno");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Subscribe del webhook de ONVO", () => {
  const renewal = (subId: string, total: number) => ({ type: "subscription.renewal.succeeded", data: { subscriptionId: subId, status: "paid", total, currency: "USD", periodStart: D7.toISOString(), periodEnd: new Date(D7.getTime() + 30 * DAY_MS).toISOString(), paymentIntentId: `pi_${subId}`, customerId: "cus_new" } });
  const sub = (subId: string) => ({ id: 7, user_id: USER, provider: "onvo", provider_customer_id: "cus_new", provider_subscription_id: subId, status: "incomplete", plan: "completo", billing: "mes" });

  it("primer cobro de la suscripción que creó la prueba: 1 evento; el mismo webhook repetido y la renovación siguiente no mandan", async () => {
    const f = setup({ subscriptions: [sub("sub_7")] });
    scheduled(f, { promo: null, amount_minor: 1499, status: "pending", attempts: 1, provider_subscription_id: "sub_7" });
    const evt = renewal("sub_7", 1499);
    expect(await billing.processWebhook(evt, JSON.stringify(evt))).toMatchObject({ status: "processed" });
    expect(await billing.processWebhook(evt, JSON.stringify(evt))).toMatchObject({ status: "duplicate" });
    const next = { ...evt, data: { ...evt.data, paymentIntentId: "pi_mes2" } };
    await billing.processWebhook(next, JSON.stringify(next));
    expect(sent().map((x) => x.body.data[0])).toMatchObject([{ event_name: "Subscribe", event_id: "onvo.first:sub_7", custom_data: { value: 14.99, currency: "USD" } }]);
  });

  it("después del primer mes con 50 % (marca enviado:<id> de onvo-intro): 1 evento", async () => {
    setup({ subscriptions: [{ id: 6, user_id: USER, provider: "onvo", provider_subscription_id: "onvo-pi:pi_1", status: "active", plan: "completo", billing: "mes", last_renewal_error: "enviado:sub_8" }, { ...sub("sub_8"), id: 8 }] });
    const evt = renewal("sub_8", 1499);
    await billing.processWebhook(evt, JSON.stringify(evt));
    expect(sent().map((x) => x.body.data[0].event_id)).toEqual(["onvo.first:sub_8"]);
  });

  it("una suscripción de /pago/checkout no manda (ya la cuenta el píxel en /pago/exito)", async () => {
    setup({ subscriptions: [sub("sub_checkout")] });
    const evt = renewal("sub_checkout", 1499);
    expect(await billing.processWebhook(evt, JSON.stringify(evt))).toMatchObject({ status: "processed" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("chargePayload", () => {
  it("sin monto, id o event_id no arma nada", () => {
    expect(chargePayload({ userId: USER, amountMinor: 0, eventId: "x" })).toBeNull();
    expect(chargePayload({ userId: "", amountMinor: 999, eventId: "x" })).toBeNull();
    expect(chargePayload({ userId: USER, amountMinor: 999, eventId: "" })).toBeNull();
  });
});
