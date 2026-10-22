import { describe, expect, it } from "vitest";
import { applyExerciseOverride, applyExerciseOverrides } from "./admin-content";

const meta = { sentadilla: { name: "Sentadilla con barra", cues: ["Pecho arriba"], enabled: true }, dips: { name: "Fondos", cues: [], enabled: false } };

describe("overrides de ejercicios del panel", () => {
  it("cambia nombre y claves", () => {
    expect(applyExerciseOverride({ id: "sentadilla", name: "Sentadilla", cues: ["a"] }, meta)).toEqual({ id: "sentadilla", name: "Sentadilla con barra", cues: ["Pecho arriba"], enabled: true });
    expect(applyExerciseOverride({ id: "otro", name: "Otro" }, meta).enabled).toBe(true);
  });
  it("un deshabilitado se reemplaza por su alternativa", () => {
    const list = [{ id: "sentadilla", name: "Sentadilla" }, { id: "dips", name: "Fondos" }];
    const out = applyExerciseOverrides(list, meta, (e) => (e.id === "dips" ? { id: "flexiones", name: "Flexiones" } : null));
    expect(out.map((e) => e.id)).toEqual(["sentadilla", "flexiones"]);
    expect(applyExerciseOverrides(list, meta).map((e) => e.id)).toEqual(["sentadilla"]);
  });
});
