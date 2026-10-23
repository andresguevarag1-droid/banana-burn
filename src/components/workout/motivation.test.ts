import { describe, expect, it } from "vitest";
import { FULL_BONUS, LEVELS, levelCrossed, workoutXp, workoutsToNext } from "@/lib/gamify";
import { expressRows, finishValue, kgToBeat, lastVolume, levelGoal, levelGoalText, nextMilestone, pickFact, reachedMilestones, restFacts, volumeWithHistory } from "./motivation";
import { e1, readSaved, type Row } from "./logic";

const row = (p: Partial<Row> = {}): Row => ({ kg: "20", reps: "8", done: false, easy: false, ...p });
const slow = (done: number) => done * 60; // ritmo real

describe("reglas de XP", () => {
  it("el bono de completo es el de workoutXp", () => {
    expect(workoutXp({ doneSets: 4, totalSets: 4, prs: 0, seconds: 600 }).xp - workoutXp({ doneSets: 4, totalSets: 5, prs: 0, seconds: 600 }).xp).toBe(FULL_BONUS);
  });
});

describe("meta de nivel", () => {
  it("cuenta las series que faltan para subir (10 XP por serie)", () => {
    // Plátano macho a 1600: con 1520 de base y 0 hechas faltan 80 XP = 8 series de 10
    const g = levelGoal(1520, { doneSets: 0, totalSets: 12, prs: 0, seconds: 0 });
    expect(g.level.next?.n).toBe("Plátano macho");
    expect(g.level.toNext).toBe(80);
    expect(g.sets).toBe(8);
    expect(g.needsBonus).toBe(false);
    expect(levelGoalText(g)).toBe("Te faltan 80 XP para Plátano macho: 8 series más");
  });
  it("usa el XP de hoy y el bono al terminar", () => {
    // 1540 base, 3 de 5 hechas (+30): faltan 30; 2 series = +20 y el bono +30 → sube justo al terminar
    const g = levelGoal(1540, { doneSets: 3, totalSets: 5, prs: 0, seconds: slow(3) });
    expect(g.level.toNext).toBe(30);
    expect(g.sets).toBe(2);
    expect(g.needsBonus).toBe(true);
    expect(levelGoalText(g)).toContain("termina las 2 series que quedan y el bono te sube");
    expect(levelGoalText({ ...g, sets: 1 })).toContain("termina la última serie");
  });
  it("si no alcanza hoy, dice cuánto suma terminar", () => {
    const g = levelGoal(0, { doneSets: 0, totalSets: 10, prs: 0, seconds: 0 });
    expect(g.sets).toBeNull();
    expect(g.finishXp).toBe(130);
    expect(levelGoalText(g)).toBe("Te faltan 300 XP para Banana pintona. Terminar hoy suma +130 XP");
  });
  it("nivel máximo", () => {
    const g = levelGoal(LEVELS.at(-1)!.xp + 5, { doneSets: 0, totalSets: 3, prs: 0, seconds: 0 });
    expect(levelGoalText(g)).toBe("Nivel máximo: King Kong");
  });
  it("valor de terminar", () => {
    expect(finishValue({ doneSets: 6, totalSets: 8, prs: 0, seconds: slow(6) })).toEqual({ left: 2, xp: 50, bonus: 30 });
    expect(finishValue({ doneSets: 8, totalSets: 8, prs: 0, seconds: slow(8) })).toEqual({ left: 0, xp: 0, bonus: 0 });
  });
  it("en modo exprés no promete el bono", () => {
    // plan de 12, quedan 3 en pantalla: terminar no completa el plan
    expect(finishValue({ doneSets: 5, totalSets: 12, doable: 8, prs: 0, seconds: slow(5) })).toEqual({ left: 3, xp: 30, bonus: 0 });
    // 1500 + 50 hoy: faltan 50. Con el plan completo bastan 5 series; en exprés solo quedan 3 (+30), no alcanza
    expect(levelGoal(1500, { doneSets: 5, totalSets: 12, prs: 0, seconds: slow(5) }).sets).toBe(5);
    const g = levelGoal(1500, { doneSets: 5, totalSets: 12, doable: 8, prs: 0, seconds: slow(5) });
    expect(g.sets).toBeNull();
    expect(g.finishXp).toBe(30);
  });
  it("detecta la subida de nivel y estima entrenos", () => {
    expect(levelCrossed(290, 300)?.n).toBe("Banana pintona");
    expect(levelCrossed(300, 310)).toBeNull();
    expect(workoutsToNext(300, 130)).toBe(4); // faltan 500 → 4 entrenos de 130
    expect(workoutsToNext(LEVELS.at(-1)!.xp, 130)).toBeNull();
  });
});

describe("hitos", () => {
  it("25, 50, 75 y última serie", () => {
    expect(reachedMilestones(3, 12)).toEqual(["q1"]);
    expect(reachedMilestones(6, 12)).toEqual(["q1", "half"]);
    expect(reachedMilestones(11, 12)).toEqual(["q1", "half", "q3", "last"]);
    expect(reachedMilestones(0, 12)).toEqual([]);
  });
  it("no se repiten al deshacer y rehacer", () => {
    let seen: string[] = [];
    const a = nextMilestone(6, 12, seen); seen = a.seen;
    expect(a.show).toBe("half");
    // deshace (5) y vuelve a marcar (6): nada nuevo
    expect(nextMilestone(5, 12, seen).show).toBeNull();
    expect(nextMilestone(6, 12, seen).show).toBeNull();
    // q1 quedó visto aunque se cruzó a la vez
    expect(seen).toContain("q1");
  });
  it("si cruza varios, muestra el más cercano al final; al terminar, ninguno", () => {
    expect(nextMilestone(2, 3, []).show).toBe("last");
    expect(nextMilestone(4, 4, []).show).toBeNull();
    expect(nextMilestone(4, 4, []).seen).toContain("q3");
  });
});

describe("modo exprés", () => {
  it("1 serie por ejercicio sin empezar; los empezados se quedan con lo hecho", () => {
    const rows = [[row({ done: true }), row({ done: true })], [row({ done: true }), row(), row()], [row(), row(), row()]];
    const out = expressRows(rows)!;
    expect(out.map((r) => r.length)).toEqual([2, 1, 1]);
    expect(out[1][0].done).toBe(true);
    expect(out[2][0].done).toBe(false);
  });
  it("null si no ahorra nada", () => {
    expect(expressRows([[row({ done: true }), row()], [row()]])).not.toBeNull();
    expect(expressRows([[row()], [row()]])).toBeNull();
  });
});

describe("datos del descanso", () => {
  it("peso que supera el récord", () => {
    const best = e1(60, 8);
    const kg = kgToBeat(best, 8, 2.5)!;
    expect(kg).toBe(62.5);
    expect(e1(kg, 8)).toBeGreaterThan(best);
    expect(kgToBeat(0, 8, 2.5)).toBeNull();
  });
  it("volumen de la última vez y de hoy con historial", () => {
    expect(lastVolume([[{ kg: 20, reps: 10 }, { kg: null, reps: 12 }], null])).toBe(200);
    expect(volumeWithHistory([[row({ done: true })], [row({ done: true })]], [true, false])).toBe(160);
  });
  it("arma datos reales y rota", () => {
    const facts = restFacts({ next: { name: "Press banca", best: e1(60, 8), reps: 8, step: 2.5, kg: true }, volToday: 800, volLast: 2400, streak: 4, todayDone: false,
      finish: { left: 3, xp: 60, bonus: 30 } });
    expect(facts[0]).toContain("62,5 kg × 8");
    expect(facts.some((f) => f.includes("Llevas 800 kg de los 2,4 t"))).toBe(true);
    expect(facts.some((f) => f.includes("racha a 5 días"))).toBe(true);
    expect(facts.some((f) => f.includes("+60 XP, con el bono de +30"))).toBe(true);
    expect(pickFact(facts, facts.length)).toBe(facts[0]);
    expect(pickFact([], 2)).toBeNull();
    const safe = restFacts({ volToday: 0, volLast: 0, streak: 3, todayDone: true });
    expect(safe).toEqual(["Tu racha de 3 días ya está a salvo hoy."]);
    const more = restFacts({ next: { name: "Remo", best: 0, reps: 8, step: 1, kg: true, last: [{ kg: 20, reps: 8 }, { kg: 20, reps: 7 }] }, volToday: 0, volLast: 0, doneSets: 3, volTotal: 480, streak: 2, todayDone: false, streakShown: true });
    expect(more).toEqual(["La última vez en Remo hiciste 20 × 8, 20 × 7. Hoy toca igualarlo o superarlo.", "Hoy llevas 3 series y 480 kg movidos."]);
  });
});

describe("sesión guardada", () => {
  it("conserva hitos vistos y el plan original del modo exprés", () => {
    const s = readSaved({ rows: [[row()]], choice: [0], startedAt: "2026-10-22T10:00:00Z", idx: 0, ms: ["q1", "half", 3], plan: 12 }, 1)!;
    expect(s.ms).toEqual(["q1", "half"]);
    expect(s.plan).toBe(12);
    expect(readSaved({ rows: [[row()]], choice: [0], startedAt: "x", idx: 0 }, 1)!.ms).toBeUndefined();
  });
});
