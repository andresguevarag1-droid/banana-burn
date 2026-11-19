// #333: referidos con tarjeta obligatoria, por las rutas de la app con ONVO y Tilopay simulados (como el simulacro de #313).
// El enlace /r/<código> guarda quién lo trajo y el registro lo atribuye; dejar la tarjeta (día 0) NO avisa un pago; el cobro
// real del día 8 llama a referral_paid una vez por cobro (anual si el plan es anual); si cancela antes del día 8 no hay cobro
// ni aviso. Lo que hace la base con esos avisos (premio al tercero, una sola vez) está en referidos-tarjeta-obligatoria-sql.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "./fake-db";

vi.mock("server-only", () => ({}));
type V = { demo: boolean; id: string; email: string; name: string; role: "free"; plan: string; onboarded: boolean; tz: string; country: string | null };
const state = vi.hoisted(() => ({ db: null as unknown, viewer: null as V | null, refCookie: null as string | null }));
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => state.db }));
vi.mock("@/lib/supabase/server", () => ({ STAFF: ["admin", "superadmin"], createClient: async () => ({}), getViewer: async () => state.viewer }));
vi.mock("@/lib/security/db-rate-limit", async (orig) => ({ ...(await orig<object>()), dbRateLimit: async () => true, dbRateLimitAll: async () => true }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (k: string) => (k === "bb_ref" && state.refCookie ? { value: state.refCookie } : undefined), set: () => {}, delete: () => { state.refCookie = null; } }),
  headers: async () => new Headers(),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {}, unstable_cache: (f: unknown) => f }));
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
  sendSubscriptionCanceled: vi.fn(async () => ({ ok: true })), sendCondoEndingEmail: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/email", () => mail);
vi.mock("@/lib/push", () => ({ sendPush: vi.fn(async () => 1), pushToUser: vi.fn(async () => 1) }));
vi.mock("@/lib/monitor/server", () => ({ recordServerError: vi.fn() }));

const { DAY_MS } = await import("./trial");
const tb = await import("./trial-billing");
const { attributeReferral } = await import("./referrals-server");
const refRoute = await import("@/app/r/[code]/route");
const tarjetaRoute = await import("@/app/api/pagos/tarjeta/route");
const tilopayRoute = await import("@/app/api/pagos/tilopay/route");
const vueltaRoute = await import("@/app/api/pagos/tilopay/vuelta/route");
const webhookRoute = await import("@/app/api/pagos/webhook/route");

const FRIEND = "33333333-3333-4333-8333-333333333333";
/** Lunes 23 de noviembre de 2026, 00:01 de Costa Rica: ya con tarjeta obligatoria. */
const CREATED = "2026-11-23T06:01:00.000Z";
/** Día 8: el cron de cobros de las 00:20 de Costa Rica. */
const DAY8 = "2026-11-30T06:20:00.000Z";
const plus = (iso: string, days: number) => new Date(Date.parse(iso) + days * DAY_MS);
const ORIGIN = "https://bananaburn.app";
const clock = (iso: string | Date) => vi.setSystemTime(new Date(iso));
const goodCard = (id: string, customerId: string) => ({ id, customerId, status: "active", type: "card", card: { brand: "visa", last4: "4242", expMonth: 12, expYear: 2030 } });

function setup(country: string | null = "CR") {
  const f = fakeDb({
    profiles: [{ id: FRIEND, created_at: CREATED, plan: "free", full_name: "Ana Rojas" }], users: [{ id: FRIEND, email: "ana@prueba.test" }],
    billing_customers: [], subscriptions: [], trial_charges: [], payment_methods: [], payment_events: [], charge_keys: [],
    comp_grants: [], tester_grants: [], card_fingerprints: [], notification_prefs: [], push_subscriptions: [], condos: [], condo_members: [],
  }, { trial_charges: ["user_id", "idem_key"], payment_methods: ["provider_payment_method_id"], payment_events: ["event_key"], charge_keys: [{ cols: ["user_id", "periodo", "procesador"], where: (r) => r.estado === "reservado" }] });
  state.db = f.db;
  state.viewer = { demo: false, id: FRIEND, email: "ana@prueba.test", name: "Ana", role: "free", plan: "free", onboarded: true, tz: "America/Costa_Rica", country };
  return f;
}
type F = ReturnType<typeof setup>;
const paidCalls = (f: F) => f.rpcCalls.filter((c) => c.fn === "referral_paid");
const post = (body: unknown) => tarjetaRoute.POST(new Request(`${ORIGIN}/api/pagos/tarjeta`, { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN, host: "bananaburn.app" }, body: JSON.stringify(body) }));

/** Llega por el enlace de quien invita, crea su cuenta (atribución) y deja la tarjeta de ONVO. */
async function arriveAndSaveOnvoCard(f: F, billing: "mes" | "anual" = "mes") {
  clock(plus(CREATED, -0.001));
  const res = await refRoute.GET(new Request(`${ORIGIN}/r/tarj2345?utm_source=whatsapp`), { params: Promise.resolve({ code: "tarj2345" }) });
  expect(res.status).toBe(303);
  const to = new URL(String(res.headers.get("location")));
  expect(`${to.pathname}?modo=${to.searchParams.get("modo")}`).toBe("/entrar?modo=registro");
  expect(res.headers.get("set-cookie")).toContain("bb_ref=tarj2345");
  state.refCookie = "tarj2345";
  clock(plus(CREATED, 0.0005));
  await attributeReferral(FRIEND, "ana@prueba.test");
  expect(f.rpcCalls.filter((c) => c.fn === "referral_attribute")).toMatchObject([{ args: { p_referred: FRIEND, p_code: "tarj2345" } }]);

  clock(plus(CREATED, 0.001));
  onvo.createCustomer.mockResolvedValue({ id: "cus_ref" });
  await post({ action: "preparar" });
  onvo.getPaymentMethod.mockResolvedValue(goodCard("pm_ref", "cus_ref"));
  const saved = await post({ action: "guardar", paymentMethodId: "pm_ref", plan: "entreno", billing });
  expect(await saved.json()).toMatchObject({ ok: true, outcome: "programado" });
  expect(f.tables.trial_charges[0]).toMatchObject({ kind: "prueba", status: "scheduled", charge_at: plus(CREATED, 7).toISOString() });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  for (const m of [...Object.values(onvo), ...Object.values(mail), ...Object.values(tlp)]) m.mockReset();
  for (const m of Object.values(mail)) m.mockResolvedValue({ ok: true } as never);
  onvo.cancelSubscription.mockResolvedValue(null);
  onvo.detachPaymentMethod.mockResolvedValue(null);
  tlp.removeCardToken.mockResolvedValue(true);
  state.refCookie = null;
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
  vi.stubEnv("TILOPAY_STATE_SECRET", "secreto-de-prueba");
  vi.stubEnv("ONVO_WEBHOOK_SECRET", "webhook-de-prueba");
  vi.stubEnv("NEXT_PUBLIC_ONVO_PUBLISHABLE_KEY", "onvo_test_publishable");
  vi.stubEnv("REFERRAL_SECRET", "referidos-de-prueba");
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("referido con tarjeta obligatoria (ONVO)", () => {
  it("dejar la tarjeta no es un pago; el cobro del día 8 avisa el pago una vez, aunque el cron corra dos veces y llegue el webhook", async () => {
    const f = setup();
    await arriveAndSaveOnvoCard(f);
    expect(paidCalls(f)).toEqual([]);

    // Durante la prueba: sin cobro, sin aviso.
    clock(plus(CREATED, 6.9));
    await tb.sweepTrialCharges(new Date(), { skipReminders: true });
    expect(onvo.createPaymentIntent).not.toHaveBeenCalled();
    expect(paidCalls(f)).toEqual([]);

    onvo.createPaymentIntent.mockResolvedValue({ id: "pi_ref" });
    onvo.confirmPaymentIntent.mockResolvedValue({ id: "pi_ref", status: "succeeded" });
    onvo.getPaymentIntent.mockResolvedValue({ id: "pi_ref", status: "succeeded", amount: 499, currency: "USD", customerId: "cus_ref" });
    clock(DAY8);
    await tb.sweepTrialCharges(new Date(), { skipReminders: true });
    await tb.sweepTrialCharges(new Date(), { skipReminders: true });
    expect(onvo.createPaymentIntent).toHaveBeenCalledOnce();
    expect(f.tables.subscriptions[0]).toMatchObject({ status: "active", plan: "entreno" });
    expect(paidCalls(f)).toEqual([{ fn: "referral_paid", args: { p_user: FRIEND, p_annual: false } }]);

    const evt = { type: "payment-intent.succeeded", data: { id: "pi_ref", amount: 499, currency: "USD", customerId: "cus_ref" } };
    const hook = await webhookRoute.POST(new Request(`${ORIGIN}/api/pagos/webhook`, { method: "POST", headers: { "x-webhook-secret": "webhook-de-prueba" }, body: JSON.stringify(evt) }));
    expect(hook.status).toBe(200);
    // El webhook del mismo cobro no vuelve a activar ni a avisar (y si lo hiciera, la base lo cuenta una sola vez: 0064).
    expect(paidCalls(f)).toHaveLength(1);
  });

  it("cancela antes del día 8: no hay cobro ni aviso de pago, así que no cuenta", async () => {
    const f = setup();
    await arriveAndSaveOnvoCard(f);
    clock(plus(CREATED, 3));
    await tb.cancelTrial(state.viewer!, false);
    expect(f.tables.trial_charges[0].status).toBe("canceled");

    clock(DAY8);
    await tb.sweepTrialCharges(new Date(), { skipReminders: true });
    clock(plus(DAY8, 3));
    await tb.sweepTrialCharges(new Date(), { skipReminders: true });
    expect(onvo.createPaymentIntent).not.toHaveBeenCalled();
    expect(onvo.createChargedSubscription).not.toHaveBeenCalled();
    expect(f.tables.subscriptions).toEqual([]);
    expect(paidCalls(f)).toEqual([]);
  });
});

describe("referido con tarjeta obligatoria (Tilopay, plan anual)", () => {
  it("la tarjeta guardada no avisa nada; el cobro anual del día 8 avisa el pago como anual", async () => {
    const f = setup("CO");
    state.refCookie = "tarj2345";
    clock(plus(CREATED, 0.0005));
    await attributeReferral(FRIEND, "ana@prueba.test");

    clock(plus(CREATED, 0.002));
    tlp.createTokenizeUrl.mockResolvedValue("https://tilopay.test/tokenize/ref");
    await tilopayRoute.POST(new Request(`${ORIGIN}/api/pagos/tilopay`, { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN, host: "bananaburn.app" }, body: JSON.stringify({ purpose: "tarjeta", plan: "entreno", billing: "anual" }) }));
    const redirect = String((tlp.createTokenizeUrl.mock.calls as unknown as [{ redirect: string }][])[0][0].redirect);
    await vueltaRoute.GET(new Request(`${redirect}&code=1&crd=tok_ref_anual&brand=visa&last4=1111`));
    expect(f.tables.trial_charges[0]).toMatchObject({ kind: "prueba", status: "scheduled", billing: "anual" });
    expect(paidCalls(f)).toEqual([]);

    tlp.chargeSavedCard.mockResolvedValue({ state: "approved", auth: "a1", transactionId: "t1", description: null });
    clock(DAY8);
    await tb.sweepTrialCharges(new Date(), { skipReminders: true });
    await tb.sweepTrialCharges(new Date(), { skipReminders: true });
    expect(tlp.chargeSavedCard).toHaveBeenCalledOnce();
    expect(paidCalls(f)).toEqual([{ fn: "referral_paid", args: { p_user: FRIEND, p_annual: true } }]);
  });
});
