// #68 (QA): Subscribe por la API de Conversiones en los cobros automáticos de Tilopay: el cobro del día 7 y las renovaciones.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fakeDb } from "./fake-db";
import { DAY_MS, idemKeyFor, scheduleFor, type TrialChargeRow } from "./trial";

vi.mock("server-only", () => ({}));
const state: { db: SupabaseClient | null } = { db: null };
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => state.db }));
const tilo = vi.hoisted(() => ({ chargeSavedCard: vi.fn(), consultOrder: vi.fn(), createTokenizeUrl: vi.fn(), createPaymentUrl: vi.fn(), removeCardToken: vi.fn() }));
vi.mock("@/lib/tilopay", async (orig) => {
  const real = await orig<typeof import("./tilopay")>();
  return { ...real, ...tilo, isTilopayConfigured: () => true };
});
vi.mock("@/lib/email", () => ({
  notifyInApp: vi.fn(async () => true), sendChargeCanceled: vi.fn(async () => ({ ok: true })), sendChargeReminder: vi.fn(async () => ({ ok: true })),
  sendPaymentFailed: vi.fn(async () => ({ ok: true })), sendTrialStarted: vi.fn(async () => ({ ok: true })), sendPaymentReceipt: vi.fn(async () => ({ ok: true })),
  sendSubscriptionCanceled: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/push", () => ({ pushToUser: vi.fn(async () => 1), sendPush: vi.fn(async () => 1) }));
vi.mock("@/lib/monitor/server", () => ({ recordServerError: vi.fn() }));

const tb = await import("./trial-billing");
const tlb = await import("./tilopay-billing");

const USER = "22222222-2222-4222-8222-222222222222";
const EMAIL = "beto@prueba.test";
const T0 = new Date("2026-11-10T15:00:00.000Z");
const D7 = new Date(T0.getTime() + 7 * DAY_MS);
const AT = new Date("2026-11-08T06:30:00.000Z");
const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
const KEY_UNIQUE = { cols: ["user_id", "periodo", "procesador"], where: (r: Record<string, unknown>) => r.estado === "reservado" };
const card = { user_id: USER, provider: "tilopay", provider_customer_id: "tlp-cus", provider_payment_method_id: "tok_1", brand: "visa", last4: "4242", exp_month: 12, exp_year: 2030, status: "active" };
const renewalSub = { id: 50, user_id: USER, provider: "tilopay", provider_customer_id: "tlp-cus", provider_subscription_id: "tlp:bbc-1", status: "active", plan: "entreno", billing: "mes", current_period_start: "2026-10-08T00:00:00.000Z", current_period_end: "2026-11-08T00:00:00.000Z", cancel_at_period_end: false, renewal_attempts: 0, next_renewal_attempt_at: null, last_renewal_error: null };

function setup(extra: Record<string, Record<string, unknown>[]> = {}) {
  const f = fakeDb({
    profiles: [{ id: USER, created_at: "2026-11-09T12:00:00.000Z", plan: "free", email: EMAIL }], users: [{ id: USER, email: EMAIL }],
    billing_customers: [], subscriptions: [], trial_charges: [], payment_methods: [{ ...card }], payment_events: [], charge_keys: [],
    comp_grants: [], tester_grants: [], notification_prefs: [], push_subscriptions: [], ...extra,
  }, { trial_charges: ["user_id", "idem_key"], payment_methods: ["provider_payment_method_id"], payment_events: ["event_key"], charge_keys: [KEY_UNIQUE] });
  state.db = f.db;
  return f;
}

function scheduled(f: ReturnType<typeof setup>) {
  const s = scheduleFor("prueba", T0, "2026-11-01T06:00:00.000Z");
  const r = { id: 1, user_id: USER, idem_key: idemKeyFor(USER), kind: "prueba", plan: "completo", billing: "mes", amount_minor: 749, promo: "primer_mes_50", trial_started_at: s.trialStartedAt, trial_ends_at: s.trialEndsAt, charge_at: s.chargeAt, next_attempt_at: s.chargeAt, status: "scheduled", attempts: 0, last_attempt_at: null, provider_subscription_id: null, last_error: null, reminder_sent_at: null, failure_notified_attempt: null, canceled_at: null, created_at: s.trialStartedAt, updated_at: s.trialStartedAt };
  f.tables.trial_charges.push(r);
  return r as unknown as TrialChargeRow;
}

/** Eventos que llegaron a Meta (solo las llamadas a graph.facebook.com). */
const sent = () => (fetchMock.mock.calls as unknown as [string, RequestInit][])
  .filter(([url]) => String(url).includes("graph.facebook.com")).map(([, init]) => JSON.parse(String(init.body)).data[0]);

beforeEach(() => {
  for (const m of Object.values(tilo)) m.mockReset();
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("META_CAPI_TOKEN", "token-de-prueba");
  vi.stubEnv("META_CAPI_TEST_CODE", "");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Subscribe del cobro automático de Tilopay", () => {
  it("cobro del día 7 aprobado: 1 evento con el 50 % cobrado, event_id de la orden y solo el id con hash", async () => {
    const f = setup(); const r = scheduled(f);
    tilo.chargeSavedCard.mockResolvedValue({ state: "approved", auth: "a1", transactionId: "t1", description: null });
    expect(await tb.attemptCharge(f.db, r, D7)).toBe("enviado");
    expect(f.tables.profiles[0].plan).toBe("completo");
    const out = sent();
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ event_name: "Subscribe", action_source: "system_generated", custom_data: { value: 7.49, currency: "USD" } });
    expect(out[0].event_id).toBe(`tilopay.charge.approved:${tilo.chargeSavedCard.mock.calls[0][0].orderNumber}`);
    expect(Object.keys(out[0].user_data)).toEqual(["external_id"]);
    const raw = JSON.stringify(out);
    expect(raw).not.toContain(USER);
    expect(raw).not.toContain(EMAIL);
  });

  it("cobro del día 7 rechazado: no manda nada", async () => {
    const f = setup(); const r = scheduled(f);
    tilo.chargeSavedCard.mockResolvedValue({ state: "declined", description: "Fondos insuficientes" });
    expect(await tb.attemptCharge(f.db, r, D7)).toBe("rechazado");
    expect(sent()).toEqual([]);
  });

  it("renovación aprobada: 1 evento por cobro con el precio completo; el mes siguiente es otro evento", async () => {
    const f = setup({ subscriptions: [{ ...renewalSub }], profiles: [{ id: USER, plan: "entreno" }] });
    tilo.chargeSavedCard.mockResolvedValue({ state: "approved", auth: "a1", transactionId: "t1", description: null });
    await tlb.sweepTilopayRenewals(AT);
    await tlb.sweepTilopayRenewals(new Date(AT.getTime() + 0.5 * DAY_MS));
    expect(tilo.chargeSavedCard).toHaveBeenCalledOnce();
    expect(sent()).toMatchObject([{ event_name: "Subscribe", custom_data: { value: 9.99, currency: "USD" } }]);
    await tlb.sweepTilopayRenewals(new Date(Date.parse(String(f.tables.subscriptions[0].current_period_end)) + 3600_000));
    expect(tilo.chargeSavedCard).toHaveBeenCalledTimes(2);
    const ids = sent().map((e) => e.event_id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it("renovación rechazada: no manda nada", async () => {
    setup({ subscriptions: [{ ...renewalSub }], profiles: [{ id: USER, plan: "entreno" }] });
    tilo.chargeSavedCard.mockResolvedValue({ state: "declined", description: "Fondos insuficientes" });
    await tlb.sweepTilopayRenewals(AT);
    expect(tilo.chargeSavedCard).toHaveBeenCalledOnce();
    expect(sent()).toEqual([]);
  });

  it("renovación sin respuesta que la consulta confirma: 1 solo evento aunque se consulte otra vez", async () => {
    const f = setup({ subscriptions: [{ ...renewalSub }], profiles: [{ id: USER, plan: "entreno" }] });
    tilo.chargeSavedCard.mockResolvedValue({ state: "unknown", error: "timeout" });
    await tlb.sweepTilopayRenewals(AT);
    expect(sent()).toEqual([]);
    tilo.consultOrder.mockResolvedValue({ state: "approved", auth: "a1", transactionId: "t1", description: null });
    await tlb.sweepTilopayRenewals(new Date(AT.getTime() + 0.1 * DAY_MS));
    await tlb.sweepTilopayRenewals(new Date(AT.getTime() + 0.2 * DAY_MS));
    expect(tilo.chargeSavedCard).toHaveBeenCalledOnce();
    expect(sent()).toHaveLength(1);
    expect(f.tables.payment_events.filter((e) => e.status === "processed")).toHaveLength(1);
  });

  it("sin META_CAPI_TOKEN: renueva igual y no manda nada", async () => {
    vi.stubEnv("META_CAPI_TOKEN", "");
    const f = setup({ subscriptions: [{ ...renewalSub }], profiles: [{ id: USER, plan: "entreno" }] });
    tilo.chargeSavedCard.mockResolvedValue({ state: "approved", auth: "a1", transactionId: "t1", description: null });
    await tlb.sweepTilopayRenewals(AT);
    expect(f.tables.subscriptions[0].current_period_end).not.toBe(renewalSub.current_period_end);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
