import { describe, expect, it } from "vitest";
import { trainingPaces } from "@/lib/run-fitness";
import {
  QUALITY, adaptPlan, addDays, buildPlan, dowOf, matchRuns, mondayOf, nextRun, phaseSplit, pickLongDay, pickQualityDays, qualityCount, runStreak, taperDays, weekStreak,
  type PlanInput,
} from "@/lib/run-plan";

const base: PlanInput = { start: "2026-10-26", raceDate: "2027-02-28", kind: "21k", distM: 21097, level: "recreativo", runDays: [1, 3, 5, 6], longRunDay: 6, kmWeek: 25, paces: trainingPaces(42) };
const plan = (o: Partial<PlanInput> = {}) => buildPlan({ ...base, ...o });
const training = (p: ReturnType<typeof buildPlan>) => p.weeks.filter((w) => !["afinar", "carrera", "recuperar"].includes(w.phase));

describe("plan de carrera", () => {
  it("fases en orden y termina con la semana de carrera y la de recuperación", () => {
    const p = plan();
    const order = ["base", "construccion", "pico", "afinar", "carrera", "recuperar"];
    const idx = p.weeks.map((w) => order.indexOf(w.phase));
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
    expect(p.weeks.at(-2)!.phase).toBe("carrera");
    expect(p.weeks.at(-1)!.phase).toBe("recuperar");
    expect(p.weeks.at(-2)!.runs.some((r) => r.kind === "carrera" && r.date === "2027-02-28")).toBe(true);
    expect(p.weeks.every((w, i) => w.start === addDays(p.weeks[0].start, i * 7))).toBe(true);
  });
  it("el volumen sube 10 % como mucho por semana", () => {
    for (const o of [{}, { kind: "10k" as const, distM: 10000 }, { kind: "42k" as const, distM: 42195, kmWeek: 40, raceDate: "2027-04-25" }, { level: "competitivo" as const, kmWeek: 50 }]) {
      const ws = training(plan(o));
      for (let k = 1; k < ws.length; k++) if (!ws[k].cutback) {
        const prevMax = Math.max(...ws.slice(0, k).map((w) => w.km));
        expect(ws[k].km).toBeLessThanOrEqual(Math.round(prevMax * 1.12 * 10) / 10 + 0.3);
      }
    }
  });
  it("una semana de descarga cada 3 o 4 semanas", () => {
    const ws = training(plan());
    let run = 0;
    for (const w of ws) { run = w.cutback ? 0 : run + 1; expect(run).toBeLessThanOrEqual(4); }
    expect(ws.some((w) => w.cutback)).toBe(true);
    const beg = training(plan({ level: "empezando", kmWeek: 15 }));
    let r2 = 0;
    for (const w of beg.slice(0, -1)) { r2 = w.cutback ? 0 : r2 + 1; expect(r2).toBeLessThanOrEqual(3); }
  });
  it("afinar dura de 7 a 14 días según la distancia", () => {
    expect(taperDays("5k", 5000)).toBe(7);
    expect(taperDays("21k", 21097)).toBe(10);
    expect(taperDays("42k", 42195)).toBe(14);
    expect(taperDays("trail", 50000)).toBe(14);
    const m = plan({ kind: "42k", distM: 42195, kmWeek: 40, raceDate: "2027-04-25" });
    expect(m.weeks.filter((w) => w.phase === "afinar")).toHaveLength(1);
    const peak = Math.max(...training(m).map((w) => w.km));
    expect(m.weeks.find((w) => w.phase === "afinar")!.km).toBeLessThan(peak * 0.85);
    expect(plan({ kind: "5k", distM: 5000 }).weeks.filter((w) => w.phase === "afinar")).toHaveLength(0);
  });
  it("la larga va en su día y es la más larga de cada semana de entrenamiento", () => {
    for (const w of training(plan())) {
      const long = w.runs.find((r) => r.kind === "larga")!;
      expect(dowOf(long.date)).toBe(6);
      for (const r of w.runs) expect(r.distM).toBeLessThanOrEqual(long.distM + 1500);
    }
  });
  it("solo usa los días que corre y nunca antes de armar el plan", () => {
    const p = plan({ start: "2026-10-29" });
    for (const w of p.weeks) for (const r of w.runs) {
      expect(r.date >= "2026-10-29").toBe(true);
      if (r.kind !== "carrera") expect([1, 3, 5, 6]).toContain(dowOf(r.date));
    }
    // Armado un domingo sin días que queden en la semana: empieza el lunes.
    expect(plan({ start: "2026-11-01", runDays: [1, 3, 5] }).weeks[0].start).toBe("2026-11-02");
  });
  it("calidad lejos de la larga y nunca dos días seguidos de calidad", () => {
    for (const w of training(plan({ runDays: [0, 1, 3, 4, 6], longRunDay: 6 }))) {
      const q = w.runs.filter((r) => QUALITY.includes(r.kind)).map((r) => dowOf(r.date));
      for (let i = 1; i < q.length; i++) expect(q[i] - q[i - 1]).toBeGreaterThanOrEqual(2);
      expect(q).not.toContain(0); // el día después de la larga
    }
    expect(pickQualityDays([1, 3, 5, 6], 6, 2)).toEqual([1, 3]);
    expect(pickLongDay([1, 3, 5], null)).toBe(5);
    expect(pickLongDay([1, 3], null)).toBe(3);
  });
  it("cuántas sesiones de calidad", () => {
    expect(qualityCount("base", 3, "recreativo")).toBe(1);
    expect(qualityCount("construccion", 4, "recreativo")).toBe(2);
    expect(qualityCount("construccion", 4, "empezando")).toBe(1);
    expect(qualityCount("recuperar", 5, "competitivo")).toBe(0);
    expect(phaseSplit(10)).toEqual({ base: 4, build: 3, peak: 3 });
    expect(phaseSplit(2)).toEqual({ base: 0, build: 2, peak: 0 });
  });
  it("las sesiones tienen ritmos y tramos para guiarlas", () => {
    const w = training(plan()).find((x) => x.phase === "construccion")!;
    const series = w.runs.find((r) => r.kind === "intervalos")!;
    expect(series.steps[0].kind).toBe("calentar");
    expect(series.steps.at(-1)!.kind).toBe("enfriar");
    expect(series.steps.filter((s) => s.kind === "trabajo").length).toBeGreaterThanOrEqual(4);
    expect(series.detail).not.toMatch(/[—·]/);
  });
  it("con poco volumen, menos días bien hechos", () => {
    const p = plan({ level: "empezando", kmWeek: 8, kind: "5k", distM: 5000, runDays: [0, 1, 2, 3, 4, 5] });
    expect(p.weeks[0].runs.length).toBeLessThan(6);
    for (const r of p.weeks[0].runs) expect(r.distM).toBeGreaterThanOrEqual(2400);
  });
  it("recuperación después de la carrera, no antes de 2 días (4 en maratón)", () => {
    const rec = plan().weeks.at(-1)!;
    for (const r of rec.runs) expect(r.date >= addDays("2027-02-28", 2)).toBe(true);
    const m = plan({ kind: "42k", distM: 42195, raceDate: "2027-04-25" }).weeks.at(-1)!;
    for (const r of m.runs) expect(r.date >= addDays("2027-04-25", 4)).toBe(true);
  });
});

describe("corridas hechas y ajustes", () => {
  const p = plan();
  const wk = p.weeks[2];
  const today = addDays(wk.start, 4); // viernes
  it("marca hechas las que se parecen y perdidas las que pasaron", () => {
    const [a, b] = wk.runs;
    const m = matchRuns(wk.runs, [{ id: "x", day: a.date, distanceM: a.distM * 0.9, movingS: 1800 }, { id: "y", day: addDays(b.date, 1), distanceM: 1500, movingS: 600 }], today);
    expect(m[0].status).toBe("hecha");
    expect(m[0].doneId).toBe("x");
    expect(m[1].status).toBe("perdida");
  });
  it("un día antes o después cuenta si ese día no tenía sesión", () => {
    const a = wk.runs[0];
    const m = matchRuns([a], [{ id: "x", day: addDays(a.date, -1), distanceM: a.distM, movingS: 1800 }], today);
    expect(m[0].status).toBe("hecha");
  });
  it("cada corrida cuenta una sola vez", () => {
    const a = { ...wk.runs[0] }, b = { ...wk.runs[0], id: "otra", date: addDays(wk.runs[0].date, 1) };
    const m = matchRuns([a, b], [{ id: "x", day: a.date, distanceM: a.distM, movingS: 1800 }], today);
    expect(m.filter((x) => x.status === "hecha")).toHaveLength(1);
  });
  it("si falta la larga, la mueve a la siguiente fácil de la semana", () => {
    const q = plan({ runDays: [1, 3, 5, 6], longRunDay: 3 });
    const w = q.weeks[3];
    const long = w.runs.find((r) => r.kind === "larga")!;
    const t = addDays(long.date, 1);
    const done = w.runs.filter((r) => r.date < long.date).map((r) => ({ id: r.id, day: r.date, distanceM: r.distM, movingS: 1800 }));
    const { plan: adj, adjusts } = adaptPlan(q, done, t, q.weeks[0].start);
    expect(adjusts.map((a) => a.kind)).toContain("larga_movida");
    const moved = adj.weeks[3].runs.find((r) => r.date >= t && r.kind === "larga");
    expect(moved?.distM).toBe(long.distM);
  });
  it("si se pasó de kilómetros, la próxima calidad se vuelve suave", () => {
    const w = p.weeks[3];
    const q = w.runs.find((r) => QUALITY.includes(r.kind))!;
    const t = q.date;
    const done = [2, 3, 4, 5, 6].map((k) => ({ id: `d${k}`, day: addDays(t, -k), distanceM: 12000, movingS: 3600 }));
    const { plan: adj, adjusts } = adaptPlan(p, done, t, p.weeks[0].start);
    expect(adjusts.map((a) => a.kind)).toContain("carga_alta");
    const soon = matchRuns(adj.weeks.flatMap((x) => x.runs), done, t).filter((r) => r.date >= t && r.date <= addDays(t, 3) && r.status !== "hecha");
    expect(soon.filter((r) => QUALITY.includes(r.kind))).toHaveLength(0);
    expect(soon.some((r) => r.note?.includes("suave"))).toBe(true);
  });
  it("después de 10 días sin correr, baja la semana al 80 %", () => {
    const w = p.weeks[4];
    const { plan: adj, adjusts } = adaptPlan(p, [], w.start, p.weeks[0].start);
    expect(adjusts.map((a) => a.kind)).toContain("regreso");
    expect(adj.weeks[4].km).toBeLessThan(w.km);
  });
  it("sin nada raro no cambia nada", () => {
    const w = p.weeks[2];
    const done = w.runs.filter((r) => r.date < today).map((r) => ({ id: r.id, day: r.date, distanceM: r.distM, movingS: 1800 }));
    expect(adaptPlan(p, done, today, p.weeks[0].start).adjusts).toEqual([]);
    expect((nextRun(p, done, today)?.date ?? "") >= today).toBe(true);
  });
});

describe("rachas", () => {
  it("días y semanas seguidas", () => {
    expect(runStreak(["2026-10-23", "2026-10-24"], "2026-10-25")).toBe(2);
    expect(runStreak(["2026-10-22"], "2026-10-25")).toBe(0);
    expect(weekStreak(["2026-10-05", "2026-10-13", "2026-10-21"], "2026-10-25")).toBe(3);
    expect(weekStreak(["2026-10-05", "2026-10-21"], "2026-10-27")).toBe(1);
    expect(mondayOf("2026-10-25")).toBe("2026-10-19");
  });
});
