import { describe, expect, it } from "vitest";
import { recapFrom } from "./week-recap";

describe("Tu semana con Banana Burn", () => {
  it("sin entrenos no hay resumen", () => expect(recapFrom({ weekOf: "2026-10-19", workouts: 0, sets: 0, planned: 4, heavier: [], moreReps: 0 })).toBeNull());
  it("cuenta constancia y explica qué cambia por lo que anotó", () => {
    const r = recapFrom({ weekOf: "2026-10-19", workouts: 4, sets: 60, planned: 4, heavier: ["Sentadilla", "Press de banca"], moreReps: 3 })!;
    expect(r.consistency).toBe(1);
    expect(r.headline).toMatch(/todos tus entrenos/);
    expect(r.changes[0]).toContain("2 ejercicios");
    expect(r.changes[1]).toContain("3 ejercicios");
  });
  it("una semana floja no regaña", () => {
    const r = recapFrom({ weekOf: "2026-10-19", workouts: 1, sets: 12, planned: 4, heavier: [], moreReps: 0 })!;
    expect(r.headline).toBe("Entrenaste, y eso suma. Esta semana busca uno más.");
    expect(r.changes[0]).toMatch(/Sigue anotando/);
  });
});
