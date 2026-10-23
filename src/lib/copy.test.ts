import { describe, expect, it } from "vitest";
import { money, noBreakGlp1, progressLine, recommendPlan, trialEnd, trialNudge, TRIAL_DAYS } from "./copy";

describe("money", () => {
  it("siempre dos decimales con punto", () => {
    expect(money(5)).toBe("$5.00");
    expect(money(7.5)).toBe("$7.50");
    expect(money(59.99)).toBe("$59.99");
    expect(money(89.99 / 12)).toBe("$7.50");
  });
});

describe("trialEnd", () => {
  it("suma los días de prueba a la creación de la cuenta", () => {
    expect(TRIAL_DAYS).toBe(7);
    expect(trialEnd("2026-10-22T12:00:00Z")?.toISOString()).toBe("2026-10-29T12:00:00.000Z");
  });
  it("fechas inválidas", () => {
    expect(trialEnd(null)).toBeNull();
    expect(trialEnd("no")).toBeNull();
  });
});

describe("noBreakGlp1", () => {
  it("cambia el guion por uno no separable", () => {
    expect(noBreakGlp1("Banana Shield para personas en GLP-1")).toBe("Banana Shield para personas en GLP‑1");
  });
});

describe("trialNudge", () => {
  it("día 1, días 5 y 6, día 7", () => {
    expect(trialNudge(7)).toMatchObject({ day: 1, tone: "start" });
    expect(trialNudge(5)).toMatchObject({ day: 3, tone: "calm", title: "Te quedan 5 días de prueba" });
    expect(trialNudge(3)).toMatchObject({ day: 5, tone: "warn" });
    expect(trialNudge(2)).toMatchObject({ day: 6, tone: "warn" });
    expect(trialNudge(1)).toMatchObject({ day: 7, tone: "last", title: "Hoy termina tu prueba gratis" });
  });
  it("valores fuera de rango", () => {
    expect(trialNudge(0).tone).toBe("last");
    expect(trialNudge(99).day).toBe(1);
  });
});

describe("recommendPlan", () => {
  it("nutrición o GLP-1 recomiendan el plan completo", () => {
    expect(recommendPlan({ meals: 0, glp1: false })).toBe("entreno");
    expect(recommendPlan({ meals: 3, glp1: false })).toBe("completo");
    expect(recommendPlan({ meals: 0, glp1: true })).toBe("completo");
  });
});

describe("progressLine", () => {
  it("entrenos y kilos bajados", () => {
    expect(progressLine({ workouts: 5, firstKg: 94, lastKg: 92.8 })).toBe("Llevas 5 entrenos y −1,2 kg");
    expect(progressLine({ workouts: 1, firstKg: null, lastKg: null })).toBe("Llevas 1 entreno");
  });
  it("no muestra subidas ni ceros", () => {
    expect(progressLine({ workouts: 0, firstKg: 80, lastKg: 80.5 })).toBeNull();
    expect(progressLine({ workouts: 2, firstKg: 80, lastKg: 80.5 })).toBe("Llevas 2 entrenos");
  });
});
