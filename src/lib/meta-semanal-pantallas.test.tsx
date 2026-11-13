// Hábito semanal (#288) en pantalla: la meta de la semana al frente en Hoy (bananas y racha semanal) dentro de "Tu semana"
// (#316, un solo número para la semana), los eventos del embudo y el progreso entre entrenos en el cierre.
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FUNNEL_EVENTS } from "@/app/api/track/event";

vi.mock("@/components/analytics", () => ({ track: () => {} }));
vi.mock("next/navigation", () => ({ usePathname: () => "/app", useRouter: () => ({ push() {}, refresh() {} }) }));
const { WeekLine, weeklyGoalLine } = await import("@/components/hoy/week-line");
const { WeekCard, weekGoalNote } = await import("@/components/hoy/week-card");
type Xp = Parameters<typeof WeekCard>[0]["s"];

const card = (over: Partial<Parameters<typeof WeekLine>[0]> = {}) =>
  renderToStaticMarkup(<WeekLine count={1} goal={3} monday="2026-11-09" weekStreak={0} {...over} />);

// Semana del 9 nov 2026 (lunes), hoy jueves 12: entrenó lunes, martes y miércoles; su programa trae 4 días con rutina.
const XP = { level: { idx: 2, n: "Banana pintona", progress: 0.4 }, next: { name: "Banana madura", xpLeft: 300 }, total: 900, today: { xp: 0 }, week: { xp: 240, goal: 300 }, sources: { workout: 0, meals: 0, weigh: 0 } } as unknown as Xp;
const WEEK = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"].map((d, i) => ({ d, active: i < 3, trained: i < 3 }));
const weekCard = (goal: number) => renderToStaticMarkup(<WeekCard s={XP} goal={{ count: 3, goal, monday: "2026-11-09", weekStreak: 1 }} week={WEEK} sched={{ 1: 1, 2: 1, 3: 1, 5: 1 }}
  todayIso="2026-11-12" training={false} weighed nutrition={false} />);
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("Hoy: meta de la semana", () => {
  it("\"Esta semana: 1 de 3 entrenos\" con una banana por entreno de la meta", () => {
    const html = card();
    expect(html).toContain("Esta semana: 1 de 3 entrenos");
    expect(html).toContain('aria-label="1 de 3 entrenos de tu meta semanal"');
    expect(html.match(/opacity-30/g)).toHaveLength(2);
  });

  it("la racha semanal va en la tarjeta; la diaria, solo en el saludo (#316)", () => {
    const html = card({ weekStreak: 2 });
    expect(html).toContain("2 semanas cumpliendo tu meta");
    expect(html).not.toContain("Racha diaria");
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

describe("Tu semana: un solo número para la semana (#316)", () => {
  it("la línea de la meta y lo que falta dicen la misma meta, aunque el plan traiga otra cantidad de días", () => {
    for (const goal of [3, 6]) {
      const t = text(weekCard(goal));
      expect(t).toContain(weeklyGoalLine(3, goal));
      const goals = [...t.matchAll(/de (\d+) entrenos?/g)].map((m) => Number(m[1]));
      expect(goals.length).toBeGreaterThan(0);
      expect(new Set(goals)).toEqual(new Set([goal]));
      expect(t).not.toMatch(/\b3\/4\b|para cumplir la semana|Racha/);
    }
    expect(text(weekCard(6))).toContain("Te faltan 3 entrenos para tu meta de la semana. Tu plan trae 4 días con rutina.");
    expect(text(weekCard(3))).toContain("Meta de la semana cumplida.");
  });

  it("el plan solo se nombra cuando trae otra cantidad de días que la meta", () => {
    expect(weekGoalNote(1, 3, 3)).toBe("Te faltan 2 entrenos para tu meta de la semana.");
    expect(weekGoalNote(2, 3, 5)).toBe("Te falta 1 entreno para tu meta de la semana. Tu plan trae 5 días con rutina.");
    expect(weekGoalNote(0, 3, 0)).toBe("Te faltan 3 entrenos para tu meta de la semana.");
  });

  it("Hoy pasa a Tu semana la meta de #288 y ya no muestra la línea aparte", () => {
    const page = readFileSync("src/app/(app)/app/page.tsx", "utf8");
    expect(page).toContain("<WeekCard s={xs} goal={{ count: weekCount(g.trainedDays, d.today.iso), goal: goalOf(monday)");
    expect(page).not.toContain("<WeekLine");
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
