import { createClient, type Viewer } from "@/lib/supabase/server";
import { e1rm, EX } from "@/lib/engine";
import { crToday } from "@/lib/today";

export type Point = { d: string; v: number };
export const MAIN_LIFTS = ["squat", "bench", "deadlift", "ohp", "row"] as const;

const addDays = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

function demo() {
  const t = crToday().iso;
  const weights: Point[] = [];
  for (let i = 42; i >= 0; i--) {
    if (i % 3 === 1 && i > 6) continue; // no todos los días se pesa
    const noise = Math.sin(i * 1.7) * 0.35 + Math.cos(i * 0.9) * 0.15;
    weights.push({ d: addDays(t, -i), v: Math.round((93.1 + i * 0.085 + noise) * 10) / 10 });
  }
  const base: Record<string, [number, number]> = { squat: [96, 0.09], bench: [88, 0.045], deadlift: [130, 0.07], ohp: [50, 0.02], row: [64, 0.055] };
  const lifts: Record<string, Point[]> = {};
  for (const k of MAIN_LIFTS) {
    const [b, g] = base[k];
    lifts[k] = [-37, -30, -23, -16, -9, -2].map((o, i) => ({ d: addDays(t, o), v: Math.round(b * (1 + (g * i) / 5 + Math.sin(i * 2 + b) * 0.008) * 10) / 10 }));
  }
  const workouts = [
    { d: addDays(t, -2), tpl: "Tracción A", sets: 12, vol: 6840, fun: 5 },
    { d: addDays(t, -3), tpl: "Empuje A", sets: 13, vol: 7420, fun: 4 },
    { d: addDays(t, -5), tpl: "Bombeo + Reto", sets: 9, vol: 1980, fun: 5 },
  ];
  return { weights, lifts, workouts };
}

export async function getProgress(v: Viewer) {
  if (v.demo) return demo();
  const sb = await createClient();
  const since = addDays(crToday().iso, -120);
  const [{ data: w }, { data: sets }, { data: wk }] = await Promise.all([
    sb.from("weights").select("day,kg").eq("user_id", v.id).gte("day", since).order("day"),
    sb.from("workout_sets").select("exercise,kg,reps,workouts!inner(day)").eq("user_id", v.id).in("exercise", [...MAIN_LIFTS]).gte("workouts.day", since).limit(2000),
    sb.from("workouts").select("id,day,template,fun,workout_sets(kg,reps)").eq("user_id", v.id).order("day", { ascending: false }).limit(10),
  ]);
  const weights = (w ?? []).map((r) => ({ d: r.day as string, v: Number(r.kg) }));
  const best: Record<string, Map<string, number>> = {};
  for (const r of (sets ?? []) as unknown as { exercise: string; kg: number | null; reps: number; workouts: { day: string } }[]) {
    if (!r.kg || !r.reps) continue;
    const m = (best[r.exercise] ??= new Map());
    const val = e1rm(Number(r.kg), r.reps);
    m.set(r.workouts.day, Math.max(m.get(r.workouts.day) ?? 0, val));
  }
  const lifts: Record<string, Point[]> = {};
  for (const k of MAIN_LIFTS) lifts[k] = [...(best[k] ?? new Map()).entries()].sort().map(([d, v]) => ({ d, v }));
  const workouts = (wk ?? []).map((r) => {
    const s = (r.workout_sets ?? []) as { kg: number | null; reps: number }[];
    return { d: r.day as string, tpl: r.template as string, sets: s.length, vol: Math.round(s.reduce((a, x) => a + (Number(x.kg) || 0) * (x.reps || 0), 0)), fun: r.fun as number };
  });
  return { weights, lifts, workouts };
}

export const liftName = (k: string) => EX[k as keyof typeof EX]?.n ?? k;
