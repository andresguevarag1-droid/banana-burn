import { createClient, type Viewer } from "@/lib/supabase/server";
import { DEMO_PRS, demoActiveDays, demoWeighIns, demoWorkouts, demoXp } from "@/lib/demo-story";
import { todayFor } from "@/lib/today";
import { badges, levelOf, streakOf } from "@/lib/gamify";
import { getXpTotal } from "@/lib/xp-total";
import { getSex } from "@/lib/athlete";

export type DailyLog = { water: number; steps: number; sleep: number; protein: number; kcal: number; energy?: number; nausea?: number; fiber?: number };
export const EMPTY: DailyLog = { water: 0, steps: 0, sleep: 0, protein: 0, kcal: 0 };

const addDays = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

/** Semana local del usuario, de lunes a domingo (igual que Entrenar). */
export function weekDays(today: string) {
  const dow = new Date(today + "T12:00:00").getDay();
  const monday = addDays(today, -((dow + 6) % 7));
  return [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(monday, i));
}

/** Saludo según la hora local del usuario (5-11 h, 12-18 h, resto). */
export function greetingAt(tz: string, now = new Date()) {
  let h = now.getUTCHours();
  try { h = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(now)) % 24; } catch { /* zona inválida: UTC */ }
  return h >= 5 && h < 12 ? "Buenos días" : h >= 12 && h < 19 ? "Buenas tardes" : "Buenas noches";
}

export async function getDaily(v: Viewer, startWeight: number, currentWeight: number) {
  const today = todayFor(v).iso;
  if (v.demo) {
    const days = demoActiveDays(today);
    const xp = demoXp(today);
    const nW = demoWorkouts(today).length;
    const trainedD = new Set(demoWorkouts(today).map((w) => w.d));
    const streak = streakOf(days, today);
    return {
      log: { water: 5, steps: 4820, sleep: 7.5, protein: 0, kcal: 0 } as DailyLog,
      xp, level: levelOf(xp, await getSex(v)), streak, workoutsTotal: nW, trainedToday: false, weighedToday: false,
      week: weekDays(today).map((d) => ({ d, active: days.has(d), trained: trainedD.has(d) })),
      badges: badges({ workouts: nW, streak: streak.days, prs: DEMO_PRS, weighIns: demoWeighIns(today), lostKg: startWeight - currentWeight }),
    };
  }
  const sb = await createClient();
  const since = addDays(today, -90);
  // Medalla "Tester beta" (0029): si alguna vez fue tester. Sin la migración, sin medalla. Va en paralelo con lo demás.
  const testerQ = Promise.resolve(sb.from("tester_grants").select("id", { count: "exact", head: true }).eq("user_id", v.id)).then((r) => (r.error ? { count: 0 } : r), () => ({ count: 0 }));
  // Con mucho historial, una lectura sin filtro se corta en 1000 filas: los totales van con count o paginados.
  const [{ data: log }, { data: wk }, { data: dl }, { data: ws }, { count: weighIns }, xp, { count: prs }, { count: workoutsTotal }] = await Promise.all([
    sb.from("daily_logs").select("water_glasses,steps,sleep_h,protein_g,kcal,energy,nausea,fiber_g").eq("user_id", v.id).eq("day", today).maybeSingle(),
    sb.from("workouts").select("day").eq("user_id", v.id).gte("day", since),
    sb.from("daily_logs").select("day").eq("user_id", v.id).gte("day", since),
    sb.from("weights").select("day").eq("user_id", v.id).gte("day", since),
    sb.from("weights").select("*", { count: "exact", head: true }).eq("user_id", v.id),
    getXpTotal(v),
    sb.from("xp_events").select("*", { count: "exact", head: true }).eq("user_id", v.id).eq("kind", "pr"),
    sb.from("workouts").select("*", { count: "exact", head: true }).eq("user_id", v.id),
  ]);
  const { count: testerGrants } = await testerQ;
  const active = new Set<string>([...(wk ?? []), ...(dl ?? []), ...(ws ?? [])].map((r) => r.day as string));
  const streak = streakOf(active, today);
  return {
    log: { water: log?.water_glasses ?? 0, steps: log?.steps ?? 0, sleep: Number(log?.sleep_h ?? 0), protein: log?.protein_g ?? 0, kcal: log?.kcal ?? 0, energy: log?.energy ?? 0, nausea: log?.nausea ?? 0, fiber: log?.fiber_g ?? 0 },
    xp, level: levelOf(xp, await getSex(v)), streak, workoutsTotal: workoutsTotal ?? 0,
    trainedToday: (wk ?? []).some((w) => w.day === today),
    weighedToday: (ws ?? []).some((w) => w.day === today),
    week: weekDays(today).map((d) => ({ d, active: active.has(d), trained: (wk ?? []).some((w) => w.day === d) })),
    badges: badges({ workouts: workoutsTotal ?? 0, streak: streak.days, prs: prs ?? 0, weighIns: weighIns ?? 0, lostKg: startWeight - currentWeight, tester: (testerGrants ?? 0) > 0 }),
  };
}
