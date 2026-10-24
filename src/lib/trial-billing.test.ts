import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fakeDb } from "./fake-db";
import { DAY_MS, idemKeyFor, scheduleFor, type TrialChargeRow } from "./trial";

// ── Dobles: base en memoria, ONVO, correo y push. ──
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

const BETA = "2026-11-01T06:00:00.000Z";
const NEW_USER = "11111111-1111-4111-8111-111111111111";
const OLD_USER = "22222222-2222-4222-8222-222222222222";
const T0 = new Date("2026-11-10T15:00:00.000Z");
const plus = (d: Date, days: number) => new Date(d.getTime() + days * DAY_MS);
const viewer = (id: string) => ({ demo: false, id, email: `${id.slice(0, 4)}@prueba.test`, name: "Ana", role: "free" as const, plan: "free", onboarded: true, tz: "America/Costa_Rica", country: "CR" });
const pm = (over: Record<string, unknown> = {}) => ({ id: "pm_1", customerId: "cus_new", status: "active", type: "card", card: { brand: "visa", last4: "4242", expMonth: 12, expYear: 2030 }, ...over });

function setup(extra: Record<string, Record<string, unknown>[]> = {}) {
  const f = fakeDb({
    profiles: [{ id: NEW_USER, created_at: "2026-11-09T12:00:00.000Z", plan: "free" }, { id: OLD_USER, created_at: "2026-10-01T12:00:00.000Z", plan: "free" }],
    billing_customers: [{ user_id: NEW_USER, provider_customer_id: "cus_new" }, { user_id: OLD_USER, provider_customer_id: "cus_old" }],
    subscriptions: [], trial_charges: [], payment_methods: [], payment_events: [], notification_prefs: [], push_subscriptions: [],
    ...extra,
  }, { trial_charges: ["user_id", "idem_key"], payment_methods: ["provider_payment_method_id"] });
  state.db = f.db;
  return f;
}

/** Fila programada y tarjeta guardada, como las deja saveCard(). */
function scheduled(f: ReturnType<typeof setup>, over: Partial<TrialChargeRow> = {}) {
  const s = scheduleFor("prueba", T0, BETA);
  f.tables.payment_methods.push({ user_id: NEW_USER, provider_customer_id: "cus_new", provider_payment_method_id: "pm_1", brand: "visa", last4: "4242", exp_month: 12, exp_year: 2030, status: "active" });
  const r = { id: 1, user_id: NEW_USER, idem_key: idemKeyFor(NEW_USER), kind: "prueba", plan: "completo", billing: "mes", amount_minor: 1499, trial_started_at: s.trialStartedAt, trial_ends_at: s.trialEndsAt, charge_at: s.chargeAt, next_attempt_at: s.chargeAt, status: "scheduled", attempts: 0, last_attempt_at: null, provider_subscription_id: null, last_error: null, reminder_sent_at: null, failure_notified_attempt: null, canceled_at: null, created_at: s.trialStartedAt, updated_at: s.trialStartedAt, ...over };
  f.tables.trial_charges.push(r);
  return r as TrialChargeRow;
}
const charge = (f: ReturnType<typeof setup>) => f.tables.trial_charges[0] as unknown as TrialChargeRow;

beforeEach(() => {
  for (const m of [...Object.values(onvo), ...Object.values(mail)]) m.mockReset();
  for (const m of Object.values(mail)) m.mockResolvedValue({ ok: true } as never);
  mail.notifyInApp.mockResolvedValue(true as never);
  onvo.cancelSubscription.mockResolvedValue(null);
  onvo.detachPaymentMethod.mockResolvedValue(null);
});

describe("guardar la tarjeta", () => {
  it("cuenta nueva: guarda marca y últimos 4 que dice ONVO y programa el cobro al final de SU prueba (alta + 7 días), sin cobrar hoy", async () => {
    const f = setup();
    onvo.getPaymentMethod.mockResolvedValue(pm());
    const r = await tb.saveCard(viewer(NEW_USER), { paymentMethodId: "pm_1", plan: "completo", billing: "anual" }, T0);
    expect(r.outcome).toBe("programado");
    expect(onvo.createChargedSubscription).not.toHaveBeenCalled();
    expect(f.tables.payment_methods[0]).toMatchObject({ brand: "visa", last4: "4242", status: "active", provider_payment_method_id: "pm_1" });
    // Alta el 9 de noviembre a las 12:00: la prueba (y el cobro) terminan el 16 a la misma hora, aunque guarde la tarjeta el 10.
    expect(charge(f)).toMatchObject({ kind: "prueba", status: "scheduled", plan: "completo", billing: "anual", amount_minor: 8999, promo: "primer_mes_50", trial_started_at: "2026-11-09T12:00:00.000Z", charge_at: "2026-11-16T12:00:00.000Z" });
    expect(r.charge).toMatchObject({ promo: false, amount: 89.99 });
    expect(mail.sendTrialStarted).toHaveBeenCalledOnce();
  });
  it("0043: plan mensual con la tarjeta lista antes del primer cobro: 50 % del primer mes; cambiar a anual lo quita, volver a mensual lo devuelve", async () => {
    const f = setup();
    onvo.getPaymentMethod.mockResolvedValue(pm());
    const r = await tb.saveCard(viewer(NEW_USER), { paymentMethodId: "pm_1", plan: "completo", billing: "mes" }, T0);
    expect(charge(f)).toMatchObject({ amount_minor: 749, promo: "primer_mes_50" });
    expect(r.charge).toMatchObject({ promo: true, amount: 7.49, fullAmount: 14.99 });
    expect((mail.sendTrialStarted.mock.calls as unknown[][])[0][0]).toMatchObject({ amount: 7.49, promo: true });
    await tb.changeTrialPlan(viewer(NEW_USER), "completo", "anual", T0);
    expect(charge(f)).toMatchObject({ amount_minor: 8999 });
    await tb.changeTrialPlan(viewer(NEW_USER), "entreno", "mes", T0);
    expect(charge(f)).toMatchObject({ amount_minor: 499 });
  });
  it("0043: quien ya pagó un plan antes no gana el 50 %", async () => {
    const f = setup({ subscriptions: [{ id: 3, user_id: NEW_USER, status: "canceled", plan: "entreno", current_period_start: "2026-09-01T00:00:00Z", current_period_end: "2026-10-01T00:00:00Z", cancel_at_period_end: false }] });
    onvo.getPaymentMethod.mockResolvedValue(pm());
    await tb.saveCard(viewer(NEW_USER), { paymentMethodId: "pm_1", plan: "entreno", billing: "mes" }, T0);
    expect(charge(f)).toMatchObject({ amount_minor: 999, promo: null });
  });
  it("rechaza una tarjeta de otro cliente de ONVO o que no está activa", async () => {
    setup();
    onvo.getPaymentMethod.mockResolvedValue(pm({ customerId: "cus_otro" }));
    await expect(tb.saveCard(viewer(NEW_USER), { paymentMethodId: "pm_1", plan: "entreno", billing: "mes" }, T0)).rejects.toThrow(/otra/);
    onvo.getPaymentMethod.mockResolvedValue(pm({ status: "requires-verification" }));
    await expect(tb.saveCard(viewer(NEW_USER), { paymentMethodId: "pm_1", plan: "entreno", billing: "mes" }, T0)).rejects.toThrow(/banco/);
  });
  it("no acepta IDs raros (el ID viene del navegador)", async () => {
    setup();
    await expect(tb.saveCard(viewer(NEW_USER), { paymentMethodId: "pm_1'; drop", plan: "entreno", billing: "mes" }, T0)).rejects.toThrow(/inválida/);
    expect(onvo.getPaymentMethod).not.toHaveBeenCalled();
  });
  it("cuenta de la beta antes del 1 de noviembre: se cobra al terminar la beta, sin días extra", async () => {
    const f = setup();
    onvo.getPaymentMethod.mockResolvedValue(pm({ customerId: "cus_old" }));
    await tb.saveCard(viewer(OLD_USER), { paymentMethodId: "pm_1", plan: "entreno", billing: "mes" }, new Date("2026-10-25T12:00:00Z"));
    expect(charge(f)).toMatchObject({ kind: "beta", charge_at: BETA, trial_ends_at: BETA, promo: "primer_mes_50", amount_minor: 499 });
    expect(onvo.createChargedSubscription).not.toHaveBeenCalled();
  });
  it("cuenta de la beta después del 1 de noviembre: se cobra en ese momento", async () => {
    const f = setup();
    onvo.getPaymentMethod.mockResolvedValue(pm({ customerId: "cus_old" }));
    onvo.createChargedSubscription.mockResolvedValue({ id: "sub_1", status: "active" });
    const r = await tb.saveCard(viewer(OLD_USER), { paymentMethodId: "pm_1", plan: "entreno", billing: "mes" }, new Date("2026-11-03T12:00:00Z"));
    expect(r.outcome).toBe("enviado");
    expect(onvo.createChargedSubscription).toHaveBeenCalledOnce();
    expect(onvo.createChargedSubscription.mock.calls[0][0]).toMatchObject({ customerId: "cus_old", paymentMethodId: "pm_1", plan: "entreno", billing: "mes", trialKey: idemKeyFor(OLD_USER), attempt: 1 });
    expect(charge(f)).toMatchObject({ kind: "inmediato", status: "pending", provider_subscription_id: "sub_1", attempts: 1, promo: null, amount_minor: 999 });
    expect(f.tables.subscriptions[0]).toMatchObject({ status: "incomplete", provider_subscription_id: "sub_1", plan: "entreno", billing: "mes" });
    expect(f.tables.profiles.find((p) => p.id === OLD_USER)!.plan).toBe("free");
  });
  it("con un plan pagado vigente no se programa nada", async () => {
    setup({ subscriptions: [{ id: 9, user_id: NEW_USER, status: "active", plan: "entreno", current_period_end: plus(T0, 20).toISOString(), cancel_at_period_end: false }] });
    await expect(tb.saveCard(viewer(NEW_USER), { paymentMethodId: "pm_1", plan: "entreno", billing: "mes" }, T0)).rejects.toThrow(/activo/);
  });
});

describe("el cobro del día 7 es idempotente", () => {
  it("no cobra antes del día 7", async () => {
    const f = setup(); const r = scheduled(f);
    expect(await tb.attemptCharge(f.db, r, plus(T0, 6.99))).toBe("omitido");
    expect(onvo.createChargedSubscription).not.toHaveBeenCalled();
  });
  it("dos procesos a la vez (cron y visita a la app): un solo cobro", async () => {
    const f = setup(); const r = scheduled(f);
    onvo.createChargedSubscription.mockImplementation(async () => { await new Promise((x) => setTimeout(x, 5)); return { id: "sub_7" }; });
    const now = plus(T0, 7);
    const [a, b] = await Promise.all([tb.attemptCharge(f.db, r, now), tb.attemptCharge(f.db, r, now)]);
    expect([a, b].sort()).toEqual(["enviado", "omitido"]);
    expect(onvo.createChargedSubscription).toHaveBeenCalledOnce();
    expect(charge(f)).toMatchObject({ status: "pending", attempts: 1, provider_subscription_id: "sub_7" });
  });
  it("el barrido del cron repetido no vuelve a cobrar", async () => {
    const f = setup(); scheduled(f);
    onvo.createChargedSubscription.mockResolvedValue({ id: "sub_7" });
    const now = plus(T0, 7.1);
    await tb.sweepTrialCharges(now);
    await tb.sweepTrialCharges(now);
    await tb.runDueForUser(NEW_USER, now);
    expect(onvo.createChargedSubscription).toHaveBeenCalledOnce();
  });
  it("si ya pagó por otro lado, no cobra (reemplazado)", async () => {
    const f = setup({ subscriptions: [{ id: 9, user_id: NEW_USER, status: "active", plan: "completo", current_period_end: plus(T0, 30).toISOString(), cancel_at_period_end: false }] });
    const r = scheduled(f);
    expect(await tb.attemptCharge(f.db, r, plus(T0, 7))).toBe("reemplazado");
    expect(onvo.createChargedSubscription).not.toHaveBeenCalled();
    expect(charge(f).status).toBe("superseded");
  });
  it("el webhook confirma el cobro: queda cobrado (el plan lo da el webhook, no este módulo)", async () => {
    const f = setup(); const r = scheduled(f);
    onvo.createChargedSubscription.mockResolvedValue({ id: "sub_7" });
    await tb.attemptCharge(f.db, r, plus(T0, 7));
    await tb.trialOnActivated(f.db, { user_id: NEW_USER, provider_subscription_id: "sub_7" });
    expect(charge(f).status).toBe("succeeded");
    expect(f.tables.profiles.find((p) => p.id === NEW_USER)!.plan).toBe("free");
  });
  it("si paga otro plan antes del día 7, el cobro programado se reemplaza", async () => {
    const f = setup(); scheduled(f);
    await tb.trialOnActivated(f.db, { user_id: NEW_USER, provider_subscription_id: "sub_checkout" });
    expect(charge(f).status).toBe("superseded");
  });
});

describe("rechazo del día 7 y reintento del día 8", () => {
  it("rechazo: muro, aviso y un reintento al día siguiente; si vuelve a fallar, sin más intentos", async () => {
    const f = setup(); const r = scheduled(f);
    onvo.createChargedSubscription.mockRejectedValue(new OnvoError("Fondos insuficientes", 402));
    const d7 = plus(T0, 7);
    expect(await tb.attemptCharge(f.db, r, d7)).toBe("rechazado");
    expect(charge(f)).toMatchObject({ status: "retry_scheduled", attempts: 1, next_attempt_at: plus(d7, 1).toISOString() });
    expect(mail.sendPaymentFailed).toHaveBeenCalledOnce();
    expect((mail.sendPaymentFailed.mock.calls as unknown as [Record<string, unknown>][])[0][0]).toMatchObject({ paused: true, retryDate: plus(d7, 1).toISOString(), updateUrl: "/app/suscripcion#tarjeta" });
    // Antes del día 8 no reintenta.
    expect(await tb.attemptCharge(f.db, charge(f), plus(d7, 0.5))).toBe("omitido");
    // Día 8: reintenta una vez y falla de nuevo.
    expect(await tb.attemptCharge(f.db, charge(f), plus(d7, 1))).toBe("rechazado");
    expect(charge(f)).toMatchObject({ status: "failed", attempts: 2, next_attempt_at: null });
    expect(mail.sendPaymentFailed).toHaveBeenCalledTimes(2);
    expect(await tb.attemptCharge(f.db, charge(f), plus(d7, 5))).toBe("omitido");
    expect(onvo.createChargedSubscription).toHaveBeenCalledTimes(2);
  });
  it("rechazo informado por webhook: cancela la suscripción en ONVO (para que ONVO no reintente por su cuenta)", async () => {
    const f = setup(); const r = scheduled(f);
    onvo.createChargedSubscription.mockResolvedValue({ id: "sub_7" });
    await tb.attemptCharge(f.db, r, plus(T0, 7));
    expect(await tb.trialOnRenewalFailed(f.db, "sub_7")).toBe(true);
    expect(onvo.cancelSubscription).toHaveBeenCalledWith("sub_7");
    expect(charge(f).status).toBe("retry_scheduled");
    expect(f.tables.subscriptions[0].status).toBe("expired");
    expect(await tb.trialOnRenewalFailed(f.db, "sub_otra")).toBe(false);
  });
  it("tarjeta nueva después del rechazo: cobra en ese momento", async () => {
    const f = setup(); scheduled(f, { status: "retry_scheduled", attempts: 1, next_attempt_at: plus(T0, 8).toISOString() });
    onvo.getPaymentMethod.mockResolvedValue(pm({ id: "pm_2" }));
    onvo.createChargedSubscription.mockResolvedValue({ id: "sub_8" });
    const r = await tb.saveCard(viewer(NEW_USER), { paymentMethodId: "pm_2", plan: "completo", billing: "mes" }, plus(T0, 7.3));
    expect(r.outcome).toBe("enviado");
    expect(onvo.detachPaymentMethod).toHaveBeenCalledWith("pm_1");
    expect(onvo.createChargedSubscription.mock.calls[0][0]).toMatchObject({ paymentMethodId: "pm_2", attempt: 2 });
  });
});

describe("respuesta perdida de ONVO: nunca se cobra dos veces", () => {
  it("tiempo agotado: queda por confirmar y no se reintenta a ciegas", async () => {
    const f = setup(); const r = scheduled(f);
    onvo.createChargedSubscription.mockRejectedValue(new OnvoError("ONVO no respondió", 503));
    expect(await tb.attemptCharge(f.db, r, plus(T0, 7))).toBe("por_confirmar");
    expect(charge(f).status).toBe("unknown");
    expect(await tb.attemptCharge(f.db, charge(f), plus(T0, 7.1))).toBe("omitido");
  });
  it("la reconciliación encuentra la suscripción del intento por metadata y la vincula", async () => {
    const f = setup(); scheduled(f, { status: "unknown", attempts: 1, last_attempt_at: plus(T0, 7).toISOString() });
    onvo.listCustomerSubscriptions.mockResolvedValue([{ id: "sub_x", metadata: { trialKey: idemKeyFor(NEW_USER), attempt: "1" } }]);
    await tb.sweepTrialCharges(plus(T0, 7.01));
    expect(charge(f)).toMatchObject({ status: "pending", provider_subscription_id: "sub_x" });
    expect(onvo.createChargedSubscription).not.toHaveBeenCalled();
  });
  it("ONVO no tiene nada de este intento después de 30 min: se reprograma (y se cobra una vez)", async () => {
    const f = setup(); scheduled(f, { status: "unknown", attempts: 1, last_attempt_at: plus(T0, 7).toISOString() });
    onvo.listCustomerSubscriptions.mockResolvedValue([]);
    onvo.createChargedSubscription.mockResolvedValue({ id: "sub_y" });
    await tb.sweepTrialCharges(new Date(plus(T0, 7).getTime() + 31 * 60_000));
    expect(onvo.createChargedSubscription).toHaveBeenCalledOnce();
    expect(charge(f)).toMatchObject({ status: "pending", attempts: 1, provider_subscription_id: "sub_y" });
  });
  it("si ONVO no guarda metadata no hay forma segura de saber: queda para revisión manual", async () => {
    const f = setup(); scheduled(f, { status: "unknown", attempts: 1, last_attempt_at: plus(T0, 7).toISOString() });
    onvo.listCustomerSubscriptions.mockResolvedValue([{ id: "sub_viejo", status: "canceled" }]);
    await tb.sweepTrialCharges(plus(T0, 8));
    expect(charge(f).status).toBe("unknown");
    expect(onvo.createChargedSubscription).not.toHaveBeenCalled();
  });
});

describe("cancelar antes del día 7", () => {
  it("no se cobra, el acceso sigue hasta el fin de la prueba y la tarjeta se desconecta en ONVO", async () => {
    const f = setup(); scheduled(f);
    const r = await tb.cancelTrial(viewer(NEW_USER), false, plus(T0, 3));
    expect(r).toEqual({ accessUntil: plus(T0, 7).toISOString(), cardKept: false });
    expect(onvo.detachPaymentMethod).toHaveBeenCalledWith("pm_1");
    expect(f.tables.payment_methods[0].status).toBe("disconnected");
    expect(charge(f)).toMatchObject({ status: "canceled", next_attempt_at: null });
    expect(await tb.attemptCharge(f.db, charge(f), plus(T0, 7))).toBe("omitido");
    await tb.sweepTrialCharges(plus(T0, 7.5));
    expect(onvo.createChargedSubscription).not.toHaveBeenCalled();
    expect(mail.sendChargeCanceled).toHaveBeenCalledOnce();
  });
  it("puede conservar la tarjeta y volver a su plan antes del día 7", async () => {
    const f = setup(); scheduled(f);
    expect(await tb.cancelTrial(viewer(NEW_USER), true, plus(T0, 3))).toMatchObject({ cardKept: true });
    expect(onvo.detachPaymentMethod).not.toHaveBeenCalled();
    const v = await tb.resumeTrial(viewer(NEW_USER), plus(T0, 4));
    expect(v).toMatchObject({ phase: "programado", chargeAt: plus(T0, 7).toISOString() });
  });
  it("con el cobro en curso no se puede cancelar", async () => {
    const f = setup(); scheduled(f, { status: "pending", attempts: 1 });
    await expect(tb.cancelTrial(viewer(NEW_USER), false, plus(T0, 7))).rejects.toThrow(/procesando/);
  });
});

describe("aviso del día 5", () => {
  it("se manda una sola vez, por correo, campanita y push", async () => {
    const f = setup(); scheduled(f);
    await tb.sweepTrialCharges(plus(T0, 5.2));
    await tb.sweepTrialCharges(plus(T0, 5.4));
    await tb.runDueForUser(NEW_USER, plus(T0, 5.5));
    expect(mail.sendChargeReminder).toHaveBeenCalledOnce();
    expect(mail.notifyInApp).toHaveBeenCalledWith(NEW_USER, expect.objectContaining({ body: "En 2 días se cobra tu plan de $14.99. Puedes cancelar sin costo hasta el día 7." }));
  });
  it("el día 4 todavía no", async () => {
    const f = setup(); scheduled(f);
    await tb.sweepTrialCharges(plus(T0, 4));
    expect(mail.sendChargeReminder).not.toHaveBeenCalled();
  });
});

describe("webhook antes de registrar la suscripción", () => {
  it("con un cobro en vuelo, el evento desconocido queda en error para reintentarse", async () => {
    const f = setup(); scheduled(f, { status: "charging", attempts: 1 });
    expect(await tb.trialChargeInFlight(f.db, "cus_new")).toBe(true);
    expect(await tb.trialChargeInFlight(f.db, "cus_otro")).toBe(false);
    const { processWebhook } = await import("./billing");
    const r = await processWebhook({ type: "subscription.renewal.succeeded", data: { subscriptionId: "sub_tarde", paymentIntentId: "pi_1", customerId: "cus_new", status: "paid" } }, "{}");
    expect(r.status).toBe("error");
  });
});

describe("testers de la beta: nunca se cobra durante el mes de tester (0029)", () => {
  /** Como la base: tester_hold_charge aplaza el cobro al final del mes de tester y devuelve esa fecha. */
  function asTester(f: ReturnType<typeof setup>, until: Date | null) {
    const db = f.db as unknown as { rpc: (fn: string, args: { p_user: string }) => Promise<{ data: unknown; error: null }> };
    db.rpc = async (fn, args) => {
      if (fn !== "tester_hold_charge" || !until || args.p_user !== NEW_USER) return { data: null, error: null };
      const r = f.tables.trial_charges[0] as Record<string, unknown>;
      if (r && r.status === "scheduled" && Date.parse(String(r.charge_at)) < until.getTime()) Object.assign(r, { moved_from: r.moved_from ?? r.charge_at, charge_at: until.toISOString(), next_attempt_at: until.toISOString(), reminder_sent_at: null, tester_hold: true });
      return { data: until.toISOString(), error: null };
    };
  }
  it("el día 7 de un tester no se cobra: se aplaza al final de su mes de tester", async () => {
    const f = setup({ tester_grants: [] }); const r = scheduled(f);
    const until = plus(T0, 25);
    asTester(f, until);
    expect(await tb.attemptCharge(f.db, r, plus(T0, 7))).toBe("aplazado");
    expect(onvo.createChargedSubscription).not.toHaveBeenCalled();
    expect(charge(f)).toMatchObject({ status: "scheduled", attempts: 0, charge_at: until.toISOString(), next_attempt_at: until.toISOString(), tester_hold: true });
    await tb.sweepTrialCharges(plus(T0, 7.5));
    expect(onvo.createChargedSubscription).not.toHaveBeenCalled();
  });
  it("el aviso de 2 días antes no sale para la fecha vieja; sale antes de la nueva y lo dice", async () => {
    const f = setup({ tester_grants: [] }); scheduled(f);
    const until = plus(T0, 25);
    asTester(f, until);
    await tb.sweepTrialCharges(plus(T0, 5.2));
    expect(mail.sendChargeReminder).not.toHaveBeenCalled();
    await tb.sweepTrialCharges(plus(T0, 23.5));
    expect(mail.sendChargeReminder).toHaveBeenCalledOnce();
    expect(mail.sendChargeReminder).toHaveBeenCalledWith(expect.objectContaining({ moved: "tester", chargeAt: until.toISOString() }));
    expect(mail.notifyInApp).toHaveBeenCalledWith(NEW_USER, expect.objectContaining({ body: expect.stringContaining("Tu mes de tester termina en 2 días") }));
  });
  it("si lo hacen tester justo después de la revisión, se devuelve el intento sin contarlo y no se cobra", async () => {
    const f = setup({ tester_grants: [{ id: 1, user_id: NEW_USER, revoked_at: null, starts_at: plus(T0, 6).toISOString(), expires_at: plus(T0, 36).toISOString() }] });
    const r = scheduled(f);
    asTester(f, null); // la primera revisión no lo ve (carrera)
    expect(await tb.attemptCharge(f.db, r, plus(T0, 7))).toBe("aplazado");
    expect(onvo.createChargedSubscription).not.toHaveBeenCalled();
    expect(charge(f)).toMatchObject({ status: "scheduled", attempts: 0 });
  });
  it("sin tester (o sin la migración) cobra como siempre", async () => {
    const f = setup({ tester_grants: [] }); const r = scheduled(f);
    asTester(f, null);
    onvo.createChargedSubscription.mockResolvedValue({ id: "sub_7" });
    expect(await tb.attemptCharge(f.db, r, plus(T0, 7))).toBe("enviado");
  });
});

describe("0043: primer mes con 50 % en ONVO (cobro único y luego la suscripción normal)", () => {
  it("cobra el monto con descuento con un PaymentIntent confirmado por el servidor y activa un mes", async () => {
    const f = setup();
    const r = scheduled(f, { promo: "primer_mes_50", amount_minor: 749 } as Partial<TrialChargeRow>);
    onvo.createPaymentIntent.mockResolvedValue({ id: "pi_1", status: "requires_confirmation" });
    onvo.confirmPaymentIntent.mockResolvedValue({ id: "pi_1", status: "succeeded" });
    onvo.getPaymentIntent.mockResolvedValue({ id: "pi_1", status: "succeeded", amount: 749, currency: "USD" });
    expect(await tb.attemptCharge(f.db, r, plus(T0, 7))).toBe("enviado");
    expect(onvo.createPaymentIntent.mock.calls[0][0]).toMatchObject({ amountMinor: 749, customerId: "cus_new" });
    expect(onvo.confirmPaymentIntent).toHaveBeenCalledWith("pi_1", "pm_1");
    expect(onvo.createChargedSubscription).not.toHaveBeenCalled();
    expect(f.tables.subscriptions[0]).toMatchObject({ provider_subscription_id: "onvo-pi:pi_1", status: "active", plan: "completo", billing: "mes" });
    expect(charge(f)).toMatchObject({ status: "succeeded" });
    expect(f.tables.profiles.find((p) => p.id === NEW_USER)!.plan).toBe("completo");
  });
  it("si ONVO cobró menos de lo que dice el servidor, no se activa", async () => {
    const f = setup();
    const r = scheduled(f, { promo: "primer_mes_50", amount_minor: 749 } as Partial<TrialChargeRow>);
    onvo.createPaymentIntent.mockResolvedValue({ id: "pi_2" });
    onvo.confirmPaymentIntent.mockResolvedValue({ id: "pi_2", status: "succeeded" });
    onvo.getPaymentIntent.mockResolvedValue({ id: "pi_2", status: "succeeded", amount: 100, currency: "USD" });
    await tb.attemptCharge(f.db, r, plus(T0, 7));
    expect(f.tables.profiles.find((p) => p.id === NEW_USER)!.plan).toBe("free");
  });
  it("un monto guardado que no coincide con el servidor nunca se cobra", async () => {
    const f = setup();
    const r = scheduled(f, { promo: "primer_mes_50", amount_minor: 1 } as Partial<TrialChargeRow>);
    expect(await tb.attemptCharge(f.db, r, plus(T0, 7))).toBe("sin_config");
    expect(onvo.createPaymentIntent).not.toHaveBeenCalled();
  });
  it("3DS o rechazo: rechazo normal con reintento al día siguiente", async () => {
    const f = setup();
    const r = scheduled(f, { promo: "primer_mes_50", amount_minor: 749 } as Partial<TrialChargeRow>);
    onvo.createPaymentIntent.mockResolvedValue({ id: "pi_3" });
    onvo.confirmPaymentIntent.mockResolvedValue({ id: "pi_3", status: "requires_action" });
    onvo.getPaymentIntent.mockResolvedValue({ id: "pi_3", status: "requires_action", amount: 749, currency: "USD" });
    expect(await tb.attemptCharge(f.db, r, plus(T0, 7))).toBe("rechazado");
    expect(charge(f)).toMatchObject({ status: "retry_scheduled" });
    expect(onvo.cancelSubscription).not.toHaveBeenCalled();
  });
  it("sin respuesta al confirmar: por confirmar y se consulta el PaymentIntent (nunca se cobra dos veces)", async () => {
    const f = setup();
    const r = scheduled(f, { promo: "primer_mes_50", amount_minor: 749 } as Partial<TrialChargeRow>);
    onvo.createPaymentIntent.mockResolvedValue({ id: "pi_4" });
    onvo.confirmPaymentIntent.mockRejectedValue(new OnvoError("timeout", 504));
    expect(await tb.attemptCharge(f.db, r, plus(T0, 7))).toBe("por_confirmar");
    expect(charge(f)).toMatchObject({ status: "unknown", provider_subscription_id: "onvo-pi:pi_4" });
    onvo.getPaymentIntent.mockResolvedValue({ id: "pi_4", status: "succeeded", amount: 749, currency: "USD" });
    await tb.runDueForUser(NEW_USER, plus(T0, 7.1));
    expect(onvo.createPaymentIntent).toHaveBeenCalledOnce();
    expect(f.tables.subscriptions[0]).toMatchObject({ status: "active" });
  });
});
