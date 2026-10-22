import { describe, expect, it } from "vitest";
import { levelOf, streakOf } from "./gamify";

describe("gamificación", () => {
  it("niveles", () => {
    expect(levelOf(0).n).toBe("Banana verde");
    expect(levelOf(850)).toMatchObject({ n: "Banana madura", toNext: 750 });
    expect(levelOf(99999).progress).toBe(1);
  });
  it("racha no se rompe si hoy aún no entrenas", () => {
    const s = new Set(["2026-10-19", "2026-10-20"]);
    expect(streakOf(s, "2026-10-21")).toEqual({ days: 2, todayDone: false });
    s.add("2026-10-21");
    expect(streakOf(s, "2026-10-21")).toEqual({ days: 3, todayDone: true });
    expect(streakOf(new Set(["2026-10-18"]), "2026-10-21").days).toBe(0);
  });
});

import { workoutXp } from "./gamify";
describe("workoutXp", () => {
  it("premia un entreno completo con tiempo real", () => {
    expect(workoutXp({ doneSets: 16, totalSets: 16, prs: 1, seconds: 45 * 60 })).toEqual({ xp: 160 + 50 + 30, prs: 1, rushed: false });
  });
  it("no premia 13 series en 43 segundos", () => {
    const r = workoutXp({ doneSets: 13, totalSets: 16, prs: 4, seconds: 43 });
    expect(r.rushed).toBe(true); expect(r.prs).toBe(0); expect(r.xp).toBeLessThanOrEqual(10);
  });
  it("limita récords a 3 por sesión", () => {
    expect(workoutXp({ doneSets: 10, totalSets: 20, prs: 9, seconds: 3600 }).prs).toBe(3);
  });
});
