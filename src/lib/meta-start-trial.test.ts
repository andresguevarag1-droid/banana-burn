// #331: StartTrial a Meta cuando la tarjeta queda guardada y empieza la prueba. El servidor lo arma (saveVerifiedCard), lo manda
// por la API de Conversiones y devuelve el mismo event_id para el píxel del navegador: Meta lo cuenta una vez.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fakeDb } from "./fake-db";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ STAFF: ["admin", "superadmin"], createClient: async () => ({}) }));
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
const fbq = vi.hoisted(() => vi.fn());
vi.mock("@/components/meta-pixel", () => ({ fbq }));
vi.mock("next/navigation", () => ({ usePathname: () => "/app/suscripcion" }));

const tb = await import("./trial-billing");
const { CARD_REQUIRED_FROM } = await import("./card-required");
const { startTrialEvent, isTrialEventId, TRIAL_LTV_MONTHS } = await import("./meta-pixel");
const { startTrialPayload, sendStartTrial } = await import("./meta-capi");
const { trackStartTrial } = await import("@/components/analytics");
const { tilopayReturnPath } = await import("./pago-fallo");

const USER = "33333333-3333-4333-8333-333333333333";
const SIGNUP = new Date(Date.parse(CARD_REQUIRED_FROM) + 15 * 60_000);
const viewer = { demo: false, id: USER, email: "ana@prueba.test", name: "Ana", role: "free" as const, plan: "free", onboarded: true, tz: "America/Costa_Rica", country: "CR" };
const CTX = { ip: "200.1.2.3", ua: "Mozilla/5.0", cookies: "_fbp=fb.1.1.2; otra=1", origin: "https://bananaburn.app", now: Date.parse("2026-11-23T06:15:00.000Z") };
const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));

function setup() {
  const f = fakeDb({
    profiles: [{ id: USER, created_at: CARD_REQUIRED_FROM, plan: "free" }],
    billing_customers: [{ user_id: USER, provider_customer_id: "cus_new" }],
    subscriptions: [], trial_charges: [], payment_methods: [], payment_events: [], notification_prefs: [], push_subscriptions: [],
  }, { trial_charges: ["user_id", "idem_key"], payment_methods: ["provider_payment_method_id"], payment_events: ["event_key"] });
  state.db = f.db;
  return f;
}

beforeEach(() => {
  for (const m of Object.values(onvo)) m.mockReset();
  fbq.mockReset();
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("META_CAPI_TOKEN", "token-de-prueba");
  vi.stubEnv("META_CAPI_TEST_CODE", "");
  onvo.getPaymentMethod.mockResolvedValue({ id: "pm_1", customerId: "cus_new", status: "active", type: "card", card: { brand: "visa", last4: "4242", expMonth: 12, expYear: 2030 } });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("valor de StartTrial", () => {
  it("mensual: value es el primer cobro con el 50 % y predicted_ltv el precio mensual × 3", () => {
    expect(TRIAL_LTV_MONTHS).toBe(3);
    expect(startTrialEvent({ id: 7, plan: "entreno", billing: "mes", amountMinor: 499 })).toEqual({ eventId: "trial-7", value: 4.99, predicted_ltv: 29.97 });
    expect(startTrialEvent({ id: 8, plan: "completo", billing: "mes", amountMinor: 749 })).toEqual({ eventId: "trial-8", value: 7.49, predicted_ltv: 44.97 });
  });

  it("anual: value y predicted_ltv son el precio del año", () => {
    expect(startTrialEvent({ id: 9, plan: "entreno", billing: "anual", amountMinor: 5999 })).toEqual({ eventId: "trial-9", value: 59.99, predicted_ltv: 59.99 });
  });

  it("sin monto o plan desconocido no hay evento; el event_id se reconoce a la vuelta de Tilopay", () => {
    expect(startTrialEvent({ id: 1, plan: "entreno", billing: "mes", amountMinor: 0 })).toBeNull();
    expect(isTrialEventId("trial-12")).toBe(true);
    expect(isTrialEventId("buy-sub_1")).toBe(false);
    expect(isTrialEventId("trial-<script>")).toBe(false);
  });
});

describe("StartTrial al guardar la tarjeta", () => {
  it("la tarjeta que empieza la prueba devuelve StartTrial; volver a guardarla no", async () => {
    const f = setup();
    const saved = await tb.saveCard(viewer, { paymentMethodId: "pm_1", plan: "entreno", billing: "mes" }, SIGNUP);
    const id = (f.tables.trial_charges[0] as { id: number }).id;
    expect(saved.outcome).toBe("programado");
    expect(saved.startTrial).toEqual({ eventId: `trial-${id}`, value: 4.99, predicted_ltv: 29.97 });

    const again = await tb.saveCard(viewer, { paymentMethodId: "pm_1", plan: "entreno", billing: "mes" }, new Date(SIGNUP.getTime() + 60_000));
    expect(again.startTrial ?? null).toBeNull();
  });

  it("plan anual: el valor es el del año", async () => {
    setup();
    const saved = await tb.saveCard(viewer, { paymentMethodId: "pm_1", plan: "completo", billing: "anual" }, SIGNUP);
    expect(saved.startTrial).toMatchObject({ value: 89.99, predicted_ltv: 89.99 });
  });

  it("CAPI recibe StartTrial con el mismo event_id, valor en USD y sin datos personales", async () => {
    const st = { eventId: "trial-42", value: 4.99, predicted_ltv: 29.97 };
    expect(startTrialPayload(st, { ...CTX, path: "/bienvenida" })).toEqual({
      data: [{
        event_name: "StartTrial", event_time: Math.floor(CTX.now / 1000), event_id: "trial-42", action_source: "website",
        event_source_url: "https://bananaburn.app/bienvenida",
        user_data: { client_ip_address: "200.1.2.3", client_user_agent: "Mozilla/5.0", fbp: "fb.1.1.2" },
        custom_data: { value: 4.99, currency: "USD", predicted_ltv: 29.97 },
      }],
    });
    await sendStartTrial(st, CTX);
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.data[0]).toMatchObject({ event_name: "StartTrial", event_id: "trial-42" });
    expect(JSON.stringify(body)).not.toContain("ana@prueba.test");
    expect(JSON.stringify(body)).not.toContain(USER);
  });

  it("sin META_CAPI_TOKEN o sin evento no llama a Meta", async () => {
    await sendStartTrial(null, CTX);
    vi.stubEnv("META_CAPI_TOKEN", "");
    await sendStartTrial({ eventId: "trial-1", value: 4.99, predicted_ltv: 29.97 }, CTX);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("el píxel recibe StartTrial una sola vez, con el event_id del servidor", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    const st = { eventId: "trial-42", value: 7.49, predicted_ltv: 44.97 };
    trackStartTrial(st);
    trackStartTrial(st);
    trackStartTrial(null);
    expect(fbq).toHaveBeenCalledOnce();
    expect(fbq).toHaveBeenCalledWith("track", "StartTrial", { value: 7.49, currency: "USD", predicted_ltv: 44.97 }, { eventID: "trial-42" });
  });

  it("la vuelta de Tilopay lleva el event_id a Mi plan solo si la tarjeta quedó guardada", () => {
    const s = { p: "tarjeta" as const, plan: "entreno", billing: "mes" };
    expect(tilopayReturnPath("tarjeta_ok", s, undefined, "trial-42")).toBe("/app/suscripcion?tilopay=tarjeta_ok&inicio=trial-42#tarjeta");
    expect(tilopayReturnPath("tarjeta_ok", s)).toBe("/app/suscripcion?tilopay=tarjeta_ok#tarjeta");
    expect(tilopayReturnPath("rechazada", s, undefined, "trial-42")).not.toContain("inicio");
  });
});
