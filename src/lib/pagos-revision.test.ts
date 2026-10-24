// Revisión de pagos (24 oct 2026): doble cobro en renovaciones, cambio de tarjeta con la renovación rechazada, vuelta de
// Tilopay, compra directa y cobro programado a la vez, cobros sin confirmar, promoción una vez por tarjeta.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fakeDb } from "./fake-db";
import { idemKeyFor, type TrialChargeRow } from "./trial";

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
const mon = vi.hoisted(() => ({ recordServerError: vi.fn() }));
vi.mock("@/lib/monitor/server", () => mon);

const { OnvoError } = await import("./onvo");
const tb = await import("./trial-billing");
const tp = await import("./tilopay-billing");
const intro = await import("./onvo-intro");
const { signState, verifyState } = await import("./tilopay");

const U = "11111111-1111-4111-8111-111111111111";
const OTHER = "33333333-3333-4333-8333-333333333333";
const T0 = new Date("2026-12-10T15:00:00.000Z");
const iso = (d: Date) => d.toISOString();
const plusH = (d: Date, h: number) => new Date(d.getTime() + h * 3600_000);
const viewer = (id: string) => ({ demo: false, id, email: `${id.slice(0, 4)}@prueba.test`, name: "Ana", role: "free" as const, plan: "free", onboarded: true, tz: "America/Costa_Rica", country: "CO" });

function setup(extra: Record<string, Record<string, unknown>[]> = {}) {
  const f = fakeDb({
    profiles: [{ id: U, created_at: "2026-11-20T12:00:00.000Z", plan: "completo" }, { id: OTHER, created_at: "2026-11-20T12:00:00.000Z", plan: "free" }],
    users: [{ id: U, email: "u@prueba.test" }, { id: OTHER, email: "o@prueba.test" }],
    billing_customers: [{ user_id: U, provider_customer_id: "cus_u" }, { user_id: OTHER, provider_customer_id: "cus_o" }],
    subscriptions: [], trial_charges: [], payment_methods: [], payment_events: [], notification_prefs: [], push_subscriptions: [], comp_grants: [], card_fingerprints: [],
    ...extra,
  }, { trial_charges: ["user_id", "idem_key"], payment_methods: ["provider_payment_method_id"], payment_events: ["event_key"] });
  state.db = f.db;
  return f;
}

/** Plan de Tilopay que vence en T0 (mensual, Entreno + Nutrición). */
function tilopaySub(f: ReturnType<typeof setup>, over: Record<string, unknown> = {}) {
  const r = { id: 7, user_id: U, provider: "tilopay", provider_customer_id: `tlp:${U}`, provider_subscription_id: "tlp:bbt-abc-1", status: "active", plan: "completo", billing: "mes", cancel_at_period_end: false, canceled_at: null, current_period_start: "2026-11-10T15:00:00.000Z", current_period_end: iso(T0), renewal_attempts: 0, next_renewal_attempt_at: null, last_renewal_error: null, created_at: "2026-11-10T15:00:00.000Z", ...over };
  f.tables.subscriptions.push(r);
  f.tables.payment_methods.push({ user_id: U, provider: "tilopay", provider_customer_id: `tlp:${U}`, provider_payment_method_id: "tok_viejo_123", status: "active" });
  return r;
}
const sub = (f: ReturnType<typeof setup>, id = 7) => f.tables.subscriptions.find((s) => s.id === id)!;

beforeEach(() => {
  for (const m of [...Object.values(onvo), ...Object.values(mail), ...Object.values(tlp), mon.recordServerError]) m.mockReset();
  for (const m of Object.values(mail)) m.mockResolvedValue({ ok: true } as never);
  mail.notifyInApp.mockResolvedValue(true as never);
  onvo.cancelSubscription.mockResolvedValue(null);
  onvo.detachPaymentMethod.mockResolvedValue(null);
  tlp.removeCardToken.mockResolvedValue(true);
});

describe("1. renovaciones de Tilopay: nunca dos cobros", () => {
  it("la marca 'por confirmar' queda en el MISMO reclamo, antes de cobrar", async () => {
    const f = setup();
    tilopaySub(f);
    tlp.chargeSavedCard.mockImplementation(async () => {
      // En el momento del cobro, la fila ya tiene la marca: si el proceso muere aquí, la próxima corrida solo consulta.
      expect(String(sub(f).last_renewal_error)).toMatch(/^por confirmar:bbr-7-/);
      return { state: "approved", auth: "1", transactionId: "t", description: null };
    });
    await tp.sweepTilopayRenewals(T0);
    expect(tlp.chargeSavedCard).toHaveBeenCalledOnce();
    expect(sub(f)).toMatchObject({ status: "active", last_renewal_error: null, renewal_attempts: 0 });
  });
  it("si la activación falla después de cobrar, la próxima corrida consulta la orden y activa, sin volver a cobrar", async () => {
    const f = setup();
    tilopaySub(f);
    tlp.chargeSavedCard.mockResolvedValue({ state: "approved", auth: "1", transactionId: "t", description: null });
    // La base falla al registrar el cobro aprobado (p. ej. un corte): la renovación queda a medias.
    const origFrom = f.db.from.bind(f.db);
    let broken = true;
    (f.db as unknown as { from: (t: string) => unknown }).from = (t: string) => { if (t === "payment_events" && broken) throw new Error("corte"); return origFrom(t); };
    const s1 = await tp.sweepTilopayRenewals(T0);
    expect(s1?.errors).toBe(1);
    expect(String(sub(f).last_renewal_error)).toMatch(/^por confirmar:/);
    broken = false;
    tlp.consultOrder.mockResolvedValue({ state: "approved", amountMinor: 1499, currency: "USD", token: null });
    await tp.sweepTilopayRenewals(plusH(T0, 1));
    expect(tlp.chargeSavedCard).toHaveBeenCalledOnce();
    expect(tlp.consultOrder).toHaveBeenCalledOnce();
    expect(sub(f)).toMatchObject({ status: "active", last_renewal_error: null });
    expect(Date.parse(String(sub(f).current_period_end))).toBeGreaterThan(T0.getTime());
  });
  it("sin respuesta: espera y consulta; más de un día sin respuesta pasa a revisión (alerta y app_errors), nunca cobra de nuevo", async () => {
    const f = setup();
    tilopaySub(f);
    tlp.chargeSavedCard.mockResolvedValue({ state: "unknown", error: "timeout" });
    await tp.sweepTilopayRenewals(T0);
    expect(String(sub(f).last_renewal_error)).toMatch(/^por confirmar:/);
    tlp.consultOrder.mockResolvedValue({ state: "unknown" });
    await tp.sweepTilopayRenewals(plusH(T0, 25));
    expect(String(sub(f).last_renewal_error)).toMatch(/^revisar:bbr-7-/);
    expect(mon.recordServerError).toHaveBeenCalledWith("pagos/renovacion-por-confirmar", "renewal_review");
    await tp.sweepTilopayRenewals(plusH(T0, 32));
    expect(tlp.chargeSavedCard).toHaveBeenCalledOnce();
  });
  it("sin tiempo suficiente en la función no empieza un cobro nuevo", async () => {
    const f = setup();
    tilopaySub(f);
    await tp.sweepTilopayRenewals(T0, { chargeBy: Date.now() - 1 });
    expect(tlp.chargeSavedCard).not.toHaveBeenCalled();
    expect(sub(f)).toMatchObject({ renewal_attempts: 0, last_renewal_error: null });
  });
  it("9. si cancela entre la lectura y el reclamo, no se cobra", async () => {
    const f = setup();
    const r = tilopaySub(f);
    tlp.chargeSavedCard.mockResolvedValue({ state: "approved", auth: "1", transactionId: "t", description: null });
    // La lectura del barrido ya la vio; justo antes del reclamo, la persona cancela.
    const origFrom = f.db.from.bind(f.db);
    let reads = 0;
    (f.db as unknown as { from: (t: string) => unknown }).from = (t: string) => {
      const q = origFrom(t) as unknown as { select: (...a: unknown[]) => unknown };
      if (t === "subscriptions" && ++reads === 3) r.cancel_at_period_end = true;
      return q;
    };
    await tp.sweepTilopayRenewals(T0);
    expect(tlp.chargeSavedCard).not.toHaveBeenCalled();
  });
  it("10. un cobro por confirmar se sigue consultando aunque la persona cancele después", async () => {
    const f = setup();
    tilopaySub(f, { cancel_at_period_end: true, last_renewal_error: "por confirmar:bbr-7-20261210-1", renewal_attempts: 1, next_renewal_attempt_at: iso(T0) });
    tlp.consultOrder.mockResolvedValue({ state: "approved", amountMinor: 1499, currency: "USD", token: null });
    await tp.sweepTilopayRenewals(plusH(T0, 1));
    expect(tlp.consultOrder).toHaveBeenCalledWith("bbr-7-20261210-1");
    expect(tlp.chargeSavedCard).not.toHaveBeenCalled();
    // Cobrado antes de cancelar: tiene su periodo, y se cierra al final (sigue cancelado al final del periodo).
    expect(sub(f)).toMatchObject({ status: "active", cancel_at_period_end: true, last_renewal_error: null });
  });
});

describe("2. ONVO después del primer mes con 50 %: nunca dos suscripciones", () => {
  function introSub(f: ReturnType<typeof setup>, over: Record<string, unknown> = {}) {
    const r = { id: 8, user_id: U, provider: "onvo", provider_customer_id: "cus_u", provider_subscription_id: "onvo-pi:pi_1", status: "active", plan: "completo", billing: "mes", cancel_at_period_end: false, current_period_start: "2026-11-10T15:00:00.000Z", current_period_end: iso(T0), renewal_attempts: 0, next_renewal_attempt_at: null, last_renewal_error: null, created_at: "2026-11-10T15:00:00.000Z", updated_at: "2026-11-10T15:00:00.000Z", ...over };
    f.tables.subscriptions.push(r);
    f.tables.payment_methods.push({ user_id: U, provider: "onvo", provider_customer_id: "cus_u", provider_payment_method_id: "pm_u", status: "active" });
    return r;
  }
  it("el reclamo deja 'por confirmar:<intento>' antes de crear la suscripción", async () => {
    const f = setup();
    introSub(f);
    onvo.createChargedSubscription.mockImplementation(async () => {
      expect(sub(f, 8).last_renewal_error).toBe("por confirmar:1");
      return { id: "sub_n", status: "active" };
    });
    await intro.sweepOnvoIntro(T0);
    expect(sub(f, 8).last_renewal_error).toBe("enviado:sub_n");
  });
  it("si el proceso muere después de crearla, la próxima corrida la encuentra por metadata y no crea otra", async () => {
    const f = setup();
    introSub(f, { last_renewal_error: "por confirmar:1", renewal_attempts: 1, next_renewal_attempt_at: iso(T0) });
    onvo.listCustomerSubscriptions.mockResolvedValue([{ id: "sub_n", status: "active", metadata: { trialKey: "intro:8", attempt: "1" } }]);
    await intro.sweepOnvoIntro(plusH(T0, 1));
    expect(onvo.createChargedSubscription).not.toHaveBeenCalled();
    expect(sub(f, 8).last_renewal_error).toBe("enviado:sub_n");
  });
  it("si ONVO no guarda metadata, no hay forma segura de saber: nunca se crea otra (queda para revisión)", async () => {
    const f = setup();
    introSub(f, { last_renewal_error: "por confirmar:1", renewal_attempts: 1, next_renewal_attempt_at: iso(T0), updated_at: iso(plusH(T0, -2)) });
    onvo.listCustomerSubscriptions.mockResolvedValue([{ id: "sub_x", status: "active" }]);
    await intro.sweepOnvoIntro(plusH(T0, 30));
    expect(onvo.createChargedSubscription).not.toHaveBeenCalled();
    expect(String(sub(f, 8).last_renewal_error)).toBe("revisar:1");
    expect(mon.recordServerError).toHaveBeenCalledWith("pagos/renovacion-por-confirmar", "renewal_review");
  });
});

describe("3. cambiar la tarjeta con la renovación rechazada (enlace del correo: /app/suscripcion#tarjeta)", () => {
  it("Tilopay: el correo de rechazo lleva a #tarjeta; guardar la tarjeta nueva reintenta ya y renueva", async () => {
    const f = setup();
    tilopaySub(f);
    tlp.chargeSavedCard.mockResolvedValueOnce({ state: "declined", description: "fondos insuficientes" });
    await tp.sweepTilopayRenewals(T0);
    expect(sub(f)).toMatchObject({ status: "past_due" });
    expect((mail.sendPaymentFailed.mock.calls[0] as unknown as [{ updateUrl: string }])[0].updateUrl).toBe("/app/suscripcion#tarjeta");
    // La persona abre el enlace y guarda otra tarjeta (vuelta de Tilopay con su estado firmado).
    tlp.chargeSavedCard.mockResolvedValueOnce({ state: "approved", auth: "1", transactionId: "t2", description: null });
    const s = { u: U, p: "tarjeta" as const, plan: "completo" as const, billing: "mes" as const, n: "x", t: Math.floor(Date.now() / 1000) };
    const out = await tp.handleTilopayReturn(viewer(U), s, new URLSearchParams({ code: "1", crd: "tok_nuevo_456" }), plusH(T0, 2));
    expect(out.outcome).toBe("tarjeta_ok");
    expect(f.tables.payment_methods[0]).toMatchObject({ provider_payment_method_id: "tok_nuevo_456", status: "active" });
    expect((tlp.chargeSavedCard.mock.calls[1] as unknown as [{ token: string }])[0].token).toBe("tok_nuevo_456");
    expect(sub(f)).toMatchObject({ status: "active", renewal_attempts: 0, last_renewal_error: null });
  });
  it("ONVO, suscripción normal en past_due: se cancela la vieja y se crea una nueva con la tarjeta nueva", async () => {
    const f = setup({ subscriptions: [{ id: 9, user_id: U, provider: "onvo", provider_customer_id: "cus_u", provider_subscription_id: "sub_viejo", status: "past_due", plan: "entreno", billing: "mes", cancel_at_period_end: false, current_period_start: "2026-11-01T00:00:00.000Z", current_period_end: iso(plusH(T0, 48)), renewal_attempts: 0, next_renewal_attempt_at: null, last_renewal_error: null, created_at: "2026-11-01T00:00:00.000Z", updated_at: "2026-11-01T00:00:00.000Z" }] });
    f.tables.payment_methods.push({ user_id: U, provider: "onvo", provider_customer_id: "cus_u", provider_payment_method_id: "pm_viejo", status: "active" });
    onvo.getPaymentMethod.mockResolvedValue({ id: "pm_nuevo", customerId: "cus_u", status: "active", type: "card", card: { brand: "visa", last4: "1111", expMonth: 1, expYear: 2031 } });
    onvo.createChargedSubscription.mockResolvedValue({ id: "sub_nuevo", status: "active" });
    const r = await tb.saveCard(viewer(U), { paymentMethodId: "pm_nuevo", plan: "entreno", billing: "mes" }, T0);
    expect(r.outcome).toBe("tarjeta_cambiada");
    expect(onvo.cancelSubscription).toHaveBeenCalledWith("sub_viejo");
    expect(onvo.createChargedSubscription.mock.calls[0][0]).toMatchObject({ paymentMethodId: "pm_nuevo", trialKey: "cambio:9", attempt: 1 });
    expect(sub(f, 9).last_renewal_error).toBe("enviado:sub_nuevo");
    expect(f.tables.subscriptions.find((s) => s.provider_subscription_id === "sub_nuevo")).toMatchObject({ status: "incomplete" });
  });
  it("con un plan normal de ONVO al día no se cambia la tarjeta (ONVO no lo permite)", async () => {
    setup({ subscriptions: [{ id: 9, user_id: U, provider: "onvo", provider_subscription_id: "sub_ok", status: "active", plan: "entreno", billing: "mes", cancel_at_period_end: false, current_period_end: iso(plusH(T0, 240)) }] });
    await expect(tb.saveCard(viewer(U), { paymentMethodId: "pm_nuevo", plan: "entreno", billing: "mes" }, T0)).rejects.toThrow(/activo/);
  });
  it("la tarjeta tiene que ser del mismo procesador que el plan", async () => {
    const f = setup();
    tilopaySub(f, { status: "past_due" });
    await expect(tb.cardSaveContext(f.db, viewer(U), T0, "onvo")).rejects.toThrow(/otro país/);
  });
});

describe("4. vuelta de Tilopay al guardar la tarjeta", () => {
  const s = () => ({ u: OTHER, p: "tarjeta" as const, plan: "entreno" as const, billing: "mes" as const, n: "y", t: Math.floor(Date.now() / 1000) });
  it("Tilopay dijo que no (code distinto de 1): no se guarda nada aunque venga un token", async () => {
    const f = setup();
    const out = await tp.handleTilopayReturn(viewer(OTHER), s(), new URLSearchParams({ code: "0", crd: "tok_rechazado_1" }), T0);
    expect(out.outcome).toBe("rechazada");
    expect(f.tables.payment_methods).toHaveLength(0);
  });
  it("un token que ya es de otra cuenta no se acepta (error, nunca 'guardada')", async () => {
    const f = setup();
    f.tables.payment_methods.push({ user_id: U, provider: "tilopay", provider_customer_id: `tlp:${U}`, provider_payment_method_id: "tok_ajeno_999", status: "active" });
    await expect(tp.handleTilopayReturn(viewer(OTHER), s(), new URLSearchParams({ code: "1", crd: "tok_ajeno_999" }), T0)).rejects.toThrow(/No pudimos usar esa tarjeta/);
    expect(f.tables.payment_methods.filter((p) => p.user_id === OTHER)).toHaveLength(0);
  });
});

describe("5 y 6. compra directa y cobro programado", () => {
  it("con una compra directa en curso, el cobro de la tarjeta guardada se aplaza (sin doble cobro)", async () => {
    const f = setup({ subscriptions: [{ id: 20, user_id: OTHER, provider: "tilopay", provider_subscription_id: "tlp:bbc-abc", status: "incomplete", plan: "entreno", billing: "mes", created_at: iso(plusH(T0, -0.5)) }] });
    f.tables.payment_methods.push({ user_id: OTHER, provider: "tilopay", provider_customer_id: `tlp:${OTHER}`, provider_payment_method_id: "tok_o_1", status: "active" });
    f.tables.trial_charges.push({ id: 3, user_id: OTHER, idem_key: idemKeyFor(OTHER), kind: "prueba", plan: "entreno", billing: "mes", amount_minor: 999, promo: null, trial_started_at: "2026-11-20T12:00:00.000Z", trial_ends_at: "2026-11-27T12:00:00.000Z", charge_at: "2026-11-27T12:00:00.000Z", next_attempt_at: "2026-11-27T12:00:00.000Z", status: "scheduled", attempts: 0, last_attempt_at: null, provider_subscription_id: null, last_error: null, updated_at: "2026-11-20T12:00:00.000Z" });
    const r = await tb.attemptCharge(f.db, f.tables.trial_charges[0] as unknown as TrialChargeRow, T0);
    expect(r).toBe("aplazado");
    expect(tlp.chargeSavedCard).not.toHaveBeenCalled();
    expect(f.tables.trial_charges[0]).toMatchObject({ status: "scheduled", attempts: 0, next_attempt_at: iso(plusH(T0, 1.5)) });
  });
  it("una compra aprobada cuya fila ya venció se reactiva (nunca se pierde un pago en silencio)", async () => {
    const f = setup({ profiles: [{ id: OTHER, created_at: "2026-11-20T12:00:00.000Z", plan: "free" }], subscriptions: [{ id: 21, user_id: OTHER, provider: "tilopay", provider_customer_id: `tlp:${OTHER}`, provider_subscription_id: "tlp:bbc-x1", status: "expired", plan: "entreno", billing: "mes", cancel_at_period_end: false, current_period_start: null, current_period_end: null, created_at: iso(plusH(T0, -1)) }] });
    tlp.consultOrder.mockResolvedValue({ state: "approved", amountMinor: 999, currency: "USD", token: "tok_srv_77" });
    const s = { u: OTHER, p: "pago" as const, plan: "entreno" as const, billing: "mes" as const, n: "z", t: Math.floor(Date.now() / 1000), o: "bbc-x1" };
    const out = await tp.handleTilopayReturn(viewer(OTHER), s, new URLSearchParams({ code: "1", order: "bbc-x1" }), T0);
    expect(out.outcome).toBe("pago_ok");
    expect(sub(f, 21)).toMatchObject({ status: "active" });
    expect(f.tables.payment_methods[0]).toMatchObject({ user_id: OTHER, provider_payment_method_id: "tok_srv_77" });
  });
  it("aprobada con otro plan ya activo: alerta de reembolso (app_errors), no se pierde", async () => {
    setup({ subscriptions: [
      { id: 21, user_id: OTHER, provider: "tilopay", provider_subscription_id: "tlp:bbc-x2", status: "expired", plan: "entreno", billing: "mes", created_at: iso(plusH(T0, -1)) },
      { id: 22, user_id: OTHER, provider: "tilopay", provider_subscription_id: "tlp:bbt-y", status: "active", plan: "entreno", billing: "mes", cancel_at_period_end: false, current_period_end: iso(plusH(T0, 600)) },
    ] });
    tlp.consultOrder.mockResolvedValue({ state: "approved", amountMinor: 999, currency: "USD", token: null });
    const s = { u: OTHER, p: "pago" as const, plan: "entreno" as const, billing: "mes" as const, n: "z", t: Math.floor(Date.now() / 1000), o: "bbc-x2" };
    expect((await tp.handleTilopayReturn(viewer(OTHER), s, new URLSearchParams({ code: "1" }), T0)).outcome).toBe("pago_ok");
    expect(mon.recordServerError).toHaveBeenCalledWith("pagos/reembolso", "refund_review");
  });
});

describe("7. cobro sin confirmar más de un día: revisión y deja de bloquear", () => {
  it("pasa a revisión (alerta y app_errors); la persona puede pagar y guardar otra tarjeta sin que se cobre sola", async () => {
    const f = setup();
    f.tables.payment_methods.push({ user_id: OTHER, provider: "tilopay", provider_customer_id: `tlp:${OTHER}`, provider_payment_method_id: "tok_o_2", status: "active" });
    f.tables.trial_charges.push({ id: 4, user_id: OTHER, idem_key: idemKeyFor(OTHER), kind: "prueba", plan: "entreno", billing: "mes", amount_minor: 999, promo: null, trial_started_at: "2026-11-20T12:00:00.000Z", trial_ends_at: "2026-11-27T12:00:00.000Z", charge_at: "2026-11-27T12:00:00.000Z", next_attempt_at: "2026-11-27T12:00:00.000Z", status: "unknown", attempts: 1, last_attempt_at: iso(plusH(T0, -30)), provider_subscription_id: "tlp:bbt-q-1", last_error: "sin respuesta", updated_at: iso(plusH(T0, -30)) });
    tlp.consultOrder.mockResolvedValue({ state: "unknown" });
    await tb.sweepTrialCharges(T0);
    expect(String(f.tables.trial_charges[0].last_error)).toMatch(/^revisar:/);
    expect(mon.recordServerError).toHaveBeenCalledWith("pagos/cobro-por-confirmar", "charge_review");
    // Ya no bloquea: puede abrir la página para guardar otra tarjeta, y guardarla no cobra sola.
    tlp.createTokenizeUrl.mockResolvedValue("https://secure.tilopay.com/x");
    vi.stubEnv("TILOPAY_STATE_SECRET", "secreto-de-prueba");
    await expect(tp.startTilopayCard(viewer(OTHER), "entreno", "mes", "https://www.bananaburn.app")).resolves.toMatchObject({ url: "https://secure.tilopay.com/x" });
    const s = { u: OTHER, p: "tarjeta" as const, plan: "entreno" as const, billing: "mes" as const, n: "w", t: Math.floor(Date.now() / 1000) };
    const out = await tp.handleTilopayReturn(viewer(OTHER), s, new URLSearchParams({ code: "1", crd: "tok_o_333" }), T0);
    expect(out.outcome).toBe("tarjeta_ok");
    expect(tlp.chargeSavedCard).not.toHaveBeenCalled();
    expect(f.tables.trial_charges[0].status).toBe("unknown");
    vi.unstubAllEnvs();
  });
});

describe("8. promoción una vez por tarjeta", () => {
  it("la misma tarjeta en una cuenta nueva no vuelve a ganar el 50 %", async () => {
    const f = setup({ profiles: [{ id: U, created_at: "2026-12-08T12:00:00.000Z", plan: "free" }, { id: OTHER, created_at: "2026-12-09T12:00:00.000Z", plan: "free" }] });
    const card = (customerId: string, id: string) => ({ id, customerId, status: "active", type: "card", card: { brand: "visa", last4: "4242", expMonth: 12, expYear: 2030 } });
    onvo.getPaymentMethod.mockResolvedValueOnce(card("cus_u", "pm_a"));
    await tb.saveCard(viewer(U), { paymentMethodId: "pm_a", plan: "entreno", billing: "mes" }, T0);
    expect(f.tables.trial_charges.find((t) => t.user_id === U)).toMatchObject({ promo: "primer_mes_50", amount_minor: 499 });
    onvo.getPaymentMethod.mockResolvedValueOnce(card("cus_o", "pm_b"));
    await tb.saveCard(viewer(OTHER), { paymentMethodId: "pm_b", plan: "entreno", billing: "mes" }, T0);
    expect(f.tables.trial_charges.find((t) => t.user_id === OTHER)).toMatchObject({ promo: null, amount_minor: 999 });
    expect(f.tables.card_fingerprints).toHaveLength(2);
  });
});

describe("12. firma de la vuelta de Tilopay", () => {
  it("usa TILOPAY_STATE_SECRET si existe (la contraseña de la API ya no sirve para firmar)", () => {
    const env = { TILOPAY_STATE_SECRET: "propio", TILOPAY_API_PASSWORD: "pw" } as unknown as NodeJS.ProcessEnv;
    const st = signState({ u: U, p: "tarjeta", plan: "entreno", billing: "mes", n: "a" }, Date.now(), env);
    expect(verifyState(st, Date.now(), env)).toMatchObject({ u: U });
    expect(verifyState(st, Date.now(), { TILOPAY_API_PASSWORD: "pw" } as unknown as NodeJS.ProcessEnv)).toBeNull();
  });
});
