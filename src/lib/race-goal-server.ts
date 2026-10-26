// La carrera objetivo de la persona (0054), sola para que la usen el hub de running y la temporada (la fuerza se
// acomoda alrededor de la carrera) sin importarse entre sí.
import "server-only";
import { cache } from "react";
import { createClient, type Viewer } from "@/lib/supabase/server";
import { todayFor } from "@/lib/today";
import { addDaysIso } from "@/lib/seasons";
import { RACE_KINDS, type RaceKind } from "@/lib/run-fitness";
import { mondayOf } from "@/lib/run-plan";

export type RaceGoal = {
  name: string | null; raceDate: string; kind: RaceKind; distanceM: number; goalS: number | null;
  recentDistanceM: number | null; recentS: number | null; ownPlan: boolean; hardDays: number[]; planStart: string; resultS: number | null; resultRun: string | null;
};

const toGoal = (r: Record<string, unknown>): RaceGoal => ({
  name: (r.name as string | null) ?? null, raceDate: String(r.race_date).slice(0, 10), kind: (RACE_KINDS.includes(r.kind as RaceKind) ? r.kind : "10k") as RaceKind,
  distanceM: Number(r.distance_m), goalS: r.goal_s == null ? null : Number(r.goal_s), recentDistanceM: r.recent_distance_m == null ? null : Number(r.recent_distance_m),
  recentS: r.recent_s == null ? null : Number(r.recent_s), ownPlan: !!r.own_plan, hardDays: Array.isArray(r.hard_days) ? (r.hard_days as number[]).map(Number) : [],
  planStart: String(r.plan_start).slice(0, 10), resultS: r.result_s == null ? null : Number(r.result_s), resultRun: (r.result_run as string | null) ?? null,
});

/** Carrera de ejemplo del modo demo: un 21K a 7 semanas. */
function demoGoal(today: string): RaceGoal {
  return { name: "Mi primer 21K", raceDate: addDaysIso(mondayOf(today), 48), kind: "21k", distanceM: 21097, goalS: 6900, recentDistanceM: 10000, recentS: 3120, ownPlan: false, hardDays: [], planStart: addDaysIso(today, -9), resultS: null, resultRun: null };
}

export const getRaceGoal = cache(async (v: Viewer): Promise<RaceGoal | null> => {
  if (v.demo) return demoGoal(todayFor(v).iso);
  const { data } = await (await createClient()).from("race_goals").select("*").eq("user_id", v.id).maybeSingle();
  return data ? toGoal(data as Record<string, unknown>) : null;
});

