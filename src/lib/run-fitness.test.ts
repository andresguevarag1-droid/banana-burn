import { describe, expect, it } from "vitest";
import { parseRaceGoal, bestWindow, checkGoal, estimateFitness, fmtTime, newBests, parseTime, personalBests, predictRace, predictTime, riegel, trainingPaces, vdot, type RunLike } from "@/lib/run-fitness";

const run = (id: string, day: string, splits: number[], extraM = 0): RunLike => ({ id, day, distanceM: splits.length * 1000 + extraM, movingS: splits.reduce((a, b) => a + b, 0), splits: splits.map((s, i) => ({ km: i + 1, seconds: s })) });

describe("VDOT y ritmos", () => {
  it("coincide con las tablas de Daniels", () => {
    expect(vdot(5000, 20 * 60)).toBeCloseTo(49.8, 0);
    expect(vdot(10000, 50 * 60)).toBeCloseTo(40, 0);
    expect(vdot(42195, 3 * 3600)).toBeCloseTo(53.5, 0);
  });
  it("descarta resultados imposibles", () => {
    expect(vdot(5000, 9 * 60)).toBeNull();
    expect(vdot(5000, 0)).toBeNull();
    expect(vdot(500, 120)).toBeNull();
  });
  it("predice tiempos que vuelven al mismo VDOT", () => {
    const t = predictTime(50, 21097);
    expect(vdot(21097, t)).toBeCloseTo(50, 0);
    expect(t).toBeGreaterThan(91 * 60);
    expect(t).toBeLessThan(92.5 * 60); // tabla de Daniels: 1:31:35
  });
  it("los ritmos van en orden: fácil más lento que maratón, que umbral, que series", () => {
    const p = trainingPaces(50);
    expect(p.facil[1]).toBeGreaterThan(p.facil[0]);
    expect(p.facil[0]).toBeGreaterThan(p.maraton);
    expect(p.maraton).toBeGreaterThan(p.umbral);
    expect(p.umbral).toBeGreaterThan(p.intervalo);
    expect(p.intervalo).toBeGreaterThan(p.repeticion);
    // VDOT 50: umbral cerca de 4:15/km, series cerca de 3:55/km.
    expect(Math.abs(p.umbral - 255)).toBeLessThanOrEqual(5);
    expect(Math.abs(p.intervalo - 235)).toBeLessThanOrEqual(5);
  });
  it("Riegel pasa 10K a medio maratón", () => {
    expect(riegel(3000, 10000, 21097)).toBeGreaterThan(6600);
    expect(riegel(3000, 10000, 21097)).toBeLessThan(6700);
  });
  it("trail es más lento que la calle", () => {
    expect(predictRace(45, "trail", 21097)).toBeGreaterThan(predictRace(45, "21k", 21097));
  });
  it("lee y escribe tiempos", () => {
    expect(parseTime("52:30")).toBe(3150);
    expect(parseTime("1:52:30")).toBe(6750);
    expect(parseTime("5:75")).toBeNull();
    expect(parseTime("abc")).toBeNull();
    expect(fmtTime(6750)).toBe("1:52:30");
    expect(fmtTime(3150)).toBe("52:30");
  });
});

describe("marcas personales", () => {
  it("mejor tramo de k km seguidos", () => {
    expect(bestWindow([{ km: 1, seconds: 300 }, { km: 2, seconds: 280 }, { km: 3, seconds: 290 }, { km: 3.4, seconds: 100 }], 2)).toBe(570);
    expect(bestWindow([{ km: 1, seconds: 300 }], 2)).toBeNull();
    // Un parcial imposible invalida la carrera.
    expect(bestWindow([{ km: 1, seconds: 60 }, { km: 2, seconds: 300 }], 1)).toBeNull();
  });
  it("1 km, 5 km, 10 km y la más larga, con la carrera de cada una", () => {
    const a = run("a", "2026-10-01", [330, 320, 310, 300, 300, 310]);
    const b = run("b", "2026-10-08", [290, 340, 340, 340, 340, 340, 340, 340, 340, 340, 340], 500);
    const pb = personalBests([a, b]);
    expect(pb.km1).toEqual({ seconds: 290, runId: "b", day: "2026-10-08" });
    expect(pb.km5?.runId).toBe("a");
    expect(pb.km5?.seconds).toBe(320 + 310 + 300 + 300 + 310);
    expect(pb.km10?.runId).toBe("b");
    expect(pb.km21).toBeNull();
    expect(pb.longest?.runId).toBe("b");
  });
  it("detecta marcas nuevas de una carrera", () => {
    const a = run("a", "2026-10-01", [330, 320, 310, 300, 300]);
    const b = run("b", "2026-10-08", [295, 300, 300, 300, 300, 300]);
    expect(newBests([a], b)).toEqual(["km1", "km5", "longest"]);
    expect(newBests([a, b], run("c", "2026-10-09", [400, 400]))).toEqual([]);
  });
});

describe("estado de forma y metas", () => {
  it("usa el mejor entre el resultado y el GPS de las últimas 12 semanas", () => {
    const fast = run("g", "2026-10-10", [270, 270, 270, 270, 270]);
    const old = run("o", "2026-01-01", [200, 200, 200, 200, 200]);
    const f = estimateFitness({ recent: { distM: 10000, timeS: 3300 }, runs: [fast, old], today: "2026-10-25" });
    expect(f.source).toBe("gps");
    expect(f.vdot).toBeCloseTo(vdot(5000, 1350)!, 1);
    expect(estimateFitness({ recent: { distM: 10000, timeS: 3300 }, runs: [], today: "2026-10-25" }).source).toBe("resultado");
    expect(estimateFitness({ level: "empezando" })).toMatchObject({ source: "estimado", vdot: 30 });
  });
  it("dice con amabilidad si la meta no es realista y sugiere un rango", () => {
    const fitness = { vdot: 40, source: "resultado" as const, label: "" };
    const now = predictRace(40, "21k", 21097);
    expect(checkGoal({ fitness, kind: "21k", distM: 21097, goalS: now + 60, weeks: 8, level: "recreativo" }).status).toBe("conservadora");
    const real = checkGoal({ fitness, kind: "21k", distM: 21097, goalS: now - 120, weeks: 10, level: "recreativo" });
    expect(real.status).toBe("realista");
    const far = checkGoal({ fitness, kind: "21k", distM: 21097, goalS: now - 25 * 60, weeks: 6, level: "recreativo" });
    expect(far.status).toBe("muy_ambiciosa");
    expect(far.range![0]).toBeLessThan(far.range![1]);
    expect(far.message).toMatch(/Te sugerimos/);
    expect(far.message).not.toMatch(/[—·]/);
    expect(checkGoal({ fitness, kind: "21k", distM: 21097, goalS: null, weeks: 6, level: "recreativo" }).status).toBe("sin_meta");
  });
  it("más semanas permiten más mejora", () => {
    const fitness = { vdot: 40, source: "resultado" as const, label: "" };
    const a = checkGoal({ fitness, kind: "10k", distM: 10000, goalS: null, weeks: 4, level: "recreativo" }).withPlan;
    const b = checkGoal({ fitness, kind: "10k", distM: 10000, goalS: null, weeks: 12, level: "recreativo" }).withPlan;
    expect(b).toBeLessThan(a);
  });
});

describe("formulario de la carrera objetivo", () => {
  const today = "2026-10-25";
  it("acepta lo normal y calcula la distancia", () => {
    const r = parseRaceGoal({ name: "  Mi   21K ", raceDate: "2026-12-13", kind: "21k", goal: "1:55:00", recentDist: "10k", recentTime: "52:00", ownPlan: false, hardDays: [1] }, today);
    expect(r).toEqual({ ok: true, goal: { name: "Mi 21K", raceDate: "2026-12-13", kind: "21k", distanceM: 21097, goalS: 6900, recentDistanceM: 10000, recentS: 3120, ownPlan: false, hardDays: [] } });
  });
  it("trail con sus km y meta de solo terminar", () => {
    const r = parseRaceGoal({ raceDate: "2027-01-10", kind: "trail", trailKm: "25,5", goal: "terminar", ownPlan: true, hardDays: [2, 2, 9, 4] }, today);
    expect(r.ok && r.goal).toMatchObject({ distanceM: 25500, goalS: null, ownPlan: true, hardDays: [2, 4] });
  });
  it("rechaza con un mensaje claro", () => {
    expect(parseRaceGoal({ raceDate: "2026-10-01", kind: "10k" }, today)).toMatchObject({ ok: false, error: expect.stringMatching(/ya pasó/) });
    expect(parseRaceGoal({ raceDate: "2028-10-01", kind: "10k" }, today).ok).toBe(false);
    expect(parseRaceGoal({ raceDate: "2026-12-01", kind: "maraton" }, today).ok).toBe(false);
    expect(parseRaceGoal({ raceDate: "2026-12-01", kind: "10k", goal: "10:00" }, today).ok).toBe(false);
    expect(parseRaceGoal({ raceDate: "2026-12-01", kind: "trail", trailKm: 2 }, today).ok).toBe(false);
    expect(parseRaceGoal({ raceDate: "2026-12-01", kind: "10k", recentDist: "5k", recentTime: "5:00" }, today).ok).toBe(false);
  });
});
