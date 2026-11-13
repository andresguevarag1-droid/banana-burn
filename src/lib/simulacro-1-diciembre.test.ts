// #313: simulacro del 1 de diciembre de 2026. Desde CARD_REQUIRED_FROM (00:00 de Costa Rica) toda cuenta nueva deja tarjeta
// para empezar su prueba. Aquí se recorre la cadena completa de una cuenta creada el 1 dic a las 00:01 de Costa Rica, con
// ONVO y Tilopay simulados (sin red ni base real): bienvenida, tarjeta por las rutas de la app, prueba activa, cobro del
// día 8 por el cron y Subscribe por la API de Conversiones. Tilopay no manda webhook: el cobro se confirma con su respuesta
// servidor a servidor (o con la consulta de la orden). La guía para probarlo en producción: docs/qa/simulacro-1-diciembre.md.
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fakeDb } from "./fake-db";
import type { CardRow, TrialChargeRow } from "./trial";

vi.mock("server-only", () => ({}));
type V = { demo: boolean; id: string; email: string; name: string; role: "free"; plan: string; onboarded: boolean; tz: string; country: string | null };
const state = vi.hoisted(() => ({ db: null as unknown, viewer: null as V | null }));
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => state.db }));
vi.mock("@/lib/supabase/server", () => ({ STAFF: ["admin", "superadmin"], createClient: async () => ({}), getViewer: async () => state.viewer }));
vi.mock("@/lib/security/db-rate-limit", async (orig) => ({ ...(await orig<object>()), dbRateLimit: async () => true, dbRateLimitAll: async () => true }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => {} }), headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {}, unstable_cache: (f: unknown) => f }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }), usePathname: () => "/bienvenida", useSearchParams: () => new URLSearchParams(), redirect: () => {} }));
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

const { CARD_REQUIRED_FROM, cardRequiredFor } = await import("./card-required");
const { entitlementsFrom } = await import("./entitlements");
const { CONDO_FREE_DAYS } = await import("./condos");
const { DAY_MS } = await import("./trial");
const { PAYMENT_FAILED } = await import("./pago-fallo");
const tb = await import("./trial-billing");
const billing = await import("./billing");
const { signState } = await import("./tilopay");
const tarjetaRoute = await import("@/app/api/pagos/tarjeta/route");
const tilopayRoute = await import("@/app/api/pagos/tilopay/route");
const vueltaRoute = await import("@/app/api/pagos/tilopay/vuelta/route");
const webhookRoute = await import("@/app/api/pagos/webhook/route");
const { Wizard } = await import("@/app/bienvenida/wizard");

const USER = "44444444-4444-4444-8444-444444444444";
/** 1 de diciembre de 2026 a las 00:01 de Costa Rica: un minuto después del corte. */
const CREATED = "2026-12-01T06:01:00.000Z";
/** 30 de noviembre de 2026 a las 23:59 de Costa Rica: un minuto antes del corte. */
const BEFORE = "2026-12-01T05:59:00.000Z";
/** Día 8: el cron de cobros de las 00:20 de Costa Rica (vercel.json "20 6 * * *"). */
const DAY8 = "2026-12-08T06:20:00.000Z";
const plus = (iso: string, days: number) => new Date(Date.parse(iso) + days * DAY_MS);
const ORIGIN = "https://bananaburn.app";
const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));

function setup(createdAt = CREATED, country: string | null = "CR") {
  const f = fakeDb({
    profiles: [{ id: USER, created_at: createdAt, plan: "free" }], users: [{ id: USER, email: "ana@prueba.test" }],
    billing_customers: [], subscriptions: [], trial_charges: [], payment_methods: [], payment_events: [], charge_keys: [],
    comp_grants: [], tester_grants: [], card_fingerprints: [], notification_prefs: [], push_subscriptions: [],
    condos: [{ id: 1, code: "las-palmas", name: "Las Palmas", status: "mes_gratis", free_ends_at: null, paid_plan: null, paid_until: null, card_required: false, free_until: null }],
    condo_members: [],
  }, { trial_charges: ["user_id", "idem_key"], payment_methods: ["provider_payment_method_id"], payment_events: ["event_key"], charge_keys: [{ cols: ["user_id", "periodo", "procesador"], where: (r) => r.estado === "reservado" }] });
  state.db = f.db;
  state.viewer = { demo: false, id: USER, email: "ana@prueba.test", name: "Ana", role: "free", plan: "free", onboarded: true, tz: "America/Costa_Rica", country };
  return f;
}
type F = ReturnType<typeof setup>;

/** Lo que ve la app (layout de /app y la bienvenida) en ese momento. */
const access = (f: F, now: Date, createdAt = CREATED) => entitlementsFrom({
  profilePlan: String(f.tables.profiles[0].plan), role: "free", createdAt, now,
  subs: f.tables.subscriptions as never,
  trialCharge: (f.tables.trial_charges[0] as unknown as TrialChargeRow | undefined) ?? null,
  card: (f.tables.payment_methods[0] as unknown as CardRow | undefined) ?? null,
});
const clock = (iso: string | Date) => vi.setSystemTime(new Date(iso));
const post = (body: unknown) => tarjetaRoute.POST(new Request(`${ORIGIN}/api/pagos/tarjeta`, { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN, host: "bananaburn.app" }, body: JSON.stringify(body) }));
const failures = (f: F) => f.tables.payment_events.filter((e) => e.type === PAYMENT_FAILED);
/** Eventos que llegaron a Meta por la API de Conversiones. */
const subscribes = () => (fetchMock.mock.calls as unknown as [string, RequestInit][])
  .filter(([url]) => String(url).includes("graph.facebook.com")).map(([, init]) => JSON.parse(String(init.body)).data[0]);
const goodCard = (id: string, customerId: string) => ({ id, customerId, status: "active", type: "card", card: { brand: "visa", last4: "4242", expMonth: 12, expYear: 2030 } });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  for (const m of [...Object.values(onvo), ...Object.values(mail), ...Object.values(tlp)]) m.mockReset();
  for (const m of Object.values(mail)) m.mockResolvedValue({ ok: true } as never);
  mail.notifyInApp.mockResolvedValue(true as never);
  onvo.cancelSubscription.mockResolvedValue(null);
  onvo.detachPaymentMethod.mockResolvedValue(null);
  tlp.removeCardToken.mockResolvedValue(true);
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("META_CAPI_TOKEN", "token-de-prueba");
  vi.stubEnv("META_CAPI_TEST_CODE", "");
  vi.stubEnv("TILOPAY_STATE_SECRET", "secreto-de-prueba");
  vi.stubEnv("ONVO_WEBHOOK_SECRET", "webhook-de-prueba");
  vi.stubEnv("NEXT_PUBLIC_ONVO_PUBLISHABLE_KEY", "onvo_test_publishable");
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("el corte", () => {
  it("la app y la base usan la misma fecha (0071) y la cuenta de las 00:01 cae después", () => {
    expect(CARD_REQUIRED_FROM).toBe("2026-12-01T06:00:00.000Z");
    expect(readFileSync("supabase/migrations/0071_tarjeta_desde_diciembre.sql", "utf8")).toContain("timestamptz '2026-12-01 06:00:00+00'");
    expect(cardRequiredFor(CREATED)).toBe(true);
    expect(cardRequiredFor(BEFORE)).toBe(false);
  });
});

describe("1. ONVO (tarjeta de Costa Rica): de la bienvenida al Subscribe del día 8", () => {
  it("bienvenida con tarjeta obligatoria, /api/pagos/tarjeta, prueba activa, cobro de $4.99 el día 8 y Subscribe una vez", async () => {
    const f = setup();
    clock(plus(CREATED, 0.001));

    // Recién registrada: sin tarjeta no hay prueba, y la app la manda a la bienvenida (app/layout.tsx: cardStep "card").
    expect(access(f, new Date())).toMatchObject({ locked: true, trial: null, cardStep: "card" });
    // El paso de la tarjeta no se puede saltar: sin "sin tarjeta", sin "Atrás" y con el botón que empieza la prueba.
    const html = renderToStaticMarkup(createElement(Wizard, { name: "Ana", demo: false, initialGoal: null, glp1: false, country: "CR", intent: null, trialEndsAt: plus(CREATED, 7).toISOString(), chargeAt: plus(CREATED, 7).toISOString(), cardRequired: true, onboarded: true, startOnCard: true }));
    expect(html).toContain("Deja tu tarjeta para empezar tus 7 días gratis");
    expect(html).toContain("Empezar mis 7 días gratis");
    expect(html).not.toMatch(/sin tarjeta|tarjeta es opcional|Saltar|Ahora no/i);
    expect(html).not.toContain('aria-label="Atrás"');

    // El navegador prepara el cliente de ONVO y guarda la tarjeta (el número nunca pasa por aquí: solo el id).
    onvo.createCustomer.mockResolvedValue({ id: "cus_cr" });
    const prep = await (await post({ action: "preparar" })).json();
    expect(prep).toMatchObject({ ok: true, customerId: "cus_cr", publicKey: "onvo_test_publishable" });
    onvo.getPaymentMethod.mockResolvedValue(goodCard("pm_cr", "cus_cr"));
    const res = await post({ action: "guardar", paymentMethodId: "pm_cr", plan: "entreno", billing: "mes" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, outcome: "programado", card: { brand: "visa", last4: "4242" } });
    expect(onvo.createPaymentIntent).not.toHaveBeenCalled();
    expect(f.tables.trial_charges[0]).toMatchObject({ kind: "prueba", status: "scheduled", promo: "primer_mes_50", amount_minor: 499, trial_started_at: CREATED, charge_at: plus(CREATED, 7).toISOString() });
    expect(failures(f)).toEqual([]);

    // Prueba activa: 7 días con todo incluido, el cobro programado con el 50 %.
    clock(plus(CREATED, 1));
    expect(access(f, new Date())).toMatchObject({ access: "trial", app: true, nutrition: true, locked: false, cardStep: "none" });
    expect(access(f, new Date()).charge).toMatchObject({ phase: "programado", amount: 4.99, promo: true });

    // Día 8: el cron cobra el primer mes con 50 % (PaymentIntent de ONVO), una sola vez aunque corra dos veces.
    onvo.createPaymentIntent.mockResolvedValue({ id: "pi_cr" });
    onvo.confirmPaymentIntent.mockResolvedValue({ id: "pi_cr", status: "succeeded" });
    onvo.getPaymentIntent.mockResolvedValue({ id: "pi_cr", status: "succeeded", amount: 499, currency: "USD" });
    clock(DAY8);
    await tb.sweepTrialCharges(new Date(), { skipReminders: true });
    await tb.sweepTrialCharges(new Date(), { skipReminders: true });
    expect(onvo.createPaymentIntent).toHaveBeenCalledOnce();
    expect((onvo.createPaymentIntent.mock.calls as unknown[][])[0][0]).toMatchObject({ amountMinor: 499, customerId: "cus_cr" });
    expect(f.tables.subscriptions[0]).toMatchObject({ provider_subscription_id: "onvo-pi:pi_cr", status: "active", plan: "entreno" });
    expect(f.tables.profiles[0].plan).toBe("entreno");
    expect(access(f, new Date())).toMatchObject({ locked: false, app: true });

    // El webhook de ONVO del mismo cobro llega después: no activa otra vez ni manda otro Subscribe.
    const evt = { type: "payment-intent.succeeded", data: { id: "pi_cr", amount: 499, currency: "USD", customerId: "cus_cr" } };
    const hook = await webhookRoute.POST(new Request(`${ORIGIN}/api/pagos/webhook`, { method: "POST", headers: { "x-webhook-secret": "webhook-de-prueba" }, body: JSON.stringify(evt) }));
    expect(hook.status).toBe(200);
    expect(subscribes()).toMatchObject([{ event_name: "Subscribe", action_source: "system_generated", event_id: "onvo.charge.approved:pi_cr", custom_data: { value: 4.99, currency: "USD" } }]);
  });
});

describe("2. Tilopay (tarjeta extranjera): salida, vuelta sin sesión y cobro del día 8", () => {
  it("la tarjeta se guarda aunque vuelva sin sesión, la prueba queda activa y el día 8 cobra $7.49 con Subscribe", async () => {
    const f = setup(CREATED, "CO");
    clock(plus(CREATED, 0.002));
    expect(access(f, new Date())).toMatchObject({ locked: true, cardStep: "card" });

    // Salida: la app pide a Tilopay su página segura para guardar la tarjeta, con la vuelta firmada.
    tlp.createTokenizeUrl.mockResolvedValue("https://tilopay.test/tokenize/abc");
    const out = await tilopayRoute.POST(new Request(`${ORIGIN}/api/pagos/tilopay`, { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN, host: "bananaburn.app" }, body: JSON.stringify({ purpose: "tarjeta", plan: "completo", billing: "mes" }) }));
    expect(await out.json()).toEqual({ ok: true, url: "https://tilopay.test/tokenize/abc" });
    const redirect = String((tlp.createTokenizeUrl.mock.calls as unknown as [{ redirect: string }][])[0][0].redirect);
    expect(redirect.startsWith(`${ORIGIN}/api/pagos/tilopay/vuelta?s=`)).toBe(true);

    // Vuelta sin sesión (#298: el banco abrió otro navegador o se perdió la cookie): la tarjeta se guarda igual con el
    // estado firmado y se pide entrar para ver Mi plan.
    state.viewer = null;
    clock(plus(CREATED, 0.003));
    const back = await vueltaRoute.GET(new Request(`${redirect}&code=1&crd=tok_extranjera_123&brand=visa&last4=1111`));
    expect(back.status).toBe(303);
    const loc = new URL(String(back.headers.get("location")));
    expect(loc.pathname).toBe("/entrar");
    expect(loc.searchParams.get("next")).toBe("/app/suscripcion?tilopay=tarjeta_ok#tarjeta");
    expect(f.tables.payment_methods[0]).toMatchObject({ user_id: USER, provider: "tilopay", provider_payment_method_id: "tok_extranjera_123", status: "active", last4: "1111" });
    expect(f.tables.trial_charges[0]).toMatchObject({ kind: "prueba", status: "scheduled", plan: "completo", promo: "primer_mes_50", amount_minor: 749, charge_at: plus(CREATED, 7).toISOString() });
    expect(failures(f)).toEqual([]);

    // Ya con sesión: prueba activa.
    clock(plus(CREATED, 2));
    expect(access(f, new Date())).toMatchObject({ access: "trial", app: true, nutrition: true, locked: false, cardStep: "none" });

    // Día 8: el cron cobra con la tarjeta guardada en Tilopay (respuesta servidor a servidor) y manda Subscribe una vez.
    tlp.chargeSavedCard.mockResolvedValue({ state: "approved", auth: "a1", transactionId: "t1", description: null });
    clock(DAY8);
    await tb.sweepTrialCharges(new Date(), { skipReminders: true });
    await tb.sweepTrialCharges(new Date(), { skipReminders: true });
    expect(tlp.chargeSavedCard).toHaveBeenCalledOnce();
    expect((tlp.chargeSavedCard.mock.calls as unknown as [{ amountMinor: number; token: string; email: string }][])[0][0]).toMatchObject({ amountMinor: 749, token: "tok_extranjera_123", email: "ana@prueba.test" });
    expect(f.tables.profiles[0].plan).toBe("completo");
    const sent = subscribes();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ event_name: "Subscribe", custom_data: { value: 7.49, currency: "USD" } });
    expect(String(sent[0].event_id)).toMatch(/^tilopay\.charge\.approved:bbt-/);
  });

  it("vuelta sin sesión con la tarjeta rechazada en Tilopay: no se guarda, queda el motivo y sigue sin prueba", async () => {
    const f = setup(CREATED, "CO");
    clock(plus(CREATED, 0.002));
    const s = signState({ u: USER, p: "tarjeta", plan: "entreno", billing: "mes", n: "n1" });
    state.viewer = null;
    const back = await vueltaRoute.GET(new Request(`${ORIGIN}/api/pagos/tilopay/vuelta?s=${encodeURIComponent(s)}&code=0&crd=tok_rechazada_1&description=Denied`));
    expect(new URL(String(back.headers.get("location"))).searchParams.get("next")).toMatch(/^\/app\/suscripcion\?tilopay=rechazada/);
    expect(f.tables.payment_methods).toEqual([]);
    expect(failures(f)).toHaveLength(1);
    expect(access(f, new Date())).toMatchObject({ locked: true, cardStep: "card" });
  });
});

describe("2b. Vuelta sin sesión con un plan que ya paga", () => {
  it("no reemplaza la tarjeta que cobra: pide entrar y Mi plan para reintentar", async () => {
    const f = setup(CREATED, "CO");
    clock(plus(CREATED, 10));
    f.tables.subscriptions.push({ id: "sub_tlp_1", user_id: USER, provider: "tilopay", provider_subscription_id: "tlp:sub_1", plan: "completo", billing: "mes", status: "active", cancel_at_period_end: false, current_period_start: plus(CREATED, 7).toISOString(), current_period_end: plus(CREATED, 37).toISOString() } as never);
    f.tables.payment_methods.push({ user_id: USER, provider: "tilopay", provider_payment_method_id: "tok_buena", status: "active", last4: "4242" } as never);
    const s = signState({ u: USER, p: "tarjeta", plan: "completo", billing: "mes", n: "n2" });
    state.viewer = null;
    const back = await vueltaRoute.GET(new Request(`${ORIGIN}/api/pagos/tilopay/vuelta?s=${encodeURIComponent(s)}&code=1&crd=tok_ajena&brand=visa&last4=9999`));
    expect(new URL(String(back.headers.get("location"))).searchParams.get("next")).toBe("/app/suscripcion");
    expect(f.tables.payment_methods).toHaveLength(1);
    expect(f.tables.payment_methods[0]).toMatchObject({ provider_payment_method_id: "tok_buena", last4: "4242" });
  });
});

describe("3. Tarjeta rechazada en la bienvenida", () => {
  it("mensaje claro, sigue en el paso de la tarjeta, queda payment_failed y al reintentar con otra empieza la prueba", async () => {
    const f = setup();
    clock(plus(CREATED, 0.001));
    onvo.createCustomer.mockResolvedValue({ id: "cus_cr" });
    await post({ action: "preparar" });

    // El banco no aprueba la tarjeta para pagos recurrentes: ONVO la devuelve inactiva.
    onvo.getPaymentMethod.mockResolvedValue({ ...goodCard("pm_mala", "cus_cr"), status: "inactive" });
    const res = await post({ action: "guardar", paymentMethodId: "pm_mala", plan: "entreno", billing: "mes" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "Tu banco no aprobó la tarjeta para pagos recurrentes. Prueba con otra." });
    expect(failures(f)).toMatchObject([{ user_id: USER, provider: "onvo", payload: { stage: "tarjeta", code: "tarjeta_rechazada" } }]);
    expect(f.tables.payment_methods).toEqual([]);
    expect(f.tables.trial_charges).toEqual([]);
    // Sin prueba: sigue en el paso de la tarjeta (no en el muro de planes).
    expect(access(f, new Date())).toMatchObject({ locked: true, trial: null, cardStep: "card" });

    // Reintenta con otra tarjeta: ahora sí.
    onvo.getPaymentMethod.mockResolvedValue(goodCard("pm_buena", "cus_cr"));
    const again = await post({ action: "guardar", paymentMethodId: "pm_buena", plan: "entreno", billing: "mes" });
    expect(await again.json()).toMatchObject({ ok: true, outcome: "programado" });
    expect(access(f, new Date())).toMatchObject({ access: "trial", locked: false, cardStep: "none" });
  });
});

describe("4. Condominio después del corte", () => {
  it("deja la tarjeta desde el enlace del condominio y el primer cobro es al terminar su mes gratis, a precio normal", async () => {
    const f = setup();
    const join = plus(CREATED, 0.01);
    clock(join);
    onvo.createCustomer.mockResolvedValue({ id: "cus_condo" });
    await post({ action: "preparar" });
    onvo.getPaymentMethod.mockResolvedValue(goodCard("pm_condo", "cus_condo"));
    const res = await post({ action: "guardar", paymentMethodId: "pm_condo", plan: "entreno", billing: "mes", condo: "las-palmas" });
    expect(await res.json()).toMatchObject({ ok: true, outcome: "programado" });
    const freeEnd = plus(join.toISOString(), CONDO_FREE_DAYS).toISOString();
    expect(f.tables.trial_charges[0]).toMatchObject({ status: "scheduled", charge_at: freeEnd, next_attempt_at: freeEnd, promo: null, amount_minor: 999 });
    expect(f.tables.comp_grants[0]).toMatchObject({ user_id: USER, source: "condominio", plan: "completo", expires_at: freeEnd });
    expect(f.tables.condo_members[0]).toMatchObject({ user_id: USER, condo_id: 1 });

    // Día 8: no se cobra nada.
    clock(DAY8);
    await tb.sweepTrialCharges(new Date(), { skipReminders: true });
    expect(onvo.createChargedSubscription).not.toHaveBeenCalled();
    expect(onvo.createPaymentIntent).not.toHaveBeenCalled();
    expect(f.tables.trial_charges[0]).toMatchObject({ status: "scheduled", attempts: 0 });

    // Al terminar su mes gratis: el primer cobro, a precio normal, con una suscripción de ONVO.
    onvo.createChargedSubscription.mockResolvedValue({ id: "sub_condo", status: "active" });
    clock(plus(freeEnd, 0.01));
    await tb.sweepTrialCharges(new Date(), { skipReminders: true });
    expect(onvo.createChargedSubscription).toHaveBeenCalledOnce();
    expect((onvo.createChargedSubscription.mock.calls as unknown[][])[0][0]).toMatchObject({ customerId: "cus_condo", paymentMethodId: "pm_condo", plan: "entreno", billing: "mes" });
    expect(onvo.createPaymentIntent).not.toHaveBeenCalled();
  });
});

describe("5. Cuenta del 30 de noviembre a las 23:59", () => {
  it("sigue con las reglas de antes: 7 días gratis sin tarjeta y la tarjeta es opcional", async () => {
    const f = setup(BEFORE);
    clock(plus(BEFORE, 0.01));
    expect(access(f, new Date(), BEFORE)).toMatchObject({ access: "trial", app: true, nutrition: true, locked: false, cardStep: "trial" });
    expect(access(f, new Date(), BEFORE).trial?.daysLeft).toBe(7);
    const html = renderToStaticMarkup(createElement(Wizard, { name: "Ana", demo: true, initialGoal: null, glp1: false, country: "CR", intent: null, trialEndsAt: plus(BEFORE, 7).toISOString(), chargeAt: plus(BEFORE, 7).toISOString(), cardOffer: true, startOnCard: true }));
    expect(html).toContain("Empezar gratis sin tarjeta");
    // Al sexto día sigue dentro de su prueba sin haber dejado tarjeta.
    expect(access(f, plus(BEFORE, 6.9), BEFORE)).toMatchObject({ access: "trial", locked: false });
  });
});
