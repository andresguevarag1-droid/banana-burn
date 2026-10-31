import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { entitlementsFrom, type CompRow, type Entitlements, type SubscriptionRow } from "./entitlements";
import { canUpsellNutrition } from "./plan-access";
import { NutritionUpsell } from "@/components/nutrition-upsell";

// QA #111: la regla de exclusión se prueba con accesos reales de entitlementsFrom, y la pantalla Comida bloqueada se renderiza.
const NOW = new Date("2026-11-20T12:00:00Z");
const AFTER_BETA = "2026-11-01T06:00:00.000Z";
const day = (n: number) => new Date(NOW.getTime() + n * 864e5).toISOString();
const sub = (o: Partial<SubscriptionRow> = {}): SubscriptionRow => ({
  id: 1, user_id: "u", provider_customer_id: "c", provider_subscription_id: "s", status: "active", price_id: "p", plan: "entreno", billing: "mes",
  cancel_at_period_end: false, canceled_at: null, current_period_start: day(-5), current_period_end: day(25), created_at: day(-5), ...o,
});
const comp = (o: Partial<CompRow> = {}): CompRow => ({ plan: "entreno", previous_plan: "free", starts_at: day(-2), expires_at: day(20), revoked_at: null, created_at: day(-2), ...o });
const base = { profilePlan: "free", role: "free", now: NOW, subs: [] as SubscriptionRow[], betaEndsAt: AFTER_BETA, createdAt: day(-60) };

describe("QA #111: a quién se le ofrece Entreno + Nutrición", () => {
  it("se ofrece a Entreno pagado, mensual o anual, también si está por cancelar", () => {
    expect(canUpsellNutrition(entitlementsFrom({ ...base, subs: [sub()] }), false)).toBe(true);
    expect(canUpsellNutrition(entitlementsFrom({ ...base, subs: [sub({ billing: "anual", current_period_end: day(300) })] }), false)).toBe(true);
    expect(canUpsellNutrition(entitlementsFrom({ ...base, subs: [sub({ cancel_at_period_end: true })] }), false)).toBe(true);
  });
  it("no se ofrece a quien ya tiene nutrición, está en prueba, en la beta o con cortesía", () => {
    const cases: [string, Entitlements, boolean][] = [
      ["Entreno + Nutrición pagado", entitlementsFrom({ ...base, subs: [sub({ plan: "completo" })] }), false],
      ["prueba de 7 días", entitlementsFrom({ ...base, createdAt: day(-2) }), false],
      ["beta en curso", entitlementsFrom({ ...base, createdAt: day(-2), betaEndsAt: day(5) }), true],
      ["gracia de la beta tras el lanzamiento", entitlementsFrom({ ...base, createdAt: "2026-10-20T00:00:00Z", now: new Date("2026-11-03T12:00:00Z") }), false],
      ["regalo de Entreno", entitlementsFrom({ ...base, comps: [comp()] }), false],
      ["cortesía", entitlementsFrom({ ...base, comps: [comp({ plan: "completo" })] }), false],
      ["Entreno pagado con regalo de Entreno encima", entitlementsFrom({ ...base, subs: [sub()], comps: [comp()] }), false],
      ["staff", entitlementsFrom({ ...base, role: "admin" }), false],
      ["plan asignado a mano", entitlementsFrom({ ...base, profilePlan: "entreno" }), false],
      ["suscripción vencida", entitlementsFrom({ ...base, subs: [sub({ status: "canceled", current_period_end: day(-3) })] }), false],
    ];
    for (const [name, ent, beta] of cases) expect(canUpsellNutrition(ent, beta), name).toBe(false);
  });
});

describe("QA #111: marca y copia de la invitación", () => {
  it("sin emojis, sin IA, sin exclamaciones y sin aviso GLP-1 cuando el objetivo es fuerza", () => {
    for (const goal of ["protein", "strength"] as const) for (const compact of [false, true]) {
      const text = renderToStaticMarkup(<NutritionUpsell goal={goal} compact={compact} />).replace(/<[^>]+>/g, " ");
      expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(text).not.toMatch(/\bIA\b|inteligencia artificial/i);
      expect(text).not.toMatch(/[!¡—]/);
      expect(text.includes("No sustituye la indicación de tu médico.")).toBe(goal === "protein");
    }
  });
  it("la tarjeta del cierre es un h2 (el resumen ya tiene su h1) y la pantalla Comida un h1", () => {
    expect(renderToStaticMarkup(<NutritionUpsell goal="strength" compact />)).toMatch(/<h2[^>]*>Comer para tu objetivo<\/h2>/);
    expect(renderToStaticMarkup(<NutritionUpsell goal="protein" />)).toMatch(/<h1[^>]*>Proteína primero/);
  });
});

const mocks = vi.hoisted(() => ({ ent: {} as Record<string, unknown>, athlete: {} as Record<string, unknown>, mealsRead: 0 }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", async (orig) => ({ ...(await orig<object>()), getViewer: async () => ({ id: "u", demo: false }) }));
vi.mock("@/lib/entitlements", async (orig) => ({ ...(await orig<object>()), getEntitlements: async () => mocks.ent }));
vi.mock("@/lib/athlete", async (orig) => ({ ...(await orig<object>()), getAthlete: async () => mocks.athlete }));
vi.mock("@/lib/meals", () => ({ getMeals: async () => { mocks.mealsRead++; return []; }, getNutritionExtras: async () => { mocks.mealsRead++; return {}; } }));
vi.mock("@/lib/plans", async (orig) => ({ ...(await orig<object>()), betaLive: () => false }));

const ENTRENO = { plan: "entreno", app: true, nutrition: false, trial: null, access: "subscription", status: "active" };
const athlete = (o: object = {}) => ({ currentWeight: 90, goalWeight: 80, glp1: { on: false }, ...o });
async function comida() {
  const { default: Nutricion } = await import("@/app/(app)/app/nutricion/page");
  return renderToStaticMarkup((await Nutricion()) as ReactElement);
}

describe("QA #111: pantalla Comida bloqueada", () => {
  beforeEach(() => { mocks.mealsRead = 0; });
  it("Entreno que baja de peso: proteína primero, precios, aviso médico y enlace a Mi plan", async () => {
    mocks.ent = ENTRENO; mocks.athlete = athlete();
    const html = await comida();
    expect(html).toContain("Proteína primero");
    expect(html).toContain("No sustituye la indicación de tu médico.");
    expect(html).toContain("$14.99/mes o $89.99/año");
    expect(html).toContain('href="/app/suscripcion"');
    expect(html).toContain('data-cta="nutricion-mejorar"');
    expect(mocks.mealsRead).toBe(0);
  });
  it("Entreno con GLP-1 también ve proteína primero aunque no quiera bajar de peso", async () => {
    mocks.ent = ENTRENO; mocks.athlete = athlete({ goalWeight: 95, glp1: { on: true } });
    expect(await comida()).toContain("Proteína primero");
  });
  it("Entreno que gana fuerza: mensaje de fuerza, sin aviso GLP-1", async () => {
    mocks.ent = ENTRENO; mocks.athlete = athlete({ goalWeight: 95 });
    const html = await comida();
    expect(html).toContain("Alimenta la fuerza");
    expect(html).not.toContain("GLP-1");
  });
  it("sin invitación para quien no puede mejorar: solo el enlace a Mi plan, sin precios", async () => {
    for (const ent of [{ ...ENTRENO, access: "comp" }, { ...ENTRENO, plan: "free", app: false, access: "none", status: "expired" }, { ...ENTRENO, status: "incomplete" }]) {
      mocks.ent = ent; mocks.athlete = athlete();
      const html = await comida();
      expect(html).not.toContain("US$");
      expect(html).not.toContain("nutrition_upsell");
      expect(html).toContain('href="/app/suscripcion"');
      expect(mocks.mealsRead).toBe(0);
    }
  });
});
