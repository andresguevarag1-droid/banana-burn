import { describe, expect, it } from "vitest";
import { normalizeWorkout, serverPrs, workoutTiming, type Finished } from "./validate";

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

describe("workoutTiming", () => {
  const now = Date.parse("2026-10-22T18:00:00.000Z");
  const iso = (ms: number) => new Date(ms).toISOString();
  it("respeta inicio y fin del navegador en un entreno normal", () => {
    const t = workoutTiming(iso(now - 3600_000), iso(now - 60_000), now);
    expect(t.clientStart).toBe(true);
    expect(t.seconds).toBe(3540);
    expect(t.startIso).toBe(iso(now - 3600_000));
  });
  it("un entreno guardado sin señal un día después conserva su hora", () => {
    const start = now - 26 * 3600_000;
    const t = workoutTiming(iso(start), iso(start + 50 * 60_000), now);
    expect(t.clientStart).toBe(true);
    expect(t.started).toBe(start);
    expect(t.seconds).toBe(3000);
  });
  it("sin fin válido la duración nunca pasa de 6 horas", () => {
    const t = workoutTiming(iso(now - 30 * 3600_000), undefined, now);
    expect(t.seconds).toBe(6 * 3600);
  });
  it("inicio inválido, muy viejo o en el futuro: usa la hora del servidor", () => {
    for (const s of ["", "no-es-fecha", iso(now - 80 * 3600_000), iso(now + 3600_000)]) {
      const t = workoutTiming(s, iso(now), now);
      expect(t.clientStart).toBe(false);
      expect(t.started).toBe(now);
      expect(t.seconds).toBe(0);
    }
  });
  it("un fin antes del inicio o de una sesión de más de 6 h se ignora", () => {
    expect(workoutTiming(iso(now - 3600_000), iso(now - 7200_000), now).seconds).toBe(3600);
    expect(workoutTiming(iso(now - 10 * 3600_000), iso(now), now).seconds).toBe(6 * 3600);
  });
  it("la misma entrada da la misma hora de inicio (sirve para reconocer el doble envío)", () => {
    const a = workoutTiming(iso(now - 1000), undefined, now), b = workoutTiming(iso(now - 1000), undefined, now + 5000);
    expect(a.startIso).toBe(b.startIso);
  });
});

describe("normalizeWorkout finishedAt", () => {
  it("acepta finishedAt corto y descarta lo demás", () => {
    expect(normalizeWorkout(base({ finishedAt: "2026-10-22T13:00:00.000Z" }))!.finishedAt).toBe("2026-10-22T13:00:00.000Z");
    expect(normalizeWorkout(base({ finishedAt: "x".repeat(200) }))!.finishedAt).toBeUndefined();
  });
});
