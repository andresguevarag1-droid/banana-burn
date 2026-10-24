import { describe, expect, it } from "vitest";
import { entitlementsFrom, type CompRow, type SubscriptionRow } from "./entitlements";
import { hasNutrition } from "./plans";
import { scheduleFor, type CardRow, type TrialChargeRow } from "./trial";

const NOW = new Date("2026-10-22T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 864e5).toISOString();
const inDays = (n: number) => new Date(NOW.getTime() + n * 864e5).toISOString();

const sub = (o: Partial<SubscriptionRow>): SubscriptionRow => ({
  id: 1, user_id: "u", provider_customer_id: "c", provider_subscription_id: "s", status: "active", price_id: "p", plan: "entreno", billing: "mes",
  cancel_at_period_end: false, canceled_at: null, current_period_start: daysAgo(5), current_period_end: inDays(25), created_at: daysAgo(5), ...o,
});
const comp = (o: Partial<CompRow>): CompRow => ({ plan: "entreno", previous_plan: "free", starts_at: daysAgo(2), expires_at: inDays(20), revoked_at: null, created_at: daysAgo(2), ...o });
// Estas pruebas cubren las reglas normales (después de la beta); la beta tiene su propio bloque abajo.
const base = { profilePlan: "free", role: "free", now: NOW, subs: [] as SubscriptionRow[], betaEndsAt: "2000-01-01T00:00:00Z" };
const CARD: CardRow = { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2030, status: "active" };
/** Prueba de 7 días con tarjeta guardada hace `n` días (0026). */
const trialCharge = (n: number, o: Partial<TrialChargeRow> = {}): TrialChargeRow => {
  const s = scheduleFor("prueba", new Date(daysAgo(n)), "2000-01-01T00:00:00Z");
  return { id: 1, user_id: "u", idem_key: "trial:u", kind: "prueba", plan: "entreno", billing: "mes", amount_minor: 999, trial_started_at: s.trialStartedAt, trial_ends_at: s.trialEndsAt, charge_at: s.chargeAt, next_attempt_at: s.chargeAt, status: "scheduled", attempts: 0, last_attempt_at: null, provider_subscription_id: null, last_error: null, reminder_sent_at: null, failure_notified_attempt: null, canceled_at: null, created_at: s.trialStartedAt, updated_at: s.trialStartedAt, ...o };
};

describe("acceso: prueba gratis de 7 días con tarjeta (desde el fin de la beta)", () => {
  it("cuenta nueva con tarjeta guardada: todo incluido y días restantes, aunque eligió Entreno", () => {
    const e = entitlementsFrom({ ...base, createdAt: daysAgo(2), trialCharge: trialCharge(2), card: CARD });
    expect(e).toMatchObject({ access: "trial", app: true, nutrition: true, locked: false, plan: "free", cardStep: "none" });
    expect(e.trial?.daysLeft).toBe(5);
    expect(e.charge).toMatchObject({ phase: "programado", amount: 9.99, chargeAt: trialCharge(2).charge_at });
    expect(e.card).toMatchObject({ last4: "4242", active: true });
  });
  it("último día de prueba muestra 1 día", () => {
    const e = entitlementsFrom({ ...base, createdAt: daysAgo(6.9), trialCharge: trialCharge(6.9), card: CARD });
    expect(e.trial?.daysLeft).toBe(1);
  });
  it("0043: cuenta nueva sin tarjeta: 7 días con todo desde el alta y la oferta de dejar la tarjeta lista", () => {
    const e = entitlementsFrom({ ...base, createdAt: daysAgo(0.1) });
    expect(e).toMatchObject({ access: "trial", app: true, nutrition: true, locked: false, cardStep: "trial" });
    expect(e.trial?.daysLeft).toBe(7);
  });
  it("0043: cuenta nueva sin tarjeta al día 7: muro", () => {
    const e = entitlementsFrom({ ...base, createdAt: daysAgo(7.01) });
    expect(e).toMatchObject({ access: "none", locked: true, trial: null, cardStep: "pay" });
    expect(e.trialEndsAt).toBeTruthy();
  });
  it("día 7 sin cobro confirmado todavía: muro (el plan lo da el webhook)", () => {
    const e = entitlementsFrom({ ...base, createdAt: daysAgo(7), trialCharge: trialCharge(7, { status: "pending", attempts: 1 }), card: CARD });
    expect(e).toMatchObject({ access: "none", locked: true });
    expect(e.charge?.phase).toBe("procesando");
    expect(e.trialEndsAt).toBe(trialCharge(7).trial_ends_at);
  });
  it("cobro rechazado: muro y pedir otra tarjeta", () => {
    const e = entitlementsFrom({ ...base, createdAt: daysAgo(7.2), trialCharge: trialCharge(7.2, { status: "retry_scheduled", attempts: 1, next_attempt_at: inDays(0.8) }), card: CARD });
    expect(e).toMatchObject({ locked: true, cardStep: "pay" });
    expect(e.charge?.phase).toBe("reintento");
  });
  it("canceló antes del día 7: acceso hasta el final de la prueba, sin cobro", () => {
    const e = entitlementsFrom({ ...base, createdAt: daysAgo(3), trialCharge: trialCharge(3, { status: "canceled", next_attempt_at: null }), card: { ...CARD, status: "disconnected" } });
    expect(e).toMatchObject({ access: "trial", locked: false });
    expect(e.charge?.phase).toBe("cancelado");
  });
  it("cobro confirmado por el webhook: vale el plan pagado", () => {
    const e = entitlementsFrom({ ...base, createdAt: daysAgo(8), subs: [sub({})], trialCharge: trialCharge(8, { status: "succeeded" }), card: CARD });
    expect(e).toMatchObject({ plan: "entreno", access: "subscription", trial: null, cardStep: "none" });
  });
  it("sin fecha de creación: no hay prueba", () => {
    expect(entitlementsFrom({ ...base, createdAt: null }).locked).toBe(true);
  });
});

describe("acceso por plan", () => {
  it("Entreno pagado: app sí, nutrición no", () => {
    const e = entitlementsFrom({ ...base, createdAt: daysAgo(40), subs: [sub({})] });
    expect(e).toMatchObject({ plan: "entreno", access: "subscription", app: true, nutrition: false, locked: false, status: "active", fromSubscription: true });
  });
  it("Entreno pagado durante la prueba: ya no tiene nutrición gratis (manda el plan)", () => {
    const e = entitlementsFrom({ ...base, createdAt: daysAgo(1), subs: [sub({})] });
    expect(e.nutrition).toBe(false);
  });
  it("Completo pagado: todo", () => {
    const e = entitlementsFrom({ ...base, createdAt: daysAgo(40), subs: [sub({ plan: "completo" })] });
    expect(e).toMatchObject({ plan: "completo", app: true, nutrition: true });
  });
  it("suscripción cancelada y vencida: bloqueado, no da nutrición", () => {
    const e = entitlementsFrom({ ...base, profilePlan: "completo", createdAt: daysAgo(90), subs: [sub({ plan: "completo", status: "canceled", cancel_at_period_end: true, current_period_end: daysAgo(10) })] });
    expect(e).toMatchObject({ locked: true, nutrition: false, status: "canceled" });
  });
  it("cancelada al final del periodo: mantiene acceso hasta el fin", () => {
    const e = entitlementsFrom({ ...base, createdAt: daysAgo(90), subs: [sub({ status: "canceled", cancel_at_period_end: true, current_period_end: inDays(3) })] });
    expect(e).toMatchObject({ plan: "entreno", status: "canceling", locked: false });
  });
  it("cortesía vigente = completo, aunque sea de Entreno", () => {
    const e = entitlementsFrom({ ...base, profilePlan: "entreno", createdAt: daysAgo(90), comps: [comp({})] });
    expect(e).toMatchObject({ plan: "completo", access: "comp", nutrition: true, locked: false, fromSubscription: false });
    expect(e.compEndsAt).toBe(inDays(20));
  });
  it("cortesía vigente gana a una suscripción vencida", () => {
    const e = entitlementsFrom({ ...base, createdAt: daysAgo(90), subs: [sub({ status: "canceled", current_period_end: daysAgo(30) })], comps: [comp({})] });
    expect(e.access).toBe("comp");
  });
  it("cortesía vencida sin restaurar: vale el plan previo, no el de la cortesía", () => {
    const e = entitlementsFrom({ ...base, profilePlan: "completo", createdAt: daysAgo(90), comps: [comp({ plan: "completo", previous_plan: "free", expires_at: daysAgo(1), starts_at: daysAgo(30), created_at: daysAgo(30) })] });
    expect(e.locked).toBe(true);
  });
  it("staff = completo", () => {
    const e = entitlementsFrom({ ...base, role: "coach", createdAt: daysAgo(400) });
    expect(e).toMatchObject({ plan: "completo", access: "staff", nutrition: true, locked: false });
  });
  it("plan asignado a mano sin suscripciones se respeta (pro histórico = completo)", () => {
    expect(entitlementsFrom({ ...base, profilePlan: "pro", createdAt: daysAgo(400) })).toMatchObject({ plan: "completo", access: "manual" });
    expect(entitlementsFrom({ ...base, profilePlan: "entreno", createdAt: daysAgo(400) })).toMatchObject({ plan: "entreno", nutrition: false });
  });
  it("el usuario no puede ganar acceso con un plan del perfil si tiene suscripciones vencidas", () => {
    const e = entitlementsFrom({ ...base, profilePlan: "completo", createdAt: daysAgo(400), subs: [sub({ status: "canceled", current_period_end: daysAgo(30) })] });
    expect(e.locked).toBe(true);
  });
});

describe("hasNutrition", () => {
  it("solo completo/pro", () => {
    expect(hasNutrition("completo")).toBe(true);
    expect(hasNutrition("pro")).toBe(true);
    expect(hasNutrition("entreno")).toBe(false);
    expect(hasNutrition("free")).toBe(false);
    expect(hasNutrition(null)).toBe(false);
  });
});

describe("período de prueba del servicio (beta)", () => {
  const beta = { ...base, betaEndsAt: "2026-11-01T06:00:00.000Z" };
  it("antes de noviembre nadie se bloquea, aunque su prueba de 7 días haya pasado", () => {
    const e = entitlementsFrom({ ...beta, createdAt: daysAgo(30) });
    expect(e.locked).toBe(false);
    expect(e.nutrition).toBe(true);
    expect(e.trial?.beta).toBe(true);
    // 0045: las cuentas de la beta siguen gratis hasta el final del 7 de noviembre (Costa Rica).
    expect(e.trial?.endsAt).toBe("2026-11-08T06:00:00.000Z");
  });
  it("0045: quien se registra en la última semana de la beta tiene gratis hasta el 7 de noviembre, igual que todos", () => {
    const e = entitlementsFrom({ ...beta, now: new Date("2026-10-30T12:00:00Z"), createdAt: "2026-10-29T12:00:00Z" });
    expect(e.trial?.beta).toBe(true);
    expect(e.trial?.endsAt).toBe("2026-11-08T06:00:00.000Z");
  });
  it("cuenta de la beta sin tarjeta: el aviso pide agregarla", () => {
    expect(entitlementsFrom({ ...beta, createdAt: daysAgo(30) }).cardStep).toBe("beta");
  });
  it("0045: del 1 al 7 de noviembre una cuenta de la beta sigue gratis (con la oferta de la tarjeta); desde el 8, muro", () => {
    const during = entitlementsFrom({ ...beta, now: new Date("2026-11-02T12:00:00Z"), createdAt: "2026-10-01T12:00:00Z" });
    expect(during).toMatchObject({ locked: false, access: "trial", cardStep: "trial" });
    expect(during.trial?.endsAt).toBe("2026-11-08T06:00:00.000Z");
    expect(entitlementsFrom({ ...beta, now: new Date("2026-11-08T06:00:00Z"), createdAt: "2026-10-01T12:00:00Z" }).locked).toBe(true);
  });
  it("con plan pagado no se muestra la beta", () => {
    const e = entitlementsFrom({ ...beta, createdAt: daysAgo(30), profilePlan: "completo" });
    expect(e.trial).toBeNull();
  });
});

describe("regalos de meses (0025)", () => {
  const g = (o: Partial<CompRow>): CompRow => comp({ source: "regalo", ...o });
  it("regalo de Entreno + Nutrición: todo", () => {
    const e = entitlementsFrom({ ...base, createdAt: daysAgo(90), comps: [g({ plan: "completo" })] });
    expect(e).toMatchObject({ plan: "completo", access: "comp", app: true, nutrition: true, locked: false });
  });
  it("regalo de Entreno: app sí, nutrición no (respeta el plan regalado)", () => {
    const e = entitlementsFrom({ ...base, createdAt: daysAgo(90), comps: [g({ plan: "entreno" })] });
    expect(e).toMatchObject({ plan: "entreno", access: "comp", app: true, nutrition: false, locked: false });
  });
  it("recompensa por referidos se comporta igual que un regalo", () => {
    expect(entitlementsFrom({ ...base, createdAt: daysAgo(90), comps: [comp({ source: "referido", plan: "entreno" })] }).nutrition).toBe(false);
  });
  it("un regalo programado (empieza después) todavía no da acceso", () => {
    const e = entitlementsFrom({ ...base, createdAt: daysAgo(90), comps: [g({ starts_at: inDays(3), expires_at: inDays(33) })] });
    expect(e.locked).toBe(true);
  });
  it("regalos apilados: el fin mostrado es el del último de la cadena", () => {
    const e = entitlementsFrom({ ...base, createdAt: daysAgo(90), comps: [g({ starts_at: daysAgo(5), expires_at: inDays(10) }), g({ starts_at: inDays(10), expires_at: inDays(40), created_at: daysAgo(1) })] });
    expect(e.compEndsAt).toBe(inDays(40));
  });
  it("regalo de Entreno + cortesía de siempre: gana la cortesía (completo)", () => {
    const e = entitlementsFrom({ ...base, createdAt: daysAgo(90), comps: [g({ plan: "entreno", expires_at: inDays(60) }), comp({ plan: "entreno", source: "cortesia", expires_at: inDays(5) })] });
    expect(e).toMatchObject({ plan: "completo", nutrition: true });
  });
  it("paga Completo y tiene un regalo de Entreno vigente: manda el plan pagado", () => {
    const e = entitlementsFrom({ ...base, createdAt: daysAgo(90), subs: [sub({ plan: "completo" })], comps: [g({ plan: "entreno" })] });
    expect(e).toMatchObject({ plan: "completo", access: "subscription", nutrition: true });
  });
  it("regalo revocado por fraude: sin acceso", () => {
    expect(entitlementsFrom({ ...base, createdAt: daysAgo(90), comps: [g({ revoked_at: daysAgo(1) })] }).locked).toBe(true);
  });
  it("al vencer un regalo no queda plan pegado (vale el plan previo)", () => {
    const e = entitlementsFrom({ ...base, profilePlan: "free", createdAt: daysAgo(200), comps: [g({ previous_plan: "free", starts_at: daysAgo(100), expires_at: daysAgo(10), created_at: daysAgo(100) })] });
    expect(e.locked).toBe(true);
  });
});

describe("fin de la beta: el muro aplica en el servidor", () => {
  const beta = { ...base, betaEndsAt: "2026-11-01T06:00:00.000Z" };
  it("0045: el 8 de noviembre a las 00:00 de Costa Rica se bloquea la cuenta de la beta que no pagó (no el 1)", () => {
    expect(entitlementsFrom({ ...beta, now: new Date("2026-11-01T06:00:00Z"), createdAt: "2026-09-01T00:00:00Z" }).locked).toBe(false);
    expect(entitlementsFrom({ ...beta, now: new Date("2026-11-08T05:59:59Z"), createdAt: "2026-09-01T00:00:00Z" }).locked).toBe(false);
    const after = entitlementsFrom({ ...beta, now: new Date("2026-11-08T06:00:00Z"), createdAt: "2026-09-01T00:00:00Z" });
    expect(after).toMatchObject({ locked: true, app: false, nutrition: false, access: "none" });
  });
  it("quien se registró en la última semana de la beta sin tarjeta: muro desde el 8 de noviembre, sin más días", () => {
    const e = entitlementsFrom({ ...beta, now: new Date("2026-11-08T12:00:00Z"), createdAt: "2026-10-30T12:00:00Z" });
    expect(e).toMatchObject({ locked: true, access: "none", cardStep: "pay" });
    expect(e.trialEndsAt).toBe("2026-11-08T06:00:00.000Z");
  });
  it("cuenta de la beta con tarjeta guardada: si el cobro del 8 de noviembre aún no se confirma, muro", () => {
    const tc = { ...trialCharge(10), kind: "beta" as const, trial_started_at: "2026-10-25T12:00:00.000Z", trial_ends_at: "2026-11-08T06:00:00.000Z", charge_at: "2026-11-08T06:00:00.000Z", next_attempt_at: "2026-11-08T06:00:00.000Z" };
    const e = entitlementsFrom({ ...beta, now: new Date("2026-11-08T07:00:00Z"), createdAt: "2026-10-01T12:00:00Z", trialCharge: tc, card: CARD });
    expect(e).toMatchObject({ locked: true, cardStep: "none" });
    expect(e.charge?.due).toBe(true);
  });
  it("cuenta nueva desde el 1 de noviembre: prueba con tarjeta", () => {
    const now = new Date("2026-11-03T12:00:00Z");
    const tc = trialCharge(0, { trial_started_at: "2026-11-02T12:00:00.000Z", trial_ends_at: "2026-11-09T12:00:00.000Z", charge_at: "2026-11-09T12:00:00.000Z", next_attempt_at: "2026-11-09T12:00:00.000Z" });
    expect(entitlementsFrom({ ...beta, now, createdAt: "2026-11-02T11:00:00Z", trialCharge: tc, card: CARD })).toMatchObject({ locked: false, access: "trial" });
    expect(entitlementsFrom({ ...beta, now, createdAt: "2026-11-02T11:00:00Z" })).toMatchObject({ locked: false, access: "trial", cardStep: "trial" });
  });
  it("con un regalo o un plan pagado no se bloquea", () => {
    const now = new Date("2026-11-05T12:00:00Z");
    expect(entitlementsFrom({ ...beta, now, createdAt: "2026-09-01T00:00:00Z", comps: [comp({ source: "regalo", starts_at: "2026-11-01T06:00:00Z", expires_at: "2027-02-01T06:00:00Z" })] }).locked).toBe(false);
  });
});
