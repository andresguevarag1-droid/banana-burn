// #329: sin consentimiento guardado no se programa el cobro. ONVO (saveCard) y Tilopay (salida y vuelta firmada) piden la
// aceptación del cobro recurrente; el servidor guarda la fila de billing_consents con sus montos y fecha antes de programarlo.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fakeDb } from "./fake-db";
import { CONSENT_VERSION } from "./billing-consent";

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
const tlp = vi.hoisted(() => ({ chargeSavedCard: vi.fn(), consultOrder: vi.fn(), removeCardToken: vi.fn(), createTokenizeUrl: vi.fn(), createPaymentUrl: vi.fn() }));
vi.mock("@/lib/tilopay", async (orig) => {
  const real = await orig<typeof import("./tilopay")>();
  return { ...real, ...tlp, isTilopayConfigured: () => true, tilopayOfferedTo: () => true };
});
const mail = vi.hoisted(() => ({
  notifyInApp: vi.fn(async () => true), sendChargeCanceled: vi.fn(async () => ({ ok: true })), sendChargeReminder: vi.fn(async () => ({ ok: true })),
  sendPaymentFailed: vi.fn(async () => ({ ok: true })), sendTrialStarted: vi.fn(async () => ({ ok: true })), sendPaymentReceipt: vi.fn(async () => ({ ok: true })),
  sendSubscriptionCanceled: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/email", () => mail);
vi.mock("@/lib/push", () => ({ sendPush: vi.fn(async () => 1) }));
vi.mock("@/lib/monitor/server", () => ({ recordServerError: vi.fn() }));

const tb = await import("./trial-billing");
const tp = await import("./tilopay-billing");

const U = "11111111-1111-4111-8111-111111111111";
const CREATED = "2026-11-23T15:00:00.000Z";
const T0 = new Date("2026-11-23T15:05:00.000Z");
const viewer = { demo: false, id: U, email: "u@prueba.test", name: "Ana", role: "free" as const, plan: "free", onboarded: true, tz: "America/Costa_Rica", country: "CR" };
const OK = { ipCountry: "CR" };

function setup() {
  const f = fakeDb({
    profiles: [{ id: U, created_at: CREATED, plan: "free" }],
    users: [{ id: U, email: "u@prueba.test" }],
    billing_customers: [{ user_id: U, provider_customer_id: "cus_u" }],
    subscriptions: [], trial_charges: [], payment_methods: [], payment_events: [], notification_prefs: [], push_subscriptions: [], comp_grants: [], card_fingerprints: [], billing_consents: [],
  }, { trial_charges: ["user_id", "idem_key"], payment_methods: ["provider_payment_method_id"] });
  state.db = f.db;
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  onvo.getPaymentMethod.mockResolvedValue({ id: "pm_1", customerId: "cus_u", status: "active", type: "card", card: { brand: "visa", last4: "4242", expMonth: 12, expYear: 2030 } });
  tlp.createTokenizeUrl.mockResolvedValue("https://tilopay.test/guardar");
});

describe("ONVO: sin consentimiento no se programa el cobro", () => {
  it("sin consentimiento: error claro y nada guardado (ni tarjeta, ni cobro, ni consentimiento)", async () => {
    const f = setup();
    await expect(tb.saveCard(viewer, { paymentMethodId: "pm_1", plan: "entreno", billing: "mes" }, T0)).rejects.toThrow(tb.CONSENT_MISSING);
    await expect(tb.saveCard(viewer, { paymentMethodId: "pm_1", plan: "entreno", billing: "mes", consent: null }, T0)).rejects.toThrow(tb.CONSENT_MISSING);
    expect(f.tables.trial_charges).toEqual([]);
    expect(f.tables.payment_methods).toEqual([]);
    expect(f.tables.billing_consents).toEqual([]);
  });

  it("mensual: guarda la aceptación con el 50 % del primer mes, el precio normal y la misma fecha del cobro programado", async () => {
    const f = setup();
    const r = await tb.saveCard(viewer, { paymentMethodId: "pm_1", plan: "entreno", billing: "mes", consent: OK }, T0);
    expect(r.outcome).toBe("programado");
    const charge = f.tables.trial_charges[0];
    expect(charge).toMatchObject({ status: "scheduled", amount_minor: 499 });
    expect(f.tables.billing_consents).toHaveLength(1);
    expect(Object.keys(f.tables.billing_consents[0]).filter((k) => /ip/.test(k))).toEqual(["ip_country"]);
    expect(f.tables.billing_consents[0]).toMatchObject({
      user_id: U, accepted_at: T0.toISOString(), text_version: CONSENT_VERSION, plan: "entreno", billing: "mes",
      first_amount_minor: 499, full_amount_minor: 999, first_charge_at: charge.charge_at, processor: "onvo", ip_country: "CR",
    });
  });

  it("anual: primer cobro y cobro de cada año al precio normal", async () => {
    const f = setup();
    await tb.saveCard(viewer, { paymentMethodId: "pm_1", plan: "completo", billing: "anual", consent: { ipCountry: null } }, T0);
    expect(f.tables.billing_consents[0]).toMatchObject({ plan: "completo", billing: "anual", first_amount_minor: 8999, full_amount_minor: 8999, ip_country: null });
  });

  it("si no se puede guardar el consentimiento, no se programa el cobro", async () => {
    const f = setup();
    const real = f.db.from.bind(f.db);
    state.db = { ...f.db, from: (t: string) => (t === "billing_consents" ? { insert: async () => ({ data: null, error: { code: "42P01" } }) } : real(t)) } as unknown as SupabaseClient;
    await expect(tb.saveCard(viewer, { paymentMethodId: "pm_1", plan: "entreno", billing: "mes", consent: OK }, T0)).rejects.toThrow(/autorización/);
    expect(f.tables.trial_charges).toEqual([]);
  });

  it("cambiar la tarjeta de un cobro ya programado no pide otra aceptación", async () => {
    const f = setup();
    await tb.saveCard(viewer, { paymentMethodId: "pm_1", plan: "entreno", billing: "mes", consent: OK }, T0);
    const r = await tb.saveCard(viewer, { paymentMethodId: "pm_1", plan: "entreno", billing: "mes" }, new Date(T0.getTime() + 3600_000));
    expect(r.outcome).toBe("sin_cambio");
    expect(f.tables.billing_consents).toHaveLength(1);
  });
});

describe("Tilopay: el consentimiento viaja en el estado firmado", () => {
  it("sin consentimiento no se abre la página de Tilopay", async () => {
    setup();
    await expect(tp.startTilopayCard(viewer, "entreno", "mes", "https://bananaburn.app")).rejects.toThrow(tb.CONSENT_MISSING);
    expect(tlp.createTokenizeUrl).not.toHaveBeenCalled();
  });

  it("con consentimiento: la vuelta guarda la aceptación (país de la salida) y programa el cobro", async () => {
    vi.stubEnv("TILOPAY_STATE_SECRET", "secreto-de-prueba");
    const f = setup();
    await tp.startTilopayCard(viewer, "completo", "mes", "https://bananaburn.app", { ipCountry: "CO" });
    const redirect = new URL((tlp.createTokenizeUrl.mock.calls[0][0] as { redirect: string }).redirect);
    const { verifyState } = await import("./tilopay");
    const s = verifyState(redirect.searchParams.get("s"))!;
    expect(s).toMatchObject({ c: CONSENT_VERSION, cc: "CO" });
    const out = await tp.handleTilopayReturn(viewer, s, new URLSearchParams({ code: "1", crd: "tok_ext_1", last4: "1111", brand: "visa" }), T0);
    expect(out.outcome).toBe("tarjeta_ok");
    expect(f.tables.trial_charges[0]).toMatchObject({ status: "scheduled", amount_minor: 749 });
    expect(f.tables.billing_consents[0]).toMatchObject({ processor: "tilopay", ip_country: "CO", first_amount_minor: 749, full_amount_minor: 1499, first_charge_at: f.tables.trial_charges[0].charge_at });
    vi.unstubAllEnvs();
  });

  it("una vuelta sin consentimiento en el estado no programa el cobro", async () => {
    const f = setup();
    const s = { u: U, p: "tarjeta" as const, plan: "entreno" as const, billing: "mes" as const, n: "x", t: Math.floor(T0.getTime() / 1000) };
    await expect(tp.handleTilopayReturn(viewer, s, new URLSearchParams({ code: "1", crd: "tok_ext_2" }), T0)).rejects.toThrow(tb.CONSENT_MISSING);
    expect(f.tables.trial_charges).toEqual([]);
    expect(f.tables.payment_methods).toEqual([]);
  });
});
