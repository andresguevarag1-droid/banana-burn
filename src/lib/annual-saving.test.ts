import { describe, expect, it } from "vitest";
import { PLANS, annualSaving } from "./plans";

describe("ahorro del plan anual (en vez del 'equivale a' por mes)", () => {
  it("Entreno ahorra $59.89 y Entreno + Nutrición $89.89 al año", () => {
    expect(annualSaving(PLANS.find((p) => p.id === "entreno")!)).toBe(59.89);
    expect(annualSaving(PLANS.find((p) => p.id === "completo")!)).toBe(89.89);
  });
});
