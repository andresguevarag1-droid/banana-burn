import { describe, expect, it } from "vitest";
import { entitlementsFrom, type CompRow, type SubscriptionRow } from "./entitlements";
import { hasNutrition } from "./plans";

const NOW = new Date("2026-10-22T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 864e5).toISOString();
const inDays = (n: number) => new Date(NOW.getTime() + n * 864e5).toISOString();

const sub = (o: Partial<SubscriptionRow>): SubscriptionRow => ({
  id: 1, user_id: "u", provider_customer_id: "c", provider_subscription_id: "s", status: "active", price_id: "p", plan: "entreno", billing: "mes",
  cancel_at_period_end: false, canceled_at: null, current_period_start: daysAgo(5), current_period_end: inDays(25), created_at: daysAgo(5), ...o,
});
const comp = (o: Partial<CompRow>): CompRow => ({ plan: "entreno", previous_plan: "free", starts_at: daysAgo(2), expires_at: inDays(20), revoked_at: null, created_at: daysAgo(2), ...o });
const base = { profilePlan: "free", role: "free", now: NOW, subs: [] as SubscriptionRow[] };

describe("acceso: prueba gratis de 7 días", () => {
  it("cuenta nueva: todo incluido y días restantes", () => {
    const e = entitlementsFrom({ ...base, createdAt: daysAgo(2) });
    expect(e).toMatchObject({ access: "trial", app: true, nutrition: true, locked: false, plan: "free" });
    expect(e.trial?.daysLeft).toBe(5);
  });
  it("último día de prueba muestra 1 día", () => {
    const e = entitlementsFrom({ ...base, createdAt: daysAgo(6.9) });
    expect(e.trial?.daysLeft).toBe(1);
  });
  it("prueba vencida y sin plan: bloqueado (muro)", () => {
    const e = entitlementsFrom({ ...base, createdAt: daysAgo(8) });
    expect(e).toMatchObject({ access: "none", app: false, nutrition: false, locked: true, trial: null });
    expect(e.trialEndsAt).toBe(daysAgo(1));
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
