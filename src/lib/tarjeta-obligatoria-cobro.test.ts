// #269 de punta a punta: una cuenta creada el 1 de diciembre de 2026 a las 00:00 de Costa Rica deja su tarjeta en el registro,
// tiene 7 días gratis con todo incluido y el día 8 se cobra su primer mes con el 50 % (PaymentIntent de ONVO por $4.99).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fakeDb } from "./fake-db";
import { DAY_MS, type CardRow, type TrialChargeRow } from "./trial";

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
const mail = vi.hoisted(() => ({
  notifyInApp: vi.fn(async () => true), sendChargeCanceled: vi.fn(async () => ({ ok: true })), sendChargeReminder: vi.fn(async () => ({ ok: true })),
  sendPaymentFailed: vi.fn(async () => ({ ok: true })), sendTrialStarted: vi.fn(async () => ({ ok: true })), sendPaymentReceipt: vi.fn(async () => ({ ok: true })),
  sendSubscriptionCanceled: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/email", () => mail);
vi.mock("@/lib/push", () => ({ sendPush: vi.fn(async () => 1) }));

const tb = await import("./trial-billing");
const { entitlementsFrom } = await import("./entitlements");
const { CARD_REQUIRED_FROM } = await import("./card-required");

const USER = "33333333-3333-4333-8333-333333333333";
const CREATED = CARD_REQUIRED_FROM; // 1 de diciembre de 2026, 00:00 en Costa Rica
const plus = (iso: string, days: number) => new Date(Date.parse(iso) + days * DAY_MS);
const viewer = { demo: false, id: USER, email: "ana@prueba.test", name: "Ana", role: "free" as const, plan: "free", onboarded: true, tz: "America/Costa_Rica", country: "CR" };

function setup() {
  const f = fakeDb({
    profiles: [{ id: USER, created_at: CREATED, plan: "free" }],
    billing_customers: [{ user_id: USER, provider_customer_id: "cus_new" }],
    subscriptions: [], trial_charges: [], payment_methods: [], payment_events: [], notification_prefs: [], push_subscriptions: [],
  }, { trial_charges: ["user_id", "idem_key"], payment_methods: ["provider_payment_method_id"], payment_events: ["event_key"] });
  state.db = f.db;
  return f;
}
const access = (f: ReturnType<typeof setup>, now: Date) => entitlementsFrom({
  profilePlan: "free", role: "free", createdAt: CREATED, subs: [], now,
  trialCharge: (f.tables.trial_charges[0] as unknown as TrialChargeRow | undefined) ?? null,
  card: (f.tables.payment_methods[0] as unknown as CardRow | undefined) ?? null,
});

beforeEach(() => {
  for (const m of [...Object.values(onvo), ...Object.values(mail)]) m.mockReset();
  for (const m of Object.values(mail)) m.mockResolvedValue({ ok: true } as never);
  mail.notifyInApp.mockResolvedValue(true as never);
  onvo.cancelSubscription.mockResolvedValue(null);
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("tarjeta obligatoria: registro, 7 días gratis y cobro del día 8 con el 50 %", () => {
  it("sin tarjeta no hay prueba; con ella, 7 días con todo y el día 8 se cobran $4.99 una sola vez", async () => {
    const f = setup();
    const signup = plus(CREATED, 0.01);
    // Recién registrada y sin tarjeta: bloqueada, con el paso de la tarjeta (no el muro de planes).
    expect(access(f, signup)).toMatchObject({ locked: true, cardStep: "card", trial: null });

    // Deja su tarjeta en la bienvenida con Entreno mensual: hoy no se cobra nada.
    onvo.getPaymentMethod.mockResolvedValue({ id: "pm_1", customerId: "cus_new", status: "active", type: "card", card: { brand: "visa", last4: "4242", expMonth: 12, expYear: 2030 } });
    const saved = await tb.saveCard(viewer, { paymentMethodId: "pm_1", plan: "entreno", billing: "mes" }, signup);
    expect(saved.outcome).toBe("programado");
    expect(onvo.createPaymentIntent).not.toHaveBeenCalled();
    expect(onvo.createChargedSubscription).not.toHaveBeenCalled();
    expect(f.tables.trial_charges[0]).toMatchObject({ kind: "prueba", status: "scheduled", promo: "primer_mes_50", amount_minor: 499, trial_started_at: CREATED, charge_at: "2026-12-08T06:00:00.000Z" });
    expect((mail.sendTrialStarted.mock.calls as unknown[][])[0][0]).toMatchObject({ amount: 4.99, promo: true, chargeAt: "2026-12-08T06:00:00.000Z" });

    // Su prueba: 7 días con todo incluido.
    expect(access(f, plus(CREATED, 1))).toMatchObject({ access: "trial", app: true, nutrition: true, locked: false, cardStep: "none" });
    expect(access(f, plus(CREATED, 1)).trial?.daysLeft).toBe(6);

    // Día 7 (antes del cobro): todavía nada.
    expect(await tb.attemptCharge(f.db, f.tables.trial_charges[0] as unknown as TrialChargeRow, plus(CREATED, 6.99))).toBe("omitido");
    expect(onvo.createPaymentIntent).not.toHaveBeenCalled();

    // Día 8: el cron cobra el primer mes con el 50 %, una sola vez aunque corra dos veces.
    onvo.createPaymentIntent.mockResolvedValue({ id: "pi_8" });
    onvo.confirmPaymentIntent.mockResolvedValue({ id: "pi_8", status: "succeeded" });
    onvo.getPaymentIntent.mockResolvedValue({ id: "pi_8", status: "succeeded", amount: 499, currency: "USD" });
    const day8 = new Date("2026-12-08T06:05:00.000Z");
    await tb.sweepTrialCharges(day8, { skipReminders: true });
    await tb.sweepTrialCharges(day8, { skipReminders: true });
    expect(onvo.createPaymentIntent).toHaveBeenCalledOnce();
    expect((onvo.createPaymentIntent.mock.calls as unknown[][])[0][0]).toMatchObject({ amountMinor: 499, customerId: "cus_new", metadata: { promo: "primer_mes_50" } });
    expect(onvo.confirmPaymentIntent).toHaveBeenCalledWith("pi_8", "pm_1");
    expect(f.tables.trial_charges[0]).toMatchObject({ attempts: 1, provider_subscription_id: "onvo-pi:pi_8" });
    expect(["pending", "succeeded"]).toContain((f.tables.trial_charges[0] as { status: string }).status);
  });

  it("cancelar antes del día 8 no cobra y deja el acceso hasta el fin de la prueba", async () => {
    const f = setup();
    onvo.getPaymentMethod.mockResolvedValue({ id: "pm_1", customerId: "cus_new", status: "active", type: "card", card: { brand: "visa", last4: "4242", expMonth: 12, expYear: 2030 } });
    onvo.detachPaymentMethod.mockResolvedValue(null);
    await tb.saveCard(viewer, { paymentMethodId: "pm_1", plan: "completo", billing: "mes" }, plus(CREATED, 0.01));
    expect(f.tables.trial_charges[0]).toMatchObject({ amount_minor: 749 });
    const r = await tb.cancelTrial(viewer, false, plus(CREATED, 2));
    expect(r.accessUntil).toBe("2026-12-08T06:00:00.000Z");
    expect(access(f, plus(CREATED, 3))).toMatchObject({ access: "trial", locked: false });
    await tb.sweepTrialCharges(new Date("2026-12-08T06:05:00.000Z"), { skipReminders: true });
    expect(onvo.createPaymentIntent).not.toHaveBeenCalled();
    expect(access(f, plus(CREATED, 7.1))).toMatchObject({ locked: true, cardStep: "pay" });
  });
});
