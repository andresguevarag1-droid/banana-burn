// #328: cobro rechazado con 3 intentos (día del cobro, día +1 y día +3 a las 00:20 de Costa Rica), gracia hasta el segundo
// rechazo, un aviso distinto por intento, cambiar la tarjeta cobra en el momento y nunca se cobra dos veces (charge-keys).
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { fakeDb } from "./fake-db";
import { AUTO_ATTEMPTS, GRACE_DAYS, afterDecline, amountMinorFor, declinePush, declineStep, idemKeyFor, inGrace, type TrialChargeRow } from "./trial";
import { entitlementsFrom } from "./entitlements";
import * as T from "./email/templates";
import { firstChargeFailures } from "./admin";

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

const { OnvoError } = await import("./onvo");
const tb = await import("./trial-billing");
const { accept: acepta } = await import("@/lib/consent-fixture");

const USER = "33333333-3333-4333-8333-333333333333";
// Cuenta del lunes 23 de noviembre: su cobro del día 8 corre el lunes 30 a las 00:20 de Costa Rica (06:20 UTC).
const CREATED = "2026-11-23T15:00:00.000Z";
const TRIAL_END = "2026-11-30T15:00:00.000Z";
const CRON_30 = new Date("2026-11-30T06:20:00.000Z");
const CRON_1 = new Date("2026-12-01T06:20:00.000Z");
const CRON_3 = new Date("2026-12-03T06:20:00.000Z");
const KEY_UNIQUE = { cols: ["user_id", "periodo", "procesador"], where: (r: Record<string, unknown>) => r.estado === "reservado" };
const CARD = { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2030, status: "active" as const };

function setup() {
  const f = fakeDb({
    profiles: [{ id: USER, created_at: CREATED, plan: "free" }], billing_customers: [{ user_id: USER, provider_customer_id: "cus_1" }],
    subscriptions: [], trial_charges: [], payment_methods: [{ user_id: USER, provider_customer_id: "cus_1", provider_payment_method_id: "pm_1", ...CARD }],
    payment_events: [], charge_keys: [], notification_prefs: [], push_subscriptions: [], comp_grants: [], tester_grants: [],
  }, { trial_charges: ["user_id", "idem_key"], payment_methods: ["provider_payment_method_id"], charge_keys: [KEY_UNIQUE] });
  state.db = f.db;
  return f;
}
function scheduled(f: ReturnType<typeof setup>, over: Partial<TrialChargeRow> = {}) {
  // El cobro vence el 30 y lo toma el cron de las 00:20. Sin el 50 % (ese va por PaymentIntent, onvoIntroCharge): mismo calendario.
  const r = { id: 1, user_id: USER, idem_key: idemKeyFor(USER), kind: "prueba", plan: "entreno", billing: "mes", amount_minor: amountMinorFor("entreno", "mes"), promo: null, trial_started_at: CREATED, trial_ends_at: TRIAL_END, charge_at: "2026-11-30T06:00:00.000Z", next_attempt_at: "2026-11-30T06:00:00.000Z", status: "scheduled", attempts: 0, last_attempt_at: null, provider_subscription_id: null, last_error: null, reminder_sent_at: "2026-11-28T06:00:00.000Z", failure_notified_attempt: null, canceled_at: null, created_at: CREATED, updated_at: CREATED, ...over };
  f.tables.trial_charges.push(r);
  return r as TrialChargeRow;
}
const charge = (f: ReturnType<typeof setup>) => f.tables.trial_charges[0] as unknown as TrialChargeRow;
const access = (row: TrialChargeRow, now: Date) => entitlementsFrom({ profilePlan: "free", role: "free", createdAt: CREATED, subs: [], now, trialCharge: row, card: CARD });
const failedCalls = () => (mail.sendPaymentFailed.mock.calls as unknown as [Record<string, unknown>][]).map((c) => c[0]);

beforeEach(() => {
  for (const m of [...Object.values(onvo), ...Object.values(mail)]) m.mockReset();
  for (const m of Object.values(mail)) m.mockResolvedValue({ ok: true } as never);
  onvo.cancelSubscription.mockResolvedValue(null);
  onvo.detachPaymentMethod.mockResolvedValue(null);
});

describe("calendario de reintentos (puro)", () => {
  it("rechazo del lunes 30 a las 00:20: reintentos el martes 1 y el jueves 3 de diciembre, desde la medianoche de Costa Rica", () => {
    expect(afterDecline({ attempts: 1 }, CRON_30)).toEqual({ status: "retry_scheduled", nextAttemptAt: "2026-12-01T06:00:00.000Z" });
    expect(afterDecline({ attempts: 2 }, CRON_1)).toEqual({ status: "retry_scheduled", nextAttemptAt: "2026-12-03T06:00:00.000Z" });
    expect(afterDecline({ attempts: AUTO_ATTEMPTS }, CRON_3)).toEqual({ status: "failed", nextAttemptAt: null });
  });
  it("un rechazo a las 23:59 de Costa Rica cuenta para ese día, no para el siguiente", () => {
    expect(afterDecline({ attempts: 1 }, new Date("2026-12-01T05:59:00.000Z"))).toEqual({ status: "retry_scheduled", nextAttemptAt: "2026-12-01T06:00:00.000Z" });
  });
  it("el aviso de cada intento: primero, otra vez y en pausa", () => {
    expect(declineStep({ status: "retry_scheduled", attempts: 1 })).toBe(1);
    expect(declineStep({ status: "retry_scheduled", attempts: 2 })).toBe(2);
    expect(declineStep({ status: "failed", attempts: 3 })).toBe(3);
    expect(declinePush(1, "1 de diciembre", false)).toEqual({ title: "No pudimos cobrar tu plan", body: "Lo intentaremos de nuevo el 1 de diciembre. Actualiza tu tarjeta para no perder tu acceso." });
    expect(declinePush(2, "3 de diciembre", true).title).toBe("Tu tarjeta no pasó otra vez");
    expect(declinePush(2, "3 de diciembre", true).body).toContain("autoriza Banana Burn");
    expect(declinePush(3, null, true).title).toBe("Tu plan quedó en pausa");
  });
});

describe("gracia: el acceso se pausa recién con el segundo rechazo", () => {
  const base = { kind: "prueba" as const, failure_notified_attempt: 1, last_attempt_at: CRON_30.toISOString() };
  it("después del primer rechazo y mientras se confirma el segundo intento", () => {
    expect(inGrace({ ...base, status: "retry_scheduled", attempts: 1 }, new Date("2026-11-30T20:00:00.000Z"))).toBe(true);
    expect(inGrace({ ...base, status: "pending", attempts: 2, last_attempt_at: CRON_1.toISOString() }, CRON_1)).toBe(true);
  });
  it("no después del segundo rechazo, ni pasado el tope, ni para un cobro inmediato (cuenta ya bloqueada)", () => {
    expect(inGrace({ ...base, status: "retry_scheduled", attempts: 2, failure_notified_attempt: 2 }, CRON_1)).toBe(false);
    expect(inGrace({ ...base, status: "failed", attempts: 3, failure_notified_attempt: 3 }, CRON_3)).toBe(false);
    expect(inGrace({ ...base, status: "retry_scheduled", attempts: 1 }, new Date(CRON_30.getTime() + GRACE_DAYS * 864e5))).toBe(false);
    expect(inGrace({ ...base, kind: "inmediato", status: "retry_scheduled", attempts: 1 }, CRON_30)).toBe(false);
  });
});

describe("del cobro del lunes 30 al tercer intento, con el cron de las 00:20", () => {
  it("3 intentos, un aviso distinto por intento, gracia hasta el segundo rechazo y la llave de cobro liberada en cada rechazo", async () => {
    const f = setup(); scheduled(f);
    onvo.createChargedSubscription.mockRejectedValue(new OnvoError("Fondos insuficientes", 402));

    await tb.sweepTrialCharges(CRON_30);
    expect(charge(f)).toMatchObject({ status: "retry_scheduled", attempts: 1, next_attempt_at: "2026-12-01T06:00:00.000Z" });
    expect(failedCalls()[0]).toMatchObject({ attempt: 1, paused: false, retryDate: "2026-12-01T06:00:00.000Z", updateUrl: "/app/suscripcion#tarjeta" });
    // Su prueba terminó el 30 a las 09:00, pero sigue con todo hasta el segundo intento.
    expect(access(charge(f), new Date("2026-11-30T20:00:00.000Z"))).toMatchObject({ app: true, locked: false, cardStep: "pay", charge: { phase: "reintento" } });

    await tb.sweepTrialCharges(CRON_1);
    expect(charge(f)).toMatchObject({ status: "retry_scheduled", attempts: 2, next_attempt_at: "2026-12-03T06:00:00.000Z" });
    expect(failedCalls()[1]).toMatchObject({ attempt: 2, paused: true, retryDate: "2026-12-03T06:00:00.000Z" });
    expect(access(charge(f), new Date("2026-12-01T12:00:00.000Z"))).toMatchObject({ app: false, locked: true });

    // El miércoles 2 no se intenta nada.
    await tb.sweepTrialCharges(new Date("2026-12-02T06:20:00.000Z"));
    expect(onvo.createChargedSubscription).toHaveBeenCalledTimes(2);

    await tb.sweepTrialCharges(CRON_3);
    expect(charge(f)).toMatchObject({ status: "failed", attempts: 3, next_attempt_at: null });
    expect(failedCalls()[2]).toMatchObject({ attempt: 3, paused: true, retryDate: null });

    await tb.sweepTrialCharges(new Date("2026-12-04T06:20:00.000Z"));
    expect(onvo.createChargedSubscription).toHaveBeenCalledTimes(3);
    expect(mail.sendPaymentFailed).toHaveBeenCalledTimes(3);
    // Cada intento con su propia llave de ONVO (metadata attempt) y la llave de cobro liberada al saber que no se cobró.
    expect(onvo.createChargedSubscription.mock.calls.map((c) => c[0].attempt)).toEqual([1, 2, 3]);
    expect(f.tables.charge_keys.filter((k) => k.estado === "reservado")).toHaveLength(0);
  });

  it("dos corridas del cron a la vez el día +1: un solo cobro y un solo aviso", async () => {
    const f = setup(); scheduled(f, { status: "retry_scheduled", attempts: 1, failure_notified_attempt: 1, last_attempt_at: CRON_30.toISOString(), next_attempt_at: "2026-12-01T06:00:00.000Z" });
    onvo.createChargedSubscription.mockRejectedValue(new OnvoError("Fondos insuficientes", 402));
    await Promise.all([tb.sweepTrialCharges(CRON_1), tb.sweepTrialCharges(CRON_1)]);
    expect(onvo.createChargedSubscription).toHaveBeenCalledOnce();
    expect(mail.sendPaymentFailed).toHaveBeenCalledOnce();
  });

  it("si la llave del primer cobro sigue reservada (otro cobro en vuelo), el reintento no llama a ONVO", async () => {
    const f = setup(); scheduled(f, { status: "retry_scheduled", attempts: 1, failure_notified_attempt: 1, last_attempt_at: CRON_30.toISOString(), next_attempt_at: "2026-12-01T06:00:00.000Z" });
    f.tables.charge_keys.push({ id: 9, user_id: USER, periodo: "primer_cobro", procesador: "onvo", origen: "primer_cobro", referencia: "otro", estado: "reservado" });
    expect(await tb.attemptCharge(f.db, charge(f), CRON_1)).toBe("aplazado");
    expect(onvo.createChargedSubscription).not.toHaveBeenCalled();
    expect(charge(f)).toMatchObject({ status: "retry_scheduled", attempts: 1 });
  });
});

describe("cambiar la tarjeta desde el banner", () => {
  const viewer = { demo: false, id: USER, email: "ana@prueba.test", name: "Ana", role: "free" as const, plan: "free", onboarded: true, tz: "America/Costa_Rica", country: "CR" };
  it("durante la gracia cobra en el momento con la tarjeta nueva, sin esperar al cron", async () => {
    const f = setup(); scheduled(f, { status: "retry_scheduled", attempts: 1, failure_notified_attempt: 1, last_attempt_at: CRON_30.toISOString(), next_attempt_at: "2026-12-01T06:00:00.000Z" });
    onvo.getPaymentMethod.mockResolvedValue({ id: "pm_2", customerId: "cus_1", status: "active", type: "card", card: { brand: "mastercard", last4: "5555", expMonth: 1, expYear: 2031 } });
    onvo.createChargedSubscription.mockResolvedValue({ id: "sub_nueva", status: "pending" });
    const now = new Date("2026-11-30T18:00:00.000Z");
    const r = await tb.saveCard(viewer, { paymentMethodId: "pm_2", plan: "entreno", billing: "mes", consent: acepta("entreno", "mes", false) }, now);
    expect(r.outcome).toBe("enviado");
    expect(onvo.createChargedSubscription).toHaveBeenCalledOnce();
    expect(onvo.createChargedSubscription.mock.calls[0][0]).toMatchObject({ paymentMethodId: "pm_2", attempt: 2 });
    // Mientras ONVO confirma, sigue con acceso; el webhook lo activa (trialOnActivated).
    expect(charge(f)).toMatchObject({ status: "pending", attempts: 2, provider_subscription_id: "sub_nueva" });
    expect(access(charge(f), now)).toMatchObject({ app: true, locked: false });
    // El cron del día +1 ya no vuelve a cobrar.
    await tb.sweepTrialCharges(CRON_1);
    expect(onvo.createChargedSubscription).toHaveBeenCalledOnce();
  });

  it("después del tercer rechazo también cobra en el momento (reactiva sin esperar)", async () => {
    const f = setup(); scheduled(f, { status: "failed", attempts: 3, failure_notified_attempt: 3, last_attempt_at: CRON_3.toISOString(), next_attempt_at: null });
    onvo.getPaymentMethod.mockResolvedValue({ id: "pm_3", customerId: "cus_1", status: "active", type: "card", card: { brand: "visa", last4: "1111", expMonth: 1, expYear: 2031 } });
    onvo.createChargedSubscription.mockResolvedValue({ id: "sub_3", status: "pending" });
    const r = await tb.saveCard(viewer, { paymentMethodId: "pm_3", plan: "entreno", billing: "mes", consent: acepta("entreno", "mes", false) }, new Date("2026-12-04T15:00:00.000Z"));
    expect(r.outcome).toBe("enviado");
    expect(onvo.createChargedSubscription.mock.calls[0][0]).toMatchObject({ paymentMethodId: "pm_3", attempt: 4 });
  });
});

describe("correos por intento", () => {
  const d = { name: "Ana Pérez", plan: "Entreno", amount: 4.99, currency: "USD", updateUrl: "/app/suscripcion#tarjeta" };
  it("primer rechazo con gracia: el correo actual, sin pausa", () => {
    const m = T.pagoFallido({ ...d, retryDate: "2026-12-01T06:00:00.000Z", paused: false });
    expect(m.text).toContain("Mientras tanto mantienes tu acceso.");
    expect(m.text).toContain("Lo volveremos a intentar el");
  });
  it("segundo: \"Tu tarjeta no pasó otra vez\" con los motivos y llamar al banco", () => {
    const m = T.pagoFallidoOtraVez({ ...d, retryDate: "2026-12-03T06:00:00.000Z" });
    expect(m.subject).toBe("Tu tarjeta no pasó otra vez");
    for (const r of T.DECLINE_REASONS) expect(m.text).toContain(r);
    expect(m.text).toMatch(/fondos/i);
    expect(m.text).toMatch(/en línea o internacionales/);
    expect(m.text).toContain("Llama a tu banco y autoriza Banana Burn");
    expect(m.text).toContain("una última vez el 3 de diciembre");
    expect(m.html).toContain("/app/suscripcion#tarjeta");
  });
  it("tercero: \"Tu plan quedó en pausa\" con el botón para cambiar la tarjeta", () => {
    const m = T.planEnPausa(d);
    expect(m.subject).toBe("Tu plan quedó en pausa");
    expect(m.html).toContain("Cambiar mi tarjeta");
    expect(m.html).toContain("/app/suscripcion#tarjeta");
    expect(m.text).toContain("No haremos más intentos automáticos.");
  });
});

describe("/admin/pagos: intento y próxima fecha de cada primer cobro rechazado", () => {
  it("muestra el intento y la próxima fecha; sin próxima fecha si ya no hay intentos", () => {
    const rows = firstChargeFailures([
      { id: 1, user_id: USER, plan: "entreno", billing: "mes", amount_minor: 499, status: "retry_scheduled", attempts: 2, next_attempt_at: "2026-12-03T06:00:00.000Z", last_attempt_at: CRON_1.toISOString(), last_error: "Fondos insuficientes" },
      { id: 2, user_id: "u2", plan: "completo", billing: "anual", amount_minor: 8999, status: "failed", attempts: 3, next_attempt_at: null, last_attempt_at: CRON_3.toISOString(), last_error: "ONVO: canceled" },
      { id: 3, user_id: "u3", plan: "entreno", billing: "mes", amount_minor: 499, status: "retry_scheduled", attempts: 0, next_attempt_at: null, last_attempt_at: null, last_error: null },
    ], new Map([[USER, "Ana"]]));
    expect(rows.map((r) => [r.id, r.attempt, r.nextAt])).toEqual([[2, 3, null], [1, 2, "2026-12-03T06:00:00.000Z"]]);
    expect(rows[1]).toMatchObject({ name: "Ana", amount: 4.99, planLabel: "Entreno (mensual)" });
  });
});

describe("la base (0074) da la misma gracia que la app", () => {
  const pg = new PGlite({ extensions: { pgcrypto } });
  const U1 = "44444444-4444-4444-8444-444444444441", U2 = "44444444-4444-4444-8444-444444444442", U3 = "44444444-4444-4444-8444-444444444443", U4 = "44444444-4444-4444-8444-444444444444";
  beforeAll(async () => {
    await pg.exec(readFileSync("supabase/tests/stub.sql", "utf8"));
    for (const file of readdirSync("supabase/migrations").filter((x) => x.endsWith(".sql")).sort()) await pg.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
    await pg.exec("set session_replication_role = replica");
    const row = (u: string, kind: string, status: string, attempts: number, notified: number | null, ago: string) => `
      insert into auth.users (id) values ('${u}');
      insert into public.profiles (id, created_at) values ('${u}', now() - interval '9 days');
      insert into public.trial_charges (user_id, idem_key, kind, plan, billing, amount_minor, trial_started_at, trial_ends_at, charge_at, next_attempt_at, status, attempts, failure_notified_attempt, last_attempt_at)
        values ('${u}', 'trial:${u}', '${kind}', 'entreno', 'mes', 499, now() - interval '9 days', now() - interval '2 days', now() - interval '2 days', now() + interval '1 day', '${status}', ${attempts}, ${notified ?? "null"}, now() - interval '${ago}');`;
    await pg.exec([
      row(U1, "prueba", "retry_scheduled", 1, 1, "10 hours"), // primer rechazo: gracia
      row(U2, "prueba", "retry_scheduled", 2, 2, "10 hours"), // segundo rechazo: en pausa
      row(U3, "prueba", "retry_scheduled", 1, 1, "4 days"), // pasó el tope
      row(U4, "inmediato", "retry_scheduled", 1, 1, "10 hours"), // cuenta ya bloqueada
    ].join("\n"));
    await pg.exec("set session_replication_role = origin");
  }, 120000);
  afterAll(async () => { await pg.close(); });

  it("_trial_live: solo el primer rechazo de la prueba, dentro del tope", async () => {
    const live = async (u: string) => (await pg.query<{ v: boolean }>(`select public._trial_live('${u}') as v`)).rows[0].v;
    expect(await live(U1)).toBe(true);
    expect(await live(U2)).toBe(false);
    expect(await live(U3)).toBe(false);
    expect(await live(U4)).toBe(false);
  });
});
