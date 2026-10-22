import { describe, expect, it } from "vitest";
import { money, noBreakGlp1, trialEnd, TRIAL_DAYS } from "./copy";

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
