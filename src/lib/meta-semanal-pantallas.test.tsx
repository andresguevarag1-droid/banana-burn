// Hábito semanal (#288) en pantalla: la meta de la semana al frente en Hoy (bananas, racha semanal y la diaria debajo), los
// eventos del embudo y el progreso entre entrenos en el cierre.
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FUNNEL_EVENTS } from "@/app/api/track/event";

vi.mock("@/components/analytics", () => ({ track: () => {} }));
const { WeekLine, weeklyGoalLine } = await import("@/components/hoy/week-line");

const card = (over: Partial<Parameters<typeof WeekLine>[0]> = {}) =>
  renderToStaticMarkup(<WeekLine count={1} goal={3} monday="2026-11-09" weekStreak={0} streak={2} todayDone={false} {...over} />);

describe("Hoy: meta de la semana", () => {
  it("\"Esta semana: 1 de 3 entrenos\" con una banana por entreno de la meta", () => {
    const html = card();
    expect(html).toContain("Esta semana: 1 de 3 entrenos");
    expect(html).toContain('aria-label="1 de 3 entrenos de tu meta semanal"');
    expect(html.match(/opacity-30/g)).toHaveLength(2);
  });

  it("la racha semanal va al frente y la diaria queda secundaria", () => {
    const html = card({ weekStreak: 2 });
    const weekly = html.indexOf("2 semanas cumpliendo tu meta"), daily = html.indexOf("Racha diaria: 2 días");
    expect(weekly).toBeGreaterThan(0);
    expect(daily).toBeGreaterThan(weekly);
    expect(card()).toContain("Tu meta: 3 entrenos por semana");
  });

  it("meta cumplida", () => {
    expect(weeklyGoalLine(3, 3)).toBe("Meta cumplida: 3 de 3 entrenos");
    expect(card({ count: 3 })).not.toContain("opacity-30");
  });

  it("sin emojis ni exclamaciones", () => {
    const text = card({ weekStreak: 1 }).replace(/<[^>]+>/g, " ");
    expect(text).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]|!/u);
  });

  it("Hoy la arma con la meta, el conteo de su zona horaria y la racha semanal", () => {
    const page = readFileSync("src/app/(app)/app/page.tsx", "utf8");
    expect(page).toContain("weeklyGoal({ trainDays: a.trainDays, regDay, monday: mon })");
    expect(page).toContain("weekCount(g.trainedDays, d.today.iso)");
    expect(page).toContain("weeklyStreak(g.trainedDays, d.today.iso, goalOf, regDay)");
  });
});

describe("medir", () => {
  it("weekly_goal_view y weekly_goal_done son eventos del embudo", () => {
    expect(FUNNEL_EVENTS).toContain("weekly_goal_view");
    expect(FUNNEL_EVENTS).toContain("weekly_goal_done");
    const src = readFileSync("src/components/hoy/weekly-goal-tracker.tsx", "utf8");
    expect(src).toContain('track("weekly_goal_view"');
    expect(src).toContain('track("weekly_goal_done"');
  });
});

describe("cierre: progreso entre entrenos y plan de la semana", () => {
  it("el reproductor pasa al cierre lo que cambió en cada ejercicio repetido, con sus series de la vez pasada", () => {
    const player = readFileSync("src/app/(app)/app/entreno/player.tsx", "utf8");
    expect(player).toContain("progressLine(e.lastSets,");
    expect(player).toContain("<Recap week={week} progress={progress} ");
    const recap = readFileSync("src/components/workout/recap.tsx", "utf8");
    expect(recap).toContain("Desde la vez pasada");
  });

  it("el plan de la semana sale de su plan y de la meta, contando el entreno de hoy", () => {
    const page = readFileSync("src/app/(app)/app/entreno/page.tsx", "utf8");
    expect(page).toContain("weekCount(g.trainedDays, d.today.iso) + (g.trainedToday ? 0 : 1)");
    expect(page).toContain("suggestDays(d.engineSched, d.today.iso, count, goal)");
  });
});
