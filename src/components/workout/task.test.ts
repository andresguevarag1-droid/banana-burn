import { describe, expect, it } from "vitest";
import { briefSteps, formatExerciseTask, leftText, planChips, plainMuscles, secondsLeft, setSeconds } from "./task";

const base = { lo: 8, hi: 12, bw: false, setNo: 2, sets: 4 };

describe("formatExerciseTask", () => {
  it("repeticiones con peso", () => {
    const t = formatExerciseTask({ ...base, reps: "10", kg: "20" });
    expect(t.line).toBe("10 repeticiones");
    expect(t.value).toBe("10");
    expect(t.load).toBe("con 20 kg");
    expect(t.step).toBe("Serie 2 de 4");
    expect(t.range).toBe("Tu rango es de 8 a 12. Hoy la meta es 10.");
  });
  it("calibración: el rango completo explicado en simple", () => {
    const t = formatExerciseTask({ ...base, reps: "8", calibration: true, needsKg: true });
    expect(t.value).toBe("8 a 12");
    expect(t.line).toBe("8 a 12 repeticiones");
    expect(t.range).toBe("Haz entre 8 y 12. Para cuando te cueste mantener la técnica.");
    expect(t.load).toBe("Elige un peso que puedas mover 12 veces con buena técnica");
  });
  it("peso corporal con lastre dice extra; sin lastre no hay peso", () => {
    expect(formatExerciseTask({ ...base, reps: 9, kg: 5, bw: true }).load).toBe("con 5 kg extra");
    expect(formatExerciseTask({ ...base, reps: 9, kg: "", bw: true }).load).toBeNull();
  });
  it("por lado en repeticiones", () => {
    expect(formatExerciseTask({ ...base, reps: 8, perSide: true }).line).toBe("8 repeticiones por lado");
  });
  it("por tiempo y por tiempo por lado", () => {
    expect(formatExerciseTask({ ...base, unit: "s", lo: 30, hi: 60, reps: "30", bw: true }).line).toBe("30 segundos");
    const s = formatExerciseTask({ ...base, unit: "s", lo: 20, hi: 40, reps: "25", bw: true, perSide: true, side: 1 });
    expect(s.line).toBe("25 segundos por lado");
    expect(s.range).toBeNull();
    expect(s.say).toContain("lado derecho");
  });
  it("metros", () => {
    expect(formatExerciseTask({ ...base, unit: "m", lo: 30, hi: 40, reps: "30", kg: "16" }).line).toBe("30 metros");
  });
  it("intervalos", () => {
    const t = formatExerciseTask({ ...base, interval: true, unit: "s", lo: 30, hi: 40, reps: "40", setNo: 3, sets: 6 });
    expect(t.step).toBe("Intervalo 3 de 6");
    expect(t.line).toBe("40 s fuerte");
    expect(t.load).toBeNull();
  });
  it("última serie", () => {
    expect(formatExerciseTask({ ...base, reps: 10, setNo: 4 }).step).toBe("Última serie");
    expect(formatExerciseTask({ ...base, reps: 10, setNo: 1, sets: 1 }).step).toBe("Serie 1 de 1");
  });
  it("nunca deja huecos ni undefined", () => {
    for (const unit of [undefined, "s", "m"]) {
      const t = formatExerciseTask({ unit, reps: "", lo: 0, hi: 0, bw: true, setNo: 1, sets: 3 });
      expect(t.value).toMatch(/^\d+$/);
      expect(t.line).not.toMatch(/undefined|NaN|^ /);
      expect(t.say).not.toMatch(/undefined|NaN/);
    }
    expect(formatExerciseTask({ ...base, reps: "abc" }).value).toBe("8");
    expect(formatExerciseTask({ ...base, unit: "s", reps: "" }).value).toBe("12");
  });
  it("singular", () => {
    expect(formatExerciseTask({ ...base, reps: 1, lo: 1, hi: 1 }).line).toBe("1 repetición");
  });
});

describe("plainMuscles", () => {
  it("traduce a palabras simples, sin repetir y máximo 3", () => {
    expect(plainMuscles("Cuádriceps, glúteos, aductores, core")).toBe("muslos, glúteos y entrepierna");
    expect(plainMuscles("Glúteo mayor, glúteo medio")).toBe("glúteos");
    expect(plainMuscles("Dorsal ancho, bíceps")).toBe("espalda y bíceps");
  });
  it("sin dato usa el respaldo o null", () => {
    expect(plainMuscles("", "Pecho")).toBe("pecho");
    expect(plainMuscles(null)).toBeNull();
  });
});

describe("briefSteps", () => {
  it("máximo 3: inicio, movimiento y cierre", () => {
    expect(briefSteps(["a", "b", "c", "d", "e", "f"])).toEqual(["a", "d", "f"]);
    expect(briefSteps(["a", "b", "c", "d"])).toEqual(["a", "b", "d"]);
    expect(briefSteps(["a", "b"])).toEqual(["a", "b"]);
    expect(briefSteps(undefined)).toEqual([]);
  });
});

describe("planChips", () => {
  it("fuerza", () => {
    expect(planChips({ sets: 4, lo: 5, hi: 8, reps: 7, kg: 90, bw: false, rest: 180 })).toEqual(["4 series", "7 reps", "Con 90 kg", "Descanso 3 min"]);
  });
  it("calibración y por lado", () => {
    expect(planChips({ sets: 3, lo: 8, hi: 12, reps: 8, bw: true, perSide: true, rest: 60, calibration: true })).toEqual(["3 series", "8 a 12 reps", "Por lado", "Descanso 1 min"]);
  });
  it("tiempo e intervalos", () => {
    expect(planChips({ sets: 3, lo: 30, hi: 60, unit: "s", reps: 30, bw: true, rest: 45 })).toEqual(["3 series", "30 s", "Descanso 45 s"]);
    expect(planChips({ sets: 6, lo: 30, hi: 40, unit: "s", reps: 40, bw: true, rest: 20, interval: true })).toEqual(["6 rondas", "40 s de trabajo", "20 s de descanso"]);
  });
  it("una sola serie", () => {
    expect(planChips({ sets: 1, lo: 10, hi: 10, reps: 10, bw: true, rest: 60 })[0]).toBe("1 serie");
  });
});

describe("tiempo que falta", () => {
  const ex = [{ rest: 60, hi: 12 }, { unit: "s", rest: 45, hi: 30, perSide: true }];
  it("suma trabajo y descansos entre series, sin descanso al final", () => {
    const rows = [[{ reps: "10", done: true }, { reps: "10", done: false }], [{ reps: "30", done: false }]];
    const want = setSeconds(ex[0], 10) + 60 + setSeconds(ex[1], 30);
    expect(secondsLeft(rows, ex)).toBe(want);
    expect(secondsLeft(rows, ex, 20)).toBe(want + 20);
  });
  it("todo hecho", () => {
    expect(secondsLeft([[{ reps: "1", done: true }]], ex)).toBe(0);
  });
  it("texto", () => {
    expect(leftText(0)).toBe("Ya casi");
    expect(leftText(40)).toBe("Menos de 1 min");
    expect(leftText(70)).toBe("Falta 1 min");
    expect(leftText(18 * 60 + 10)).toBe("Faltan unos 18 min");
  });
});
