import { describe, expect, it } from "vitest";
import { APP_LOCKED_MSG, NUTRITION_LOCKED_MSG, NUTRITION_PLAN_NAME, canSetDaily, challengeNeedsNutrition, hoyTip } from "./plan-access";
import { PLANS, PREMIUM_RETOS_NOTE } from "./plans";

const ENTRENO = { app: true, nutrition: false };
const COMPLETO = { app: true, nutrition: true };
const LOCKED = { app: false, nutrition: false };

describe("registro diario por plan", () => {
  it("agua, pasos, sueño y energía: cualquier plan con acceso", () => {
    for (const f of ["water", "steps", "sleep", "energy"]) {
      expect(canSetDaily(f, ENTRENO)).toBe(true);
      expect(canSetDaily(f, COMPLETO)).toBe(true);
      expect(canSetDaily(f, LOCKED)).toBe(false);
    }
  });
  it("calorías, proteína, fibra y náusea: solo con nutrición", () => {
    for (const f of ["kcal", "protein", "fiber", "nausea"]) {
      expect(canSetDaily(f, ENTRENO)).toBe(false);
      expect(canSetDaily(f, COMPLETO)).toBe(true);
    }
  });
  it("campos desconocidos o heredados del prototipo: no", () => {
    expect(canSetDaily("toString", COMPLETO)).toBe(false);
    expect(canSetDaily("constructor", COMPLETO)).toBe(false);
    expect(canSetDaily("xp", COMPLETO)).toBe(false);
  });
});

describe("retos que piden nutrición", () => {
  it("solo los que se verifican con la meta de proteína", () => {
    expect(challengeNeedsNutrition({ verify: "protein" })).toBe(true);
    for (const v of ["manual", "workout", "steps", "water"]) expect(challengeNeedsNutrition({ verify: v })).toBe(false);
  });
});

describe("consejo de Hoy", () => {
  const all = (nutrition: boolean) => [0, 1, 2, 3, 4, 5, 6].flatMap((dow) => [true, false].flatMap((training) => [true, false].flatMap((trained) => [0, 50, 150].map((proteinLeft) => hoyTip({ dow, training, trained, proteinLeft, nutrition })))));
  it("sin nutrición nunca da gramos ni calorías", () => {
    for (const t of all(false)) {
      expect(t).not.toMatch(/\d+\s*g\b|kcal|gramos|tragos/);
      expect(t).not.toMatch(/—/);
    }
  });
  it("con nutrición puede decir cuántos gramos de proteína faltan", () => {
    expect(hoyTip({ dow: 2, training: true, trained: true, proteinLeft: 60, nutrition: true })).toContain("60 g");
  });
});

describe("textos de los planes", () => {
  it("el nombre del plan con nutrición coincide con PLANS", () => {
    expect(PLANS.find((p) => p.nutrition)!.name).toBe(NUTRITION_PLAN_NAME);
    expect(NUTRITION_LOCKED_MSG).toContain(NUTRITION_PLAN_NAME);
    expect(APP_LOCKED_MSG.length).toBeGreaterThan(0);
  });
  it("Entreno no promete nada de nutrición y lo dice en lo que no incluye", () => {
    const e = PLANS.find((p) => p.id === "entreno")!;
    expect(e.feats.join(" ")).not.toMatch(/calor|macro|comida|receta|men[uú]|Shield|GLP/i);
    expect(e.excluded.join(" ")).toMatch(/Calorías/);
    expect(e.excluded.join(" ")).toMatch(/comidas/);
    expect(e.excluded.join(" ")).toMatch(/Banana Shield/);
    expect(e.feats.join(" ")).toMatch(/Comunidad/);
    expect(e.feats.join(" ")).toMatch(/retos gratis/);
    expect(e.feats.join(" ")).toMatch(/agua, pasos y sueño/);
  });
  it("Completo incluye todo lo de Entreno y no excluye nada", () => {
    const c = PLANS.find((p) => p.id === "completo")!;
    expect(c.feats[0]).toBe("Todo lo de Entreno");
    expect(c.excluded).toEqual([]);
  });
  it("ningún plan dice incluir retos Premium; la nota aclara que se compran aparte", () => {
    for (const p of PLANS) expect(p.feats.join(" ")).not.toMatch(/Premium/i);
    expect(PREMIUM_RETOS_NOTE).toMatch(/aparte/);
  });
  it("sin raya larga ni puntos medios en los textos de plan", () => {
    const txt = PLANS.flatMap((p) => [...p.feats, ...p.excluded, p.tagline]).join(" ") + PREMIUM_RETOS_NOTE;
    expect(txt).not.toMatch(/[—·]/);
  });
});
