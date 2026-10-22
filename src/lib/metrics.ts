import type { Viewer } from "@/lib/supabase/server";
import { dashboard, getAthlete } from "@/lib/athlete";
import { getDaily } from "@/lib/daily";
import { getMeals, sumMeals } from "@/lib/meals";
import type { Metrics } from "@/lib/challenges-server";

/** Métricas de hoy para verificar retos automáticamente. */
export async function todayMetrics(v: Viewer): Promise<Metrics> {
  const a = await getAthlete(v);
  const d = dashboard(a);
  const [g, meals] = await Promise.all([getDaily(v, a.startWeight, a.currentWeight), getMeals(v)]);
  return { workout: g.trainedToday, steps: g.log.steps, water: g.log.water, protein: g.log.protein + sumMeals(meals.today).protein, proteinGoal: d.t.protein };
}
