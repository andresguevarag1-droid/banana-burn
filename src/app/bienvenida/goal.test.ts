import { describe, expect, it } from "vitest";
import { goalError, paceFor, suggestDate } from "./goal";

const base = { weight: 80, heightCm: 175 };

describe("goalError", () => {
  it("fuerza permite una meta mayor al peso actual", () => {
    expect(goalError({ ...base, goal: "fuerza", goalWeight: 86 })).toBeNull();
    expect(goalError({ ...base, goal: "fuerza", goalWeight: 80 })).toBeNull();
  });
  it("grasa no permite subir de peso y sugiere fuerza", () => {
    expect(goalError({ ...base, goal: "grasa", goalWeight: 82 })).toMatch(/Ganar fuerza/);
    expect(goalError({ ...base, goal: "grasa", goalWeight: 80 })).toBeNull();
  });
  it("recomposición acepta una meta cercana al peso actual", () => {
    expect(goalError({ ...base, goal: "recomp", goalWeight: 82 })).toBeNull();
    expect(goalError({ ...base, goal: "recomp", goalWeight: 85 })).toMatch(/Ganar fuerza/);
  });
  it("ningún objetivo acepta una meta con IMC bajo 18.5", () => {
    expect(goalError({ ...base, goal: "fuerza", goalWeight: 50 })).toMatch(/mínimo 57 kg/);
  });
  it("valores vacíos", () => expect(goalError({ ...base, goal: "grasa", goalWeight: 0 })).not.toBeNull());
});

describe("paceFor", () => {
  const now = new Date("2026-01-01T12:00:00");
  it("bajar a ritmo sano", () => {
    const p = paceFor({ goal: "grasa", weight: 80, goalWeight: 76, goalDate: "2026-02-26", now });
    expect(p.direction).toBe("baja"); expect(p.tooFast).toBe(false); expect(p.body).toMatch(/Perderás grasa/);
  });
  it("fuerza con meta mayor no dice que perderás grasa", () => {
    const p = paceFor({ goal: "fuerza", weight: 80, goalWeight: 83, goalDate: "2026-04-30", now });
    expect(p.direction).toBe("sube"); expect(p.body).not.toMatch(/Perderás grasa/); expect(p.tooFast).toBe(false);
  });
  it("subir muy rápido avisa", () => {
    expect(paceFor({ goal: "fuerza", weight: 80, goalWeight: 88, goalDate: "2026-02-01", now }).tooFast).toBe(true);
  });
  it("recomposición manteniendo el peso", () => {
    expect(paceFor({ goal: "recomp", weight: 80, goalWeight: 80, goalDate: "2026-03-01", now }).direction).toBe("mantiene");
  });
});

describe("suggestDate", () => {
  const from = new Date(2026, 0, 1, 12); // mediodía local: la fecha sugerida es local (la del teléfono), no UTC
  it("al menos 4 semanas", () => expect(suggestDate(80, 80, from).date).toBe("2026-01-29"));
  it("las ganancias van más lento que las pérdidas", () => {
    expect(suggestDate(80, 84, from).date > suggestDate(80, 76, from).date).toBe(true);
  });
});
