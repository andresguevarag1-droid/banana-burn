import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fakeDb } from "./fake-db";
import { idemKeyFor, type TrialChargeRow } from "./trial";
import { SIMULACRO_AT, chargeKeyOf, duplicateKeys, money, summarize, toCsv, type PlannedCharge } from "./cobros-simulacro";
import { ReadOnlyError, readOnly } from "./supabase/read-only";
import { releaseKeyAfter, renewalNext } from "./tilopay-renewal";

// ── Dobles: base en memoria, ONVO, Tilopay, correo, push y monitor. ──
const state: { db: SupabaseClient | null } = { db: null };
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => state.db }));
const onvo = vi.hoisted(() => ({
  createChargedSubscription: vi.fn(), cancelSubscription: vi.fn(), listCustomerSubscriptions: vi.fn(), getSubscription: vi.fn(), createCustomer: vi.fn(),
  createPaymentIntent: vi.fn(), confirmPaymentIntent: vi.fn(), getPaymentIntent: vi.fn(), getPaymentMethod: vi.fn(), detachPaymentMethod: vi.fn(),
}));
vi.mock("@/lib/onvo", async (orig) => {
  const real = await orig<typeof import("./onvo")>();
  return { ...real, ...onvo, isOnvoConfigured: () => true, priceIdFor: (p: string, b: string) => `price_${p}_${b}` };
});
const tilo = vi.hoisted(() => ({ chargeSavedCard: vi.fn(), consultOrder: vi.fn(), createTokenizeUrl: vi.fn(), createPaymentUrl: vi.fn(), removeCardToken: vi.fn() }));
vi.mock("@/lib/tilopay", async (orig) => {
  const real = await orig<typeof import("./tilopay")>();
  return { ...real, ...tilo, isTilopayConfigured: () => true };
});
const mail = vi.hoisted(() => ({
  notifyInApp: vi.fn(async () => true), sendChargeCanceled: vi.fn(async () => ({ ok: true })), sendChargeReminder: vi.fn(async () => ({ ok: true })),
  sendPaymentFailed: vi.fn(async () => ({ ok: true })), sendTrialStarted: vi.fn(async () => ({ ok: true })), sendPaymentReceipt: vi.fn(async () => ({ ok: true })),
  sendSubscriptionCanceled: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/email", () => mail);
vi.mock("@/lib/push", () => ({ pushToUser: vi.fn(async () => 1), sendPush: vi.fn(async () => 1) }));
vi.mock("@/lib/monitor/server", () => ({ recordServerError: vi.fn() }));

const { OnvoError } = await import("./onvo");
const { plannedOf, runCobros } = await import("./cobros-cron");
const tb = await import("./trial-billing");
const tlb = await import("./tilopay-billing");
const intro = await import("./onvo-intro");

const AT = new Date(SIMULACRO_AT);
const GRACE = "2026-11-08T06:00:00.000Z";
const plusDays = (d: Date, n: number) => new Date(d.getTime() + n * 864e5);
const u = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const U = {
  betaOnvo: u(1), betaTilo: u(2), anual: u(3), prueba: u(4), sinTarjeta: u(5), reintento: u(6), condo: u(7), regalo: u(8), renueva: u(9), intro: u(10), vuelo: u(11),
};

/** Fila de trial_charges como la deja saveCard(): por defecto, beta con 50 % en Entreno mensual. */
const row = (id: number, user: string, over: Partial<TrialChargeRow> = {}): Record<string, unknown> => ({
  id, user_id: user, idem_key: idemKeyFor(user), kind: "beta", plan: "entreno", billing: "mes", amount_minor: 499, promo: "primer_mes_50",
  trial_started_at: "2026-10-20T00:00:00.000Z", trial_ends_at: GRACE, charge_at: GRACE, next_attempt_at: GRACE, status: "scheduled", attempts: 0,
  last_attempt_at: null, provider_subscription_id: null, last_error: null, reminder_sent_at: null, failure_notified_attempt: null, canceled_at: null,
  created_at: "2026-10-20T00:00:00.000Z", updated_at: "2026-10-20T00:00:00.000Z", ...over,
});
const card = (user: string, provider: "onvo" | "tilopay" = "onvo") => ({
  user_id: user, provider, provider_customer_id: `cus_${user.slice(0, 8)}`, provider_payment_method_id: `pm_${user.slice(0, 8)}`, brand: "visa", last4: "4242", exp_month: 12, exp_year: 2030, status: "active",
});
const KEY_UNIQUE = { cols: ["user_id", "periodo", "procesador"], where: (r: Record<string, unknown>) => r.estado === "reservado" };

function setup(seed: Record<string, Record<string, unknown>[]>) {
  const f = fakeDb({
    subscriptions: [], trial_charges: [], payment_methods: [], payment_events: [], comp_grants: [], tester_grants: [], charge_keys: [], profiles: [], users: [],
    notification_prefs: [], push_subscriptions: [], ...seed,
  }, { trial_charges: ["user_id", "idem_key"], payment_methods: ["provider_payment_method_id"], charge_keys: [KEY_UNIQUE] });
  state.db = f.db;
  return f;
}

/** El 8 de noviembre: una cuenta por caso. */
function noviembre() {
  return setup({
    profiles: Object.values(U).map((id) => ({ id, plan: "free", created_at: "2026-10-20T00:00:00.000Z" })),
    users: Object.values(U).map((id) => ({ id, email: `${id.slice(0, 8)}@correo.test` })),
    trial_charges: [
      row(1, U.betaOnvo),
      row(2, U.betaTilo, { plan: "completo", amount_minor: 749 }),
      row(3, U.anual, { plan: "completo", billing: "anual", amount_minor: 8999 }),
      row(4, U.prueba, { kind: "prueba", promo: null, amount_minor: 999, trial_started_at: "2026-11-01T06:10:00.000Z", trial_ends_at: "2026-11-08T06:10:00.000Z", charge_at: "2026-11-08T06:10:00.000Z", next_attempt_at: "2026-11-08T06:10:00.000Z" }),
      row(5, U.reintento, { plan: "completo", amount_minor: 749, status: "retry_scheduled", attempts: 1, next_attempt_at: "2026-11-08T06:15:00.000Z", last_error: "Fondos insuficientes" }),
      row(6, U.condo),
      row(7, U.regalo),
      row(8, U.vuelo, { status: "unknown", attempts: 1, last_error: "sin respuesta de ONVO (red)" }),
    ],
    payment_methods: [card(U.betaOnvo), card(U.betaTilo, "tilopay"), card(U.anual), card(U.prueba), card(U.reintento), card(U.condo), card(U.regalo), card(U.vuelo), card(U.renueva, "tilopay"), card(U.intro)],
    comp_grants: [
      { id: 1, user_id: U.condo, source: "condominio", plan: "completo", starts_at: "2026-11-01T00:00:00.000Z", expires_at: "2026-12-01T00:00:00.000Z", revoked_at: null },
      { id: 2, user_id: U.regalo, source: "regalo", plan: "entreno", starts_at: "2026-11-01T00:00:00.000Z", expires_at: "2026-12-01T00:00:00.000Z", revoked_at: null },
    ],
    subscriptions: [
      { id: 50, user_id: U.renueva, provider: "tilopay", provider_customer_id: "tlp-cus", provider_subscription_id: "tlp:bbc-1", status: "active", plan: "entreno", billing: "mes", current_period_start: "2026-10-08T00:00:00.000Z", current_period_end: "2026-11-08T00:00:00.000Z", cancel_at_period_end: false, renewal_attempts: 0, next_renewal_attempt_at: null, last_renewal_error: null },
      { id: 51, user_id: U.intro, provider: "onvo", provider_customer_id: `cus_${U.intro.slice(0, 8)}`, provider_subscription_id: "onvo-pi:pi_1", status: "active", plan: "completo", billing: "mes", current_period_start: "2026-10-07T00:00:00.000Z", current_period_end: "2026-11-07T00:00:00.000Z", cancel_at_period_end: false, renewal_attempts: 0, next_renewal_attempt_at: null, last_renewal_error: null, updated_at: "2026-10-07T00:00:00.000Z" },
    ],
  });
}

const simulate = async () => plannedOf(await runCobros(AT, { dryRun: true }));
const of = (list: PlannedCharge[], user: string) => list.filter((p) => p.userId === user);
const processorCalls = () => [...Object.values(onvo), ...Object.values(tilo)].reduce((n, m) => n + m.mock.calls.length, 0);

beforeEach(() => {
  for (const m of [...Object.values(onvo), ...Object.values(tilo), ...Object.values(mail)]) m.mockReset();
});

describe("simulacro del 8 de noviembre (dryRun)", () => {
  it("beta vencida: cobra el primer mes con 50 % ($4.99 y $7.49) con el procesador de su tarjeta", async () => {
    noviembre();
    const { planned, errors } = await simulate();
    expect(errors).toBe(0);
    expect(of(planned, U.betaOnvo)).toEqual([expect.objectContaining({ accion: "cobrar", origen: "fin_beta", procesador: "onvo", montoMinor: 499, montoEsperadoMinor: 499, promo50: true, periodo: "primer_cobro" })]);
    expect(of(planned, U.betaTilo)).toEqual([expect.objectContaining({ accion: "cobrar", origen: "fin_beta", procesador: "tilopay", montoMinor: 749, promo50: true })]);
  });
  it("antes del fin de la gracia, la beta no se cobra", async () => {
    noviembre();
    const { planned } = plannedOf(await runCobros(new Date("2026-11-08T05:59:00.000Z"), { dryRun: true }));
    expect(planned.filter((p) => p.accion === "cobrar" && p.origen === "fin_beta")).toEqual([]);
  });
  it("prueba sin tarjeta: no hay nada que cobrar", async () => {
    noviembre();
    const { planned } = await simulate();
    expect(of(planned, U.sinTarjeta)).toEqual([]);
  });
  it("tarjeta guardada al terminar la prueba de 7 días: precio normal con ONVO", async () => {
    noviembre();
    const { planned } = await simulate();
    expect(of(planned, U.prueba)).toEqual([expect.objectContaining({ accion: "cobrar", origen: "prueba", procesador: "onvo", montoMinor: 999, promo50: false })]);
  });
  it("anual: precio normal (sin 50 %) y con temporada incluida para canjear", async () => {
    noviembre();
    const { planned } = await simulate();
    expect(of(planned, U.anual)).toEqual([expect.objectContaining({ accion: "cobrar", montoMinor: 8999, promo50: false, temporadaIncluida: true })]);
  });
  it("cobro rechazado con reintento: el reintento del día siguiente aparece como reintento", async () => {
    noviembre();
    const { planned } = await simulate();
    expect(of(planned, U.reintento)).toEqual([expect.objectContaining({ accion: "cobrar", origen: "reintento", montoMinor: 749 })]);
  });
  it("cortesía activa: la de condominio frena el cobro; otra cortesía no lo frena y queda marcada para revisar", async () => {
    noviembre();
    const { planned } = await simulate();
    expect(of(planned, U.condo)).toEqual([expect.objectContaining({ accion: "omitir", motivo: "condominio" })]);
    expect(of(planned, U.regalo)).toEqual([expect.objectContaining({ accion: "cobrar", cortesia: true })]);
  });
  it("renovación de Tilopay y paso a la suscripción normal de ONVO después del 50 %", async () => {
    noviembre();
    const { planned } = await simulate();
    expect(of(planned, U.renueva)).toEqual([expect.objectContaining({ accion: "cobrar", origen: "renovacion", procesador: "tilopay", montoMinor: 999, periodo: "2026-11-08T00:00:00.000Z", fila: 50 })]);
    expect(of(planned, U.intro)).toEqual([expect.objectContaining({ accion: "cobrar", origen: "primer_mes_normal", procesador: "onvo", montoMinor: 1499, periodo: "2026-11-07T00:00:00.000Z" })]);
  });
  it("cobro en vuelo: solo se consulta, nunca se cobra de nuevo", async () => {
    noviembre();
    const { planned } = await simulate();
    expect(of(planned, U.vuelo)).toEqual([expect.objectContaining({ accion: "consultar" })]);
  });
  it("tester o plan ya pagado: no se cobra", async () => {
    const f = noviembre();
    f.tables.tester_grants.push({ id: 1, user_id: U.betaOnvo, starts_at: "2026-11-01T00:00:00.000Z", expires_at: "2026-12-01T00:00:00.000Z", revoked_at: null });
    f.tables.subscriptions.push({ id: 60, user_id: U.prueba, provider: "onvo", status: "active", plan: "entreno", billing: "mes", current_period_end: "2026-12-01T00:00:00.000Z", cancel_at_period_end: false });
    const { planned } = await simulate();
    expect(of(planned, U.betaOnvo)[0]).toMatchObject({ accion: "omitir", motivo: "tester" });
    expect(of(planned, U.prueba)[0]).toMatchObject({ accion: "omitir", motivo: "ya_paga" });
  });
  it("en dryRun no se llama a ONVO ni a Tilopay y no se escribe nada en la base", async () => {
    const f = noviembre();
    const before = JSON.stringify(f.tables);
    const { errors } = await simulate();
    expect(errors).toBe(0);
    expect(processorCalls()).toBe(0);
    expect(f.rpcCalls).toEqual([]);
    expect(JSON.stringify(f.tables)).toBe(before);
    expect(mail.sendPaymentFailed).not.toHaveBeenCalled();
  });
  it("correr el cron dos veces seguidas en dryRun: mismo resultado y 0 cobros duplicados", async () => {
    noviembre();
    const a = await simulate();
    const b = await simulate();
    expect(b.planned).toEqual(a.planned);
    expect(duplicateKeys([...a.planned])).toEqual([]);
    expect(duplicateKeys([...b.planned])).toEqual([]);
    expect(a.planned.filter((p) => p.accion === "cobrar")).toHaveLength(8);
    expect(processorCalls()).toBe(0);
  });
  it("con la llave ya reservada (cobro hecho o en vuelo), el simulacro no lo cuenta como cobro", async () => {
    const f = noviembre();
    f.tables.charge_keys.push({ id: 1, user_id: U.betaOnvo, periodo: "primer_cobro", procesador: "onvo", origen: "primer_cobro", referencia: "x", estado: "reservado" });
    const { planned } = await simulate();
    expect(of(planned, U.betaOnvo)[0]).toMatchObject({ accion: "omitir", motivo: "llave_ocupada" });
  });
  it("el reporte identifica por id y nunca lleva correo ni nombre", async () => {
    noviembre();
    const { planned } = await simulate();
    const csv = toCsv(planned);
    const json = JSON.stringify(planned);
    expect(csv.split("\n")[0]).toBe("userId,fila,origen,procesador,plan,billing,montoMinor,montoEsperadoMinor,promo50,periodo,accion,motivo,cortesia,temporadaIncluida");
    for (const out of [csv, json]) {
      expect(out).not.toMatch(/@|correo\.test|email|nombre|last4|4242|pm_|cus_/);
    }
  });
});

describe("resumen del simulacro", () => {
  it("cuenta por procesador, por mes y año, y el 50 % por monto, en formato es-419", async () => {
    noviembre();
    const { planned } = await simulate();
    const s = summarize(planned, SIMULACRO_AT);
    expect(s.cobros).toBe(8);
    expect(s.primerMes50).toEqual({ "499": 2, "749": 2 });
    expect(s.anual).toEqual({ cobros: 1, montoMinor: 8999 });
    expect(s.porProcesador.tilopay.cobros).toBe(2);
    expect(s.temporadasIncluidas).toBe(1);
    expect(s.conCortesia).toBe(1);
    expect(s.consultar).toBe(1);
    expect(s.omitidos).toEqual({ condominio: 1 });
    expect(s.duplicados).toBe(0);
    expect([money(999), money(1499), money(499), money(104000)]).toEqual(["$9.99", "$14.99", "$4.99", "$1,040.00"]);
  });
  it("detecta una llave que se cobraría dos veces", () => {
    const p = { userId: U.betaOnvo, periodo: "primer_cobro", procesador: "onvo", accion: "cobrar" } as PlannedCharge;
    expect(duplicateKeys([p, { ...p }])).toEqual([chargeKeyOf(p)]);
    expect(duplicateKeys([p, { ...p, procesador: "tilopay" }])).toEqual([]);
    expect(duplicateKeys([p, { ...p, accion: "consultar" }])).toEqual([]);
  });
});

describe("cliente de solo lectura", () => {
  it("deja leer y bloquea toda escritura antes de salir", async () => {
    const f = setup({ trial_charges: [row(1, U.betaOnvo)] });
    const ro = readOnly(f.db);
    expect(((await ro.from("trial_charges").select("id")).data as { id: number }[])[0].id).toBe(1);
    expect(() => ro.from("trial_charges").update({ status: "charging" })).toThrow(ReadOnlyError);
    expect(() => ro.from("charge_keys").insert({})).toThrow(ReadOnlyError);
    expect(() => ro.from("payment_methods").upsert({})).toThrow(ReadOnlyError);
    expect(() => ro.from("subscriptions").delete()).toThrow(ReadOnlyError);
    expect(() => ro.rpc("tester_hold_charge", {})).toThrow(ReadOnlyError);
    expect(() => ro.auth.admin.getUserById(U.betaOnvo)).toThrow(ReadOnlyError);
    expect(f.tables.trial_charges[0].status).toBe("scheduled");
  });
});

describe("llave única de cobro (0062): un mismo cobro nunca se hace dos veces", () => {
  const onvoRow = () => row(1, U.betaOnvo, { promo: null, amount_minor: 999 });
  it("el cron real dos veces seguidas: un solo cobro y una sola llave reservada", async () => {
    const f = setup({ trial_charges: [onvoRow()], payment_methods: [card(U.betaOnvo)] });
    onvo.createChargedSubscription.mockResolvedValue({ id: "sub_1" });
    await tb.sweepTrialCharges(AT, { skipReminders: true });
    await tb.sweepTrialCharges(AT, { skipReminders: true });
    expect(onvo.createChargedSubscription).toHaveBeenCalledOnce();
    expect(f.tables.charge_keys).toEqual([expect.objectContaining({ user_id: U.betaOnvo, periodo: "primer_cobro", procesador: "onvo", estado: "reservado" })]);
  });
  it("si la llave ya está reservada (otra fila u otro proceso), no llama a ONVO y devuelve el intento", async () => {
    const f = setup({ trial_charges: [onvoRow()], payment_methods: [card(U.betaOnvo)], charge_keys: [{ id: 1, user_id: U.betaOnvo, periodo: "primer_cobro", procesador: "onvo", origen: "primer_cobro", referencia: "otro", estado: "reservado" }] });
    expect(await tb.attemptCharge(f.db, { ...f.tables.trial_charges[0] } as unknown as TrialChargeRow, AT)).toBe("aplazado");
    expect(onvo.createChargedSubscription).not.toHaveBeenCalled();
    expect(f.tables.trial_charges[0]).toMatchObject({ status: "scheduled", attempts: 0, last_error: "llave de cobro ocupada" });
  });
  it("cobro rechazado: libera la llave y el reintento del día siguiente la vuelve a reservar", async () => {
    const f = setup({ trial_charges: [onvoRow()], payment_methods: [card(U.betaOnvo)] });
    onvo.createChargedSubscription.mockRejectedValueOnce(new OnvoError("Fondos insuficientes", 402)).mockResolvedValueOnce({ id: "sub_2" });
    expect(await tb.attemptCharge(f.db, { ...f.tables.trial_charges[0] } as unknown as TrialChargeRow, AT)).toBe("rechazado");
    expect(f.tables.charge_keys).toEqual([expect.objectContaining({ estado: "liberado", motivo: "rechazado" })]);
    expect(await tb.attemptCharge(f.db, { ...f.tables.trial_charges[0] } as unknown as TrialChargeRow, plusDays(AT, 1))).toBe("enviado");
    expect(onvo.createChargedSubscription).toHaveBeenCalledTimes(2);
    expect(f.tables.charge_keys.map((k) => k.estado)).toEqual(["liberado", "reservado"]);
  });
  it("sin respuesta de ONVO: la llave queda reservada (nunca se cobra a ciegas)", async () => {
    const f = setup({ trial_charges: [onvoRow()], payment_methods: [card(U.betaOnvo)] });
    onvo.createChargedSubscription.mockRejectedValue(new OnvoError("timeout", 504));
    expect(await tb.attemptCharge(f.db, { ...f.tables.trial_charges[0] } as unknown as TrialChargeRow, AT)).toBe("por_confirmar");
    expect(f.tables.charge_keys).toEqual([expect.objectContaining({ estado: "reservado" })]);
  });
  it("si la base no deja reservar la llave (p. ej. sin 0062), no cobra", async () => {
    const f = setup({ trial_charges: [onvoRow()], payment_methods: [card(U.betaOnvo)] });
    const broken = new Proxy(f.db, {
      get(t, p) {
        if (p !== "from") return Reflect.get(t, p);
        return (table: string) => (table === "charge_keys"
          ? { insert: async () => ({ data: null, error: { message: "relation does not exist", code: "42P01" } }) }
          : t.from(table));
      },
    }) as SupabaseClient;
    expect(await tb.attemptCharge(broken, { ...f.tables.trial_charges[0] } as unknown as TrialChargeRow, AT)).toBe("aplazado");
    expect(onvo.createChargedSubscription).not.toHaveBeenCalled();
  });
  it("Tilopay: la renovación reserva la llave del periodo; rechazada la libera; con la llave ocupada no cobra", async () => {
    const sub = { id: 50, user_id: U.renueva, provider: "tilopay", provider_customer_id: "tlp-cus", provider_subscription_id: "tlp:bbc-1", status: "active", plan: "entreno", billing: "mes", current_period_start: "2026-10-08T00:00:00.000Z", current_period_end: "2026-11-08T00:00:00.000Z", cancel_at_period_end: false, renewal_attempts: 0, next_renewal_attempt_at: null, last_renewal_error: null };
    const f = setup({ subscriptions: [sub], payment_methods: [card(U.renueva, "tilopay")], users: [{ id: U.renueva, email: "x@correo.test" }], profiles: [{ id: U.renueva, plan: "entreno" }] });
    tilo.chargeSavedCard.mockResolvedValue({ state: "declined", description: "Fondos insuficientes" });
    await tlb.sweepTilopayRenewals(AT);
    expect(tilo.chargeSavedCard).toHaveBeenCalledOnce();
    expect(tilo.chargeSavedCard.mock.calls[0][0]).toMatchObject({ amountMinor: 999 });
    expect(f.tables.charge_keys).toEqual([expect.objectContaining({ user_id: U.renueva, periodo: "2026-11-08T00:00:00.000Z", procesador: "tilopay", origen: "renovacion", estado: "liberado" })]);
    // Otro proceso tomó la llave del periodo antes del reintento: no se cobra.
    f.tables.charge_keys.push({ id: 9, user_id: U.renueva, periodo: "2026-11-08T00:00:00.000Z", procesador: "tilopay", origen: "renovacion", referencia: "otro", estado: "reservado" });
    await tlb.sweepTilopayRenewals(plusDays(AT, 1.1));
    expect(tilo.chargeSavedCard).toHaveBeenCalledOnce();
    expect(f.tables.subscriptions[0]).toMatchObject({ renewal_attempts: 1, last_renewal_error: "Fondos insuficientes" });
  });
  it("ONVO después del 50 %: la suscripción normal se crea una sola vez; con la llave ocupada no se crea", async () => {
    const introSub = { id: 51, user_id: U.intro, provider: "onvo", provider_customer_id: `cus_${U.intro.slice(0, 8)}`, provider_subscription_id: "onvo-pi:pi_1", status: "active", plan: "completo", billing: "mes", current_period_start: "2026-10-07T00:00:00.000Z", current_period_end: "2026-11-07T00:00:00.000Z", cancel_at_period_end: false, renewal_attempts: 0, next_renewal_attempt_at: null, last_renewal_error: null, updated_at: "2026-10-07T00:00:00.000Z" };
    let f = setup({ subscriptions: [introSub], payment_methods: [card(U.intro)], profiles: [{ id: U.intro, plan: "completo" }] });
    onvo.createChargedSubscription.mockResolvedValue({ id: "sub_n", status: "active" });
    await intro.sweepOnvoIntro(AT);
    await intro.sweepOnvoIntro(plusDays(AT, 0.5));
    expect(onvo.createChargedSubscription).toHaveBeenCalledOnce();
    expect(f.tables.charge_keys).toEqual([expect.objectContaining({ user_id: U.intro, periodo: "2026-11-07T00:00:00.000Z", procesador: "onvo", origen: "primer_mes_normal", estado: "reservado" })]);
    onvo.createChargedSubscription.mockClear();
    f = setup({ subscriptions: [introSub], payment_methods: [card(U.intro)], charge_keys: [{ id: 1, user_id: U.intro, periodo: "2026-11-07T00:00:00.000Z", procesador: "onvo", origen: "primer_mes_normal", referencia: "otro", estado: "reservado" }] });
    await intro.sweepOnvoIntro(AT);
    expect(onvo.createChargedSubscription).not.toHaveBeenCalled();
    expect(f.tables.subscriptions[0]).toMatchObject({ renewal_attempts: 0, last_renewal_error: null });
  });
  it("después de cada paso de una renovación, la llave se libera solo si no se cobró", () => {
    expect(releaseKeyAfter(renewalNext(1, "declined", AT))).toBe(true);
    expect(releaseKeyAfter(renewalNext(3, "declined", AT))).toBe(true);
    expect(releaseKeyAfter(renewalNext(1, "sin_tarjeta", AT))).toBe(true);
    expect(releaseKeyAfter(renewalNext(1, "approved", AT))).toBe(false);
    expect(releaseKeyAfter(renewalNext(1, "unknown", AT))).toBe(false);
  });
});
