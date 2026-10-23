import { describe, expect, it } from "vitest";
import { bienvenida, planListo } from "./templates";

const base = { name: "Ana López", trainDays: 4, todayRoutine: "Pierna", goalWeight: 68, goalDate: "2027-03-01" };

describe("correo de plan listo según el plan", () => {
  it("con nutrición muestra calorías y proteína", () => {
    const e = planListo({ ...base, kcal: 1850, protein: 130, minutes: 45 });
    expect(e.text).toContain("kcal/día");
    expect(e.text).toContain("130 g de proteína");
    expect(e.html).toContain("kcal/día");
  });
  it("sin nutrición (Entreno) no muestra calorías ni proteína", () => {
    const e = planListo({ ...base, minutes: 45 });
    expect(e.text + e.html).not.toMatch(/kcal|proteína/);
    expect(e.text).toContain("45 min por sesión");
  });
});

describe("correo de bienvenida", () => {
  it("español neutro, sin modismos de un solo país", () => {
    const e = bienvenida({ name: "Ana" });
    expect(e.text + e.html).not.toMatch(/pura vida|comida tica/i);
  });
});
