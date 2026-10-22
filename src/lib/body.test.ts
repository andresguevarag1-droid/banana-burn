import { describe, expect, it } from "vitest";
import { navyBodyFat } from "./body";

describe("grasa corporal (Marina EE. UU.)", () => {
  it("hombre 182 cm, cintura 98, cuello 40 ≈ 22 %", () => {
    const v = navyBodyFat({ sex: "m", heightCm: 182, waist: 98, neck: 40 })!;
    expect(v).toBeGreaterThan(19); expect(v).toBeLessThan(25);
  });
  it("mujer requiere cadera", () => expect(navyBodyFat({ sex: "f", heightCm: 165, waist: 75, neck: 32 })).toBeNull());
  it("datos inválidos", () => expect(navyBodyFat({ sex: "m", heightCm: 180, waist: 30, neck: 40 })).toBeNull());
});
