import { describe, expect, it } from "vitest";
import { clamp01, frac } from "./num";

describe("frac y clamp01", () => {
  it("no deja pasar NaN ni Infinity", () => {
    expect(frac(5, 0)).toBe(0);
    expect(frac(0, 0)).toBe(0);
    expect(frac(NaN, 3)).toBe(0);
    expect(frac(3, 4)).toBe(0.75);
    expect(clamp01(Infinity)).toBe(0);
    expect(clamp01(NaN, 0.02)).toBe(0.02);
    expect(clamp01(1.4)).toBe(1);
  });
});
