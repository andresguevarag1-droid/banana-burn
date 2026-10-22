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

import { LEVELS, LEVEL_PERKS, nextStreakTier, nextUnlock, perksAt, streakBonus, streakMultiplier, weeklyGoalFor, xpByDay, levelCrossed } from "./gamify";
describe("escalera de niveles", () => {
  it("cada nivel tiene nombre, umbral creciente y recompensa", () => {
    expect(LEVEL_PERKS).toHaveLength(LEVELS.length);
    for (let i = 1; i < LEVELS.length; i++) expect(LEVELS[i].xp).toBeGreaterThan(LEVELS[i - 1].xp);
  });
  it("XP al siguiente nivel y qué desbloquea", () => {
    expect(nextUnlock(720)).toMatchObject({ name: "Banana madura", xpLeft: 80, idx: 3 });
    expect(nextUnlock(720)!.perk.kind).toBe("comodin");
    expect(nextUnlock(99999)).toBeNull();
  });
  it("cruzar justo el umbral sube de nivel; quedarse a 1 XP no", () => {
    expect(levelCrossed(299, 300)?.n).toBe("Banana pintona");
    expect(levelCrossed(298, 299)).toBeNull();
    expect(levelCrossed(100, 900)?.n).toBe("Banana madura");
  });
  it("beneficios acumulados por nivel", () => {
    expect(perksAt(1)).toEqual({ extraGrace: 0, discountPct: 0, frame: null });
    expect(perksAt(2).frame).toBe("pintona");
    expect(perksAt(3)).toMatchObject({ extraGrace: 1, discountPct: 0 });
    expect(perksAt(5)).toMatchObject({ extraGrace: 1, discountPct: 10, frame: "dorado" });
    expect(perksAt(6).extraGrace).toBe(2);
    expect(perksAt(8)).toEqual({ extraGrace: 2, discountPct: 20, frame: "kong" });
  });
  it("meta semanal crece con el nivel", () => {
    expect(weeklyGoalFor(1)).toBe(400);
    expect(weeklyGoalFor(8)).toBe(1000);
    expect(weeklyGoalFor(99)).toBe(1000);
  });
});

describe("multiplicador de racha", () => {
  it("escalones honestos", () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(2)).toBe(1);
    expect(streakMultiplier(3)).toBe(1.1);
    expect(streakMultiplier(7)).toBe(1.2);
    expect(streakMultiplier(13)).toBe(1.2);
    expect(streakMultiplier(14)).toBe(1.3);
    expect(streakMultiplier(30)).toBe(1.5);
    expect(streakMultiplier(400)).toBe(1.5);
  });
  it("bono = base x (mult - 1), redondeado hacia abajo y con tope", () => {
    expect(streakBonus(200, 7)).toBe(40); // x1.2
    expect(streakBonus(95, 3)).toBe(9); // 9,5 -> 9
    expect(streakBonus(100, 2)).toBe(0);
    expect(streakBonus(5000, 30)).toBe(150);
    expect(streakBonus(-50, 30)).toBe(0);
  });
  it("próximo escalón", () => {
    expect(nextStreakTier(5)).toEqual({ days: 7, mult: 1.2, left: 2 });
    expect(nextStreakTier(0)).toEqual({ days: 3, mult: 1.1, left: 3 });
    expect(nextStreakTier(31)).toBeNull();
  });
  it("historial por día local separa el bono y no lo usa como base", () => {
    const ev = [
      { kind: "workout", xp: 160, created_at: "2026-10-21T15:00:00Z" },
      { kind: "streak_bonus", xp: 32, created_at: "2026-10-21T15:01:00Z" },
      { kind: "challenge", xp: 300, created_at: "2026-10-21T16:00:00Z" },
      { kind: "meal", xp: 10, created_at: "2026-10-22T05:30:00Z" }, // 23:30 del 21 en Costa Rica
    ];
    const h = xpByDay(ev, ["2026-10-21", "2026-10-22"], "America/Costa_Rica");
    expect(h[0]).toEqual({ day: "2026-10-21", xp: 502, bonus: 32, base: 170 });
    expect(h[1].xp).toBe(0);
  });
});
