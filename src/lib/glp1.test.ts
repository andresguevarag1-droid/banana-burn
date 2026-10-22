import { describe, expect, it } from "vitest";
import { glp1Targets, injectionPhase, muscleShield } from "./glp1";

describe("programa GLP-1", () => {
  it("proteína 1,2–1,6 g/kg del peso actual y nunca ≥ 2 g/kg", () => {
    const t = glp1Targets({ kg: 110, goalKg: 85, heightCm: 175, age: 40, sex: "m" });
    expect(t.protein / 110).toBeGreaterThanOrEqual(1.2);
    expect(t.protein / 110).toBeLessThan(2);
    expect(t.kcal).toBeGreaterThanOrEqual(t.kcalMin);
    expect(t.fiber).toBeGreaterThan(20);
  });
  it("piso de calorías para mujer pequeña", () => {
    const t = glp1Targets({ kg: 62, goalKg: 56, heightCm: 155, age: 50, sex: "f" });
    expect(t.kcal).toBeGreaterThanOrEqual(1300);
    expect(t.fat * 9 / t.kcal).toBeLessThanOrEqual(0.3);
  });
  it("fase de inyección", () => {
    expect(injectionPhase(1, 1)).toBe("inyeccion");
    expect(injectionPhase(6, 0)).toBe("post");
    expect(injectionPhase(null, 3)).toBe("normal");
  });
  it("músculo protegido", () => {
    const m = muscleShield({ startKg: 100, nowKg: 90, startBf: 35, nowBf: 29, strengthChangePct: 2 });
    expect(m.fatShare!).toBeGreaterThan(0.8);
    expect(m.grade).toBe("A");
    expect(muscleShield({ startKg: 100, nowKg: 90, startBf: null, nowBf: null, strengthChangePct: null }).grade).toBeNull();
  });
});
