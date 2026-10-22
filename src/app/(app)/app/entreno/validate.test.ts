import { describe, expect, it } from "vitest";
import { normalizeWorkout, serverPrs, type Finished } from "./validate";

const base = (p: Partial<Finished> = {}): Finished => ({ template: "pushA", startedAt: "2026-10-22T12:00:00.000Z", fun: 4, exercises: [{ id: "bench", sets: [{ kg: 80, reps: 8, rir: 2 }] }], ...p });

describe("normalizeWorkout", () => {
  it("acepta ejercicios de la biblioteca (ds:1234)", () => {
    const w = normalizeWorkout(base({ exercises: [{ id: "ds:0314", sets: [{ kg: 20, reps: 10, rir: 2 }] }, { id: "goblet", sets: [] }] }))!;
    expect(w.exercises.map((e) => e.id)).toEqual(["ds:0314", "goblet"]);
  });
  it("rechaza ids raros", () => {
    expect(normalizeWorkout(base({ exercises: [{ id: "ds:../x", sets: [] }] }))).toBeNull();
    expect(normalizeWorkout(base({ exercises: [{ id: "x:1", sets: [] }] }))).toBeNull();
    expect(normalizeWorkout(base({ exercises: [{ id: "", sets: [] }] }))).toBeNull();
  });
  it("RIR 0 (al límite) es válido y se conserva", () => {
    expect(normalizeWorkout(base({ exercises: [{ id: "bench", sets: [{ kg: 80, reps: 8, rir: 0 }] }] }))!.exercises[0].sets[0].rir).toBe(0);
    expect(normalizeWorkout(base({ exercises: [{ id: "bench", sets: [{ kg: 80, reps: 8, rir: null }] }] }))!.exercises[0].sets[0].rir).toBeNull();
  });
  it("diversión opcional: sin respuesta queda en null", () => {
    expect(normalizeWorkout(base({ fun: null }))!.fun).toBeNull();
    expect(normalizeWorkout(base({ fun: 9 }))!.fun).toBeNull();
    expect(normalizeWorkout(base({ fun: 5 }))!.fun).toBe(5);
  });
});

describe("récords en el servidor", () => {
  const hist = { bench: [[{ kg: 80, reps: 8 }]], squat: [[{ kg: 100, reps: 5 }]] };
  it("solo cuenta si supera el historial guardado", () => {
    expect(serverPrs([{ id: "bench", sets: [{ kg: 80, reps: 9, rir: 2 }] }, { id: "squat", sets: [{ kg: 100, reps: 5, rir: 2 }] }], hist)).toEqual(["bench"]);
  });
  it("sin historial no hay récord (es calibración)", () => {
    expect(serverPrs([{ id: "ds:0314", sets: [{ kg: 200, reps: 10, rir: 2 }] }], hist)).toEqual([]);
  });
  it("lo que diga el navegador no importa: mismas series, mismo resultado", () => {
    expect(serverPrs([{ id: "bench", sets: [{ kg: 70, reps: 8, rir: 2 }] }], hist)).toEqual([]);
  });
});
