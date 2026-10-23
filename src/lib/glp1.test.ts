import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { KCAL_FLOOR, glp1Targets, injectionPhase, kcalFloor, muscleShield, weightNear } from "./glp1";

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
  it("peso más cercano a la fecha de cada medida", () => {
    const ws = [{ d: "2026-09-01", v: 100 }, { d: "2026-09-08", v: 99 }, { d: "2026-10-01", v: 95 }, { d: "2026-10-20", v: 93.5 }];
    expect(weightNear(ws, "2026-09-02")).toBe(100);
    expect(weightNear(ws, "2026-10-18")).toBe(93.5);
    expect(weightNear(ws, "2026-09-20", 5)).toBeNull();
    expect(weightNear([], "2026-09-20")).toBeNull();
  });
  it("un solo piso de calorías para la app y el coach", () => {
    expect(kcalFloor("f")).toBe(KCAL_FLOOR.f);
    expect(kcalFloor("m")).toBe(KCAL_FLOOR.m);
    const t = glp1Targets({ kg: 50, goalKg: 48, heightCm: 150, age: 70, sex: "f" });
    expect(t.kcalMin).toBeGreaterThanOrEqual(KCAL_FLOOR.f);
    const coach = readFileSync(new URL("./coach.ts", import.meta.url), "utf8");
    const fmt = (n: number) => n.toLocaleString("es-419");
    expect(coach).toContain(`${fmt(KCAL_FLOOR.m)} kcal (hombres) / ${fmt(KCAL_FLOOR.f)} (mujeres)`);
  });
});
