import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { canUpsellNutrition, nutritionUpsellDue, NUTRITION_UPSELL_INTERVAL } from "./plan-access";
import { NutritionUpsell } from "@/components/nutrition-upsell";
import { PLANS } from "./plans";
import { usd2 } from "./num";

const paid = { plan: "entreno", app: true, nutrition: false, trial: null, access: "subscription", status: "active" };
describe("invitación a nutrición", () => {
  it("solo aparece con Entreno pagado y sin acceso especial", () => {
    expect(canUpsellNutrition(paid, false)).toBe(true);
    expect(canUpsellNutrition(paid, true)).toBe(false);
    for (const override of [{ nutrition: true }, { plan: "completo" }, { trial: {} }, { access: "comp" }, { access: "staff" }, { access: "manual" }, { access: "demo" }, { app: false }, { status: "trialing" }, { status: "expired" }, { status: "incomplete" }, { compEndsAt: "2027-01-01" }]) {
      expect(canUpsellNutrition({ ...paid, ...override }, false)).toBe(false);
    }
  });
  it("espera siete días completos y descarta marcas inválidas o futuras", () => {
    const now = 1800000000000;
    expect(nutritionUpsellDue(null, now)).toBe(true);
    expect(nutritionUpsellDue(String(now - NUTRITION_UPSELL_INTERVAL + 1), now)).toBe(false);
    expect(nutritionUpsellDue(String(now - NUTRITION_UPSELL_INTERVAL), now)).toBe(true);
    expect(nutritionUpsellDue("invalid", now)).toBe(false);
    expect(nutritionUpsellDue(String(now + 1), now)).toBe(false);
  });
  it("muestra precios vigentes y lleva al manager sin iniciar cobros", () => {
    const plan = PLANS.find(p => p.id === "completo")!;
    for (const compact of [false, true]) {
      const html = renderToStaticMarkup(<NutritionUpsell goal="protein" compact={compact} />);
      expect(html).toContain(usd2(plan.price.mes));
      expect(html).toContain(usd2(plan.price.anual));
      expect(html).toContain('href="/app/suscripcion"');
      expect(html).toContain("No sustituye la indicación de tu médico.");
      expect(html).toContain("proteína");
    }
    expect(renderToStaticMarkup(<NutritionUpsell goal="strength" />)).toContain("Alimenta la fuerza");
  });
});
