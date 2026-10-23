import { describe, expect, it } from "vitest";
import { workoutXp } from "@/lib/gamify";
import { advanceIntervals, bump, clock, comboState, cooldownFor, effortOf, effortPatch, isIntervalPlan, loadKindOf, loadsFor, nextCombo, nextPending, prsOf, readSaved, restLabel, rirOf, setXpGain, stepFor, targetText, timedPhase, volumeOf, volumeText, warmupFor, warmupText, type Row } from "./logic";

const row = (p: Partial<Row> = {}): Row => ({ kg: "20", reps: "8", done: false, easy: false, ...p });

describe("formato", () => {
  it("reloj y descansos", () => {
    expect(clock(0)).toBe("0:00");
    expect(clock(125.9)).toBe("2:05");
    expect(clock(-3)).toBe("0:00");
    expect(restLabel(90)).toBe("90 s");
    expect(restLabel(120)).toBe("2 min");
    expect(restLabel(150)).toBe("2,5 min");
    expect(restLabel(60)).toBe("1 min");
  });
  it("objetivo de la serie", () => {
    expect(targetText({ kg: "10", reps: "8" }, { bw: false })).toBe("10 kg × 8 reps");
    expect(targetText({ kg: "", reps: "12" }, { bw: true })).toBe("12 reps");
    expect(targetText({ kg: "", reps: "40" }, { bw: true, unit: "s" })).toBe("40 seg");
    expect(targetText({ kg: "22,5", reps: "6" }, { bw: false })).toBe("22,5 kg × 6 reps");
  });
  it("volumen", () => {
    expect(volumeOf([[row({ done: true }), row()], [row({ kg: "100", reps: "10", done: true })]])).toBe(1160);
    expect(volumeText(1160)).toBe("1,2 t");
    expect(volumeText(640)).toBe("640 kg");
  });
});

describe("steppers", () => {
  it("paso según equipo y unidad", () => {
    expect(stepFor("kg", { barbell: true, cur: 40 })).toBe(2.5);
    expect(stepFor("kg", { barbell: false, cur: 24 })).toBe(2);
    expect(stepFor("kg", { barbell: false, cur: 8 })).toBe(1);
    expect(stepFor("reps", { barbell: false, cur: 8 })).toBe(1);
    expect(stepFor("reps", { unit: "s", barbell: false, cur: 30 })).toBe(5);
  });
  it("nunca baja de cero y redondea", () => {
    expect(bump(1, -2.5)).toBe(0);
    expect(bump(0.1, 0.2)).toBe(0.3);
  });
});

describe("esfuerzo", () => {
  it("solo Fácil marca easy (RIR 4 en el guardado)", () => {
    expect(effortPatch("f")).toEqual({ eff: "f", easy: true });
    expect(effortPatch("j")).toEqual({ eff: "j", easy: false });
    expect(effortPatch("l")).toEqual({ eff: "l", easy: false });
  });
  it("lee sesiones viejas que solo tenían easy", () => {
    expect(effortOf(row({ done: true, easy: true }))).toBe("f");
    expect(effortOf(row({ done: true }))).toBeNull();
  });
});

describe("XP por serie (igual que el servidor)", () => {
  it("+10 por serie a ritmo real", () => {
    expect(setXpGain({ doneBefore: 2, totalSets: 10, prsBefore: 0, prsAfter: 0, seconds: 400 })).toBe(10);
  });
  it("la última serie suma el bono de entreno completo", () => {
    expect(setXpGain({ doneBefore: 9, totalSets: 10, prsBefore: 0, prsAfter: 0, seconds: 1200 })).toBe(40);
  });
  it("un récord suma 50", () => {
    expect(setXpGain({ doneBefore: 3, totalSets: 10, prsBefore: 0, prsAfter: 1, seconds: 600 })).toBe(60);
  });
  it("series imposiblemente rápidas no muestran XP", () => {
    expect(setXpGain({ doneBefore: 3, totalSets: 10, prsBefore: 0, prsAfter: 0, seconds: 30 })).toBe(0);
  });
  it("la suma de los +XP coincide con workoutXp", () => {
    let sum = 0;
    const total = 6;
    for (let d = 0; d < total; d++) sum += setXpGain({ doneBefore: d, totalSets: total, prsBefore: d >= 3 ? 1 : 0, prsAfter: d >= 2 ? 1 : 0, seconds: 2000 });
    expect(sum).toBe(workoutXp({ doneSets: total, totalSets: total, prs: 1, seconds: 2000 }).xp);
  });
});

describe("combo", () => {
  it("sube a tiempo, se reinicia tras una pausa larga", () => {
    expect(nextCombo(0, null, 90)).toBe(1);
    expect(nextCombo(1, 150, 90)).toBe(2);
    expect(nextCombo(4, 600, 90)).toBe(1);
  });
  it("marcar series de golpe no lo infla", () => {
    expect(nextCombo(3, 2, 90)).toBe(3);
  });
});

describe("siguiente serie", () => {
  it("busca desde el ejercicio actual y da la vuelta", () => {
    const rows = [[row({ done: true }), row()], [row({ done: true })], [row()]];
    expect(nextPending(rows, 1)).toEqual({ ex: 2, si: 0 });
    expect(nextPending(rows, 0)).toEqual({ ex: 0, si: 1 });
    expect(nextPending([[row({ done: true })]], 0)).toBeNull();
  });
});

describe("calentamiento", () => {
  it("barra pesada: barra sola y una aproximación", () => {
    const w = warmupFor({ kg: 60, barbell: true, bw: false })!;
    expect(w).toEqual([{ kg: 20, reps: 10 }, { kg: 20, reps: 8 }, { kg: 35, reps: 5 }]);
    expect(warmupText(w)).toBe("2 series con la barra sola (10 y 8 reps) y 1 de 5 con 35 kg.");
    expect(warmupText([{ kg: 20, reps: 10 }])).toBe("1 serie con la barra sola (10 reps).");
    expect(warmupText([{ kg: 8, reps: 10 }], false)).toBe("1 de 10 con 8 kg.");
  });
  it("si la serie de trabajo es la barra sola, no hay calentamiento aparte", () => {
    expect(warmupFor({ kg: 20, barbell: true, bw: false })).toBeNull();
  });
  it("barra sin peso calibrado: barra sola", () => {
    expect(warmupFor({ kg: 0, barbell: true, bw: false })).toEqual([{ kg: 20, reps: 10 }, { kg: 20, reps: 8 }]);
  });
  it("mancuernas: una serie a la mitad; peso corporal: nada", () => {
    expect(warmupFor({ kg: 16, barbell: false, bw: false })).toEqual([{ kg: 8, reps: 10 }]);
    expect(warmupFor({ kg: 0, barbell: false, bw: true })).toBeNull();
    expect(warmupFor({ kg: 0, barbell: false, bw: false, unit: "s" })).toBeNull();
  });
});

describe("vuelta a la calma", () => {
  it("estiramientos según los músculos, sin repetir", () => {
    expect(cooldownFor(["Piernas", "Pecho", "Hombros", "Tríceps"]).stretches).toEqual(["cuádriceps", "pecho", "hombros"]);
    expect(cooldownFor(["Core", "Core"]).text).toBe("3 min de caminata suave y 30 s de estiramiento para cadera.");
  });
});

describe("modo intervalos", () => {
  it("solo si todo es por tiempo con descanso corto", () => {
    expect(isIntervalPlan([{ cfg: { unit: "s", rest: 20 } }, { cfg: { unit: "s", rest: 20 } }])).toBe(true);
    expect(isIntervalPlan([{ cfg: { unit: "s", rest: 45 } }])).toBe(false);
    expect(isIntervalPlan([{ cfg: { rest: 20 } }])).toBe(false);
    expect(isIntervalPlan([])).toBe(false);
  });
});

describe("sesión guardada", () => {
  it("acepta el formato anterior", () => {
    const old = { rows: [[{ kg: "10", reps: "8", done: true, easy: true }]], idx: 0, startedAt: "2026-10-22T12:00:00.000Z", prs: [], choice: [0] };
    const s = readSaved(old, 1)!;
    expect(s.rows[0][0]).toEqual({ kg: "10", reps: "8", done: true, easy: true });
    expect(s.combo).toBe(0);
  });
  it("descarta lo que no calza o viene roto", () => {
    expect(readSaved(null, 1)).toBeNull();
    expect(readSaved({ rows: [[]], choice: [0, 0] }, 1)).toBeNull();
    expect(readSaved({ rows: [["x"]], choice: [0] }, 1)).toBeNull();
    expect(readSaved({ rows: [[{ kg: "1", reps: "1", done: false, easy: false }]], choice: [0], idx: 99, startedAt: "nope" }, 1)!.idx).toBe(0);
  });
});

describe("esfuerzo a RIR", () => {
  it("Fácil 4, Justo 2, Al límite 0; sin respuesta null", () => {
    expect(rirOf(row({ done: true, ...effortPatch("f") }))).toBe(4);
    expect(rirOf(row({ done: true, ...effortPatch("j") }))).toBe(2);
    expect(rirOf(row({ done: true, ...effortPatch("l") }))).toBe(0);
    expect(rirOf(row({ done: true }))).toBeNull();
    expect(rirOf(row({ done: true, easy: true }))).toBe(4);
  });
});

describe("récords derivados de las series", () => {
  const exs = [{ id: "bench", name: "Press banca", best: 100 }, { id: "ds:0314", name: "Press con mancuernas", best: 0 }];
  it("aparece al superar la mejor marca y se va al deshacer", () => {
    const hit = [[row({ kg: "80", reps: "10", done: true })], [row({ kg: "30", reps: "10", done: true })]];
    expect(prsOf(hit, exs)).toEqual([{ id: "bench", name: "Press banca" }]);
    expect(prsOf([[row({ kg: "80", reps: "10" })], [row()]], exs)).toEqual([]);
  });
  it("usa el nombre del ejercicio actual (nunca un id crudo)", () => {
    expect(prsOf([[row({ kg: "90", reps: "8", done: true })], []], exs)[0].name).toBe("Press banca");
  });
});

describe("combo al deshacer", () => {
  it("vuelve al combo de la última serie que sigue hecha", () => {
    const rows = [[row({ done: true, at: 1000, c: 1 }), row({ done: true, at: 2000, c: 2 }), row()]];
    expect(comboState(rows)).toEqual({ combo: 2, lastAt: 2000, best: 2 });
    rows[0][1] = row();
    expect(comboState(rows)).toEqual({ combo: 1, lastAt: 1000, best: 1 });
    expect(comboState([[row()]])).toEqual({ combo: 0, lastAt: undefined, best: 0 });
  });
});

describe("carga para calibrar", () => {
  it("según el equipo", () => {
    expect(loadKindOf("squat", { inc: 2.5 })).toBe("barbell");
    expect(loadKindOf("curl", { inc: 1.25 })).toBe("ez");
    expect(loadKindOf("lat", { inc: 2.5 })).toBe("machine");
    expect(loadKindOf("goblet", { inc: 2 })).toBe("dumbbell");
    expect(loadKindOf("pushup", { inc: 0 })).toBeNull();
    expect(loadKindOf("ds:1", { inc: 2, eq: "kettlebell" })).toBe("kettlebell");
    expect(loadKindOf("ds:1", { inc: 2.5, eq: "ez barbell" })).toBe("ez");
    expect(loadKindOf("ds:1", { inc: 2.5, eq: "cable" })).toBe("machine");
    expect(loadKindOf("ds:1", { inc: 0, eq: "body weight" })).toBeNull();
  });
  it("barra: empieza con la barra sola", () => {
    expect(loadsFor("barbell")).toMatchObject({ start: 20, chips: [{ kg: 20, label: "Barra sola" }, { kg: 30 }, { kg: 40 }] });
    expect(loadsFor(null)).toBeNull();
  });
});

describe("intervalos: reconciliar con la pestaña oculta", () => {
  const cfg = [{ hi: 40, rest: 20 }, { hi: 40, rest: 20 }];
  const fresh = () => [[row({ kg: "", reps: "40" }), row({ kg: "", reps: "40" })], [row({ kg: "", reps: "40" })]];
  it("sin tiempo transcurrido no cambia nada", () => {
    const r = advanceIntervals({ phase: "work", end: 10_000, total: 40 }, fresh(), 0, cfg, 9_000);
    expect(r.iv.phase).toBe("work");
    expect(r.marked).toEqual([]);
  });
  it("encadena las fases desde el final exacto de la anterior", () => {
    // prep termina en 0; trabajo 0-40 s; descanso 40-60 s; trabajo 60-100 s; ahora 70 s
    const r = advanceIntervals({ phase: "prep", end: 0, total: 5 }, fresh(), 0, cfg, 70_000);
    expect(r.marked.map((m) => m.at)).toEqual([40_000]);
    expect(r.iv).toEqual({ phase: "work", end: 100_000, total: 40 });
    expect(r.rows[0][0].done).toBe(true);
    expect(r.finished).toBe(false);
  });
  it("si pasó todo el entreno, lo termina sin inventar fases", () => {
    const r = advanceIntervals({ phase: "prep", end: 0, total: 5 }, fresh(), 0, cfg, 10 * 60_000);
    expect(r.finished).toBe(true);
    expect(r.marked).toHaveLength(3);
    expect(r.rows.flat().every((x) => x.done)).toBe(true);
  });
});

describe("serie por tiempo", () => {
  it("la barra cubre solo el trabajo, no los 3 s de preparación", () => {
    expect(timedPhase({ end: 33_000, secs: 30 }, 1_000)).toMatchObject({ prep: true, frac: 1 });
    expect(timedPhase({ end: 33_000, secs: 30 }, 18_000)).toMatchObject({ prep: false, workLeft: 15, frac: 0.5 });
    expect(timedPhase({ end: 33_000, secs: 30 }, 40_000)).toMatchObject({ prep: false, workLeft: 0, frac: 0 });
  });
});

describe("sesión: el modo va dentro", () => {
  it("guarda modo y repetición", () => {
    const s = readSaved({ rows: [[row()]], choice: [0], idx: 0, startedAt: "2026-10-22T12:00:00.000Z", mode: "suave", repeat: true }, 1)!;
    expect(s.mode).toBe("suave");
    expect(s.repeat).toBe(true);
  });
});
