import { createClient, type Viewer } from "@/lib/supabase/server";
import { crToday } from "@/lib/today";
import { badges, levelOf, streakOf } from "@/lib/gamify";

export type DailyLog = { water: number; steps: number; sleep: number; protein: number; kcal: number };
export const EMPTY: DailyLog = { water: 0, steps: 0, sleep: 0, protein: 0, kcal: 0 };

const addDays = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

export async function getDaily(v: Viewer, startWeight: number, currentWeight: number) {
  const today = crToday().iso;
  if (v.demo) {
    const days = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => addDays(today, -i - 1)));
    const xp = 1180;
    const streak = streakOf(days, today);
    return {
      log: { water: 3, steps: 4820, sleep: 7.5, protein: 92, kcal: 1240 } as DailyLog,
      xp, level: levelOf(xp), streak, workoutsTotal: 9, trainedToday: false, weighedToday: false,
      week: [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(today, -6 + i)).map((d) => ({ d, active: days.has(d) })),
      badges: badges({ workouts: 9, streak: streak.days, prs: 3, weighIns: 11, lostKg: startWeight - currentWeight }),
    };
  }
  const sb = await createClient();
  const since = addDays(today, -90);
  const [{ data: log }, { data: wk }, { data: dl }, { data: ws }, { data: xpRows }, { count: prs }] = await Promise.all([
    sb.from("daily_logs").select("water_glasses,steps,sleep_h,protein_g,kcal").eq("user_id", v.id).eq("day", today).maybeSingle(),
    sb.from("workouts").select("day").eq("user_id", v.id).gte("day", since),
    sb.from("daily_logs").select("day").eq("user_id", v.id).gte("day", since),
    sb.from("weights").select("day").eq("user_id", v.id),
    sb.from("xp_events").select("xp").eq("user_id", v.id),
    sb.from("xp_events").select("*", { count: "exact", head: true }).eq("user_id", v.id).eq("kind", "pr"),
  ]);
  const active = new Set<string>([...(wk ?? []), ...(dl ?? []), ...(ws ?? []).filter((w) => w.day >= since)].map((r) => r.day as string));
  const xp = (xpRows ?? []).reduce((a, r) => a + (r.xp as number), 0);
  const streak = streakOf(active, today);
  const workoutsTotal = (await sb.from("workouts").select("*", { count: "exact", head: true }).eq("user_id", v.id)).count ?? 0;
  return {
    log: { water: log?.water_glasses ?? 0, steps: log?.steps ?? 0, sleep: Number(log?.sleep_h ?? 0), protein: log?.protein_g ?? 0, kcal: log?.kcal ?? 0 },
    xp, level: levelOf(xp), streak, workoutsTotal,
    trainedToday: (wk ?? []).some((w) => w.day === today),
    weighedToday: (ws ?? []).some((w) => w.day === today),
    week: [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(today, -6 + i)).map((d) => ({ d, active: active.has(d) })),
    badges: badges({ workouts: workoutsTotal, streak: streak.days, prs: prs ?? 0, weighIns: (ws ?? []).length, lostKg: startWeight - currentWeight }),
  };
}
