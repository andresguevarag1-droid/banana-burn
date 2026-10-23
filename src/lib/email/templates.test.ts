import { describe, expect, it } from "vitest";
import { bienvenida, planListo, regalo } from "./templates";

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

describe("correo de regalo", () => {
  const base = { name: "Ana López", months: 3, plan: "Entreno + Nutrición", source: "regalo" as const, startsAt: "2026-12-01T12:00:00Z", expiresAt: "2027-03-01T12:00:00Z", startsNow: true };
  it("dice cuánto, de qué plan y hasta cuándo", () => {
    const e = regalo(base);
    expect(e.subject).toBe("Ana, te regalaron 3 meses de Entreno + Nutrición");
    expect(e.text).toContain("Hasta:");
    expect(e.html).toContain("/app/suscripcion");
  });
  it("escapa el mensaje personal", () => {
    const e = regalo({ ...base, message: "<img src=x onerror=alert(1)>" });
    expect(e.html).not.toContain("<img src=x");
    expect(e.html).toContain("&lt;img");
  });
  it("recompensa por referidos y regalo programado", () => {
    const e = regalo({ ...base, source: "referido", months: 1, startsNow: false });
    expect(e.subject).toBe("Ganaste 1 mes gratis de Entreno + Nutrición");
    expect(e.preheader).toMatch(/Empieza el/);
  });
  it("sin emojis ni menciones de IA", () => {
    const e = regalo(base);
    expect(e.text + e.html).not.toMatch(/\bIA\b|inteligencia artificial|[\u{1F300}-\u{1FAFF}]/u);
    expect(bienvenida({ name: "Ana" }).text).not.toMatch(/\bIA\b/);
  });
});
