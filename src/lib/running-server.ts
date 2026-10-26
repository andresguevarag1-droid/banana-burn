// Banana Run en el servidor: la carrera objetivo, quién tiene la Temporada Running (el plan, los ritmos y las marcas son
// parte de la temporada) y la vista completa del hub. La lógica pura vive en run-fitness.ts y run-plan.ts.
import "server-only";
import { cache } from "react";
import type { Viewer } from "@/lib/supabase/server";
import { todayFor } from "@/lib/today";
import { listRuns, type RunRow } from "@/lib/runs-server";
import { getRaceGoal, type RaceGoal } from "@/lib/race-goal-server";
export type { RaceGoal };
import { weeklyKm } from "@/lib/runs";
import { getIntake, getSeasonsView } from "@/lib/seasons-server";
import { addDaysIso, type SeasonInfo, type SeasonIntake } from "@/lib/seasons";
import { checkGoal, estimateFitness, personalBests, predictRace, type Bests, type Fitness, type GoalCheck } from "@/lib/run-fitness";
import { adaptPlan, buildPlan, daysBetween, matchRuns, mondayOf, nextRun, planPaces, runStreak, weekStreak, type Adjust, type MatchedRun, type RacePlan } from "@/lib/run-plan";

/** La Temporada Running vigente o próxima, y si la persona la tiene. */
export const getRunningSeason = cache(async (v: Viewer): Promise<{ season: SeasonInfo | null; owned: boolean; intake: SeasonIntake | null; access: boolean }> => {
  const view = await getSeasonsView(v);
  const season = view.seasons.find((s) => s.sport === "running") ?? null;
  const owned = !!season && view.owned.has(season.slug);
  const intake = owned && season ? (await getIntake(v, season.slug))?.answers ?? null : null;
  return { season, owned, intake, access: view.access };
});

export type RunningView = {
  today: string;
  runs: RunRow[];
  goal: RaceGoal | null;
  season: SeasonInfo | null;
  /** Tiene la Temporada Running: plan, ritmos, marcas, series guiadas y herramientas de carrera. */
  owned: boolean;
  access: boolean;
  intake: SeasonIntake | null;
  weeks: { weekStart: string; km: number }[];
  weekKm: number;
  /** Meta de km de esta semana (la del plan, o la que dijo en su cuestionario). */
  weekGoal: number | null;
  dayStreak: number;
  weekStreak: number;
  daysToRace: number | null;
  bests: Bests;
  fitness: Fitness | null;
  check: GoalCheck | null;
  plan: RacePlan | null;
  adjusts: Adjust[];
  next: MatchedRun | null;
  thisWeek: MatchedRun[];
};

/** Todo lo que ve el hub de running y el plan. */
export const getRunningView = cache(async (v: Viewer): Promise<RunningView> => {
  const today = todayFor(v).iso;
  const [runs, goal, rs] = await Promise.all([listRuns(v, 400), getRaceGoal(v), getRunningSeason(v)]);
  const weeks = weeklyKm(runs, today);
  const weekKm = weeks.at(-1)?.km ?? 0;
  const days = runs.map((r) => r.day);
  const daysToRace = goal && goal.raceDate >= today ? daysBetween(today, goal.raceDate) : null;
  const intake = rs.intake;
  const level = intake?.level ?? "recreativo";
  let fitness: Fitness | null = null, check: GoalCheck | null = null, plan: RacePlan | null = null, adjusts: Adjust[] = [], next: MatchedRun | null = null, thisWeek: MatchedRun[] = [];
  if (goal) {
    fitness = estimateFitness({ recent: goal.recentDistanceM && goal.recentS ? { distM: goal.recentDistanceM, timeS: goal.recentS } : null, runs, level, today });
    const weeksLeft = Math.max(1, Math.ceil(daysBetween(today, goal.raceDate) / 7));
    check = checkGoal({ fitness, kind: goal.kind, distM: goal.distanceM, goalS: goal.goalS, weeks: weeksLeft, level });
    // Ritmo de carrera: el de su meta si es alcanzable; si no, el que estimamos con el plan.
    const raceS = goal.goalS && check.status !== "muy_ambiciosa" ? goal.goalS : check.withPlan;
    if (!goal.ownPlan && goal.raceDate >= addDaysIso(today, -14)) {
      const r = intake?.running;
      const built = buildPlan({
        start: goal.planStart, raceDate: goal.raceDate, kind: goal.kind, distM: goal.distanceM, level,
        runDays: r?.runDays.length ? r.runDays : [1, 3, 5], longRunDay: r?.longRunDay ?? null, kmWeek: r?.kmWeek ?? 15,
        paces: planPaces(fitness.vdot, goal.distanceM, raceS), hills: r?.surface.includes("montana") || goal.kind === "trail",
      });
      const done = runs.map((x) => ({ id: x.id, day: x.day, distanceM: x.distanceM, movingS: x.movingS }));
      const a = adaptPlan(built, done, today, goal.planStart);
      plan = a.plan; adjusts = a.adjusts;
      next = nextRun(plan, done, today);
      thisWeek = matchRuns(plan.weeks.find((w) => w.start === mondayOf(today))?.runs ?? [], done, today);
    }
  }
  const planWeek = plan?.weeks.find((w) => w.start === mondayOf(today));
  const weekGoal = planWeek?.km ?? intake?.running?.kmWeek ?? null;
  return {
    today, runs, goal, season: rs.season, owned: rs.owned, access: rs.access, intake, weeks, weekKm, weekGoal: weekGoal || null,
    dayStreak: runStreak(days, today), weekStreak: weekStreak(days, today), daysToRace, bests: personalBests(runs), fitness, check, plan, adjusts, next, thisWeek,
  };
});

/** Predicción simple para la vista previa (sin temporada): solo el tiempo estimado hoy. */
export const previewPrediction = (goal: RaceGoal, fitness: Fitness) => predictRace(fitness.vdot, goal.kind, goal.distanceM);
