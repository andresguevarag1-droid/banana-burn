import { createClient, type Viewer } from "@/lib/supabase/server";
import { e1rm, EX } from "@/lib/engine";
import { TPL } from "@/lib/engine/data";
import { getLibEx } from "@/lib/library";
import { todayFor } from "@/lib/today";
import { demoWeights, demoWorkouts } from "@/lib/demo-story";

export type Point = { d: string; v: number };
export type Lift = { id: string; name: string; pts: Point[] };
export type WorkoutRow = { d: string; tpl: string; sets: number; vol: number; mins: number | null; fun: number };

/** Cuántos ejercicios de fuerza seguimos y en qué ventana. */
export const LIFTS_MAX = 5;
export const LIFTS_WEEKS = 8;
/** Básicos del motor (otras pantallas los consultan por id en `lifts`). */
export const MAIN_LIFTS = ["squat", "bench", "deadlift", "ohp", "row"] as const;
const byId = (l: Lift[]) => Object.fromEntries(l.map((x) => [x.id, x.pts])) as Record<string, Point[]>;

const addDays = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

/** Nombre legible de un ejercicio guardado (motor o biblioteca "ds:0043"). */
export function exerciseName(id: string) {
  if (id.startsWith("ds:")) return getLibEx(id.slice(3))?.n ?? "Ejercicio de la biblioteca";
  return EX[id as keyof typeof EX]?.n ?? id;
}

/** Nombre legible de la sesión guardada en workouts.template (pushA, expres20, descanso...). */
export function workoutName(tpl: string) {
  if (tpl in TPL) return TPL[tpl as keyof typeof TPL].n;
  const m = /^expres(\d+)$/.exec(tpl);
  if (m) return `Exprés ${m[1]} min`;
  if (tpl === "descanso") return "Descanso activo";
  return tpl;
}

/**
 * Elige los ejercicios que el usuario realmente registró con carga: los más frecuentes (en días distintos)
 * y, a igualdad, los más recientes. Cada punto es el mejor 1RM estimado del día.
 */
export function pickLifts(sets: { exercise: string; kg: number | null; reps: number | null; day: string }[], max = LIFTS_MAX): Lift[] {
  const best = new Map<string, Map<string, number>>();
  for (const s of sets) {
    const kg = Number(s.kg), reps = Number(s.reps);
    if (!(kg > 0) || !(reps > 0)) continue;
    const m = best.get(s.exercise) ?? new Map<string, number>();
    best.set(s.exercise, m);
    m.set(s.day, Math.max(m.get(s.day) ?? 0, e1rm(kg, reps)));
  }
  return [...best.entries()]
    .map(([id, m]) => ({ id, name: exerciseName(id), pts: [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([d, v]) => ({ d, v: Math.round(v * 10) / 10 })) }))
    .sort((a, b) => b.pts.length - a.pts.length || b.pts.at(-1)!.d.localeCompare(a.pts.at(-1)!.d))
    .slice(0, max);
}

const minutesBetween = (a: unknown, b: unknown) => {
  if (!a || !b) return null;
  const m = Math.round((new Date(String(b)).getTime() - new Date(String(a)).getTime()) / 60000);
  return m > 0 && m < 300 ? m : null;
};

function demo(v: Viewer) {
  const t = todayFor(v).iso;
  const weights: Point[] = demoWeights(t);
  const done = demoWorkouts(t);
  // Fuerza: los 5 básicos de Pierna y empuje A (sentadilla, banca, militar) y Tracción A (peso muerto, remo), en los días que los hizo.
  const base: [string, string, number, number][] = [["squat", "pushA", 96, 0.09], ["bench", "pushA", 88, 0.045], ["deadlift", "pullA", 130, 0.07], ["ohp", "pushA", 50, 0.02], ["row", "pullA", 64, 0.055]];
  const lifts: Lift[] = base.map(([id, tpl, b, g]) => {
    const days = done.filter((w) => w.tplId === tpl).map((w) => w.d).reverse();
    return { id, name: exerciseName(id), pts: days.map((d, i) => ({ d, v: Math.round(b * (1 + (g * i) / Math.max(1, days.length - 1) + Math.sin(i * 2 + b) * 0.008) * 10) / 10 })) };
  });
  const vol: Record<string, [number, number, number]> = { pushA: [13, 7420, 58], pullA: [12, 6840, 55], core: [9, 0, 40], pushB: [13, 5980, 56], pullB: [11, 6120, 52], pump: [9, 1980, 35] };
  const workouts: WorkoutRow[] = done.slice(0, 10).map((w, i) => ({ d: w.d, tpl: w.tpl, sets: vol[w.tplId][0], vol: Math.round(vol[w.tplId][1] * (1 - i * 0.012)), mins: vol[w.tplId][2], fun: 4 + (i % 2) }));
  return { weights, lifts: byId(lifts), tracked: lifts, workouts };
}

export async function getProgress(v: Viewer) {
  if (v.demo) return demo(v);
  const sb = await createClient();
  const today = todayFor(v).iso;
  const since = addDays(today, -120), sinceLifts = addDays(today, -7 * LIFTS_WEEKS);
  const [{ data: w }, { data: sets }, { data: wk }] = await Promise.all([
    sb.from("weights").select("day,kg").eq("user_id", v.id).gte("day", since).order("day"),
    sb.from("workout_sets").select("exercise,kg,reps,workouts!inner(day)").eq("user_id", v.id).gt("kg", 0).gte("workouts.day", sinceLifts).limit(3000),
    sb.from("workouts").select("id,day,template,fun,started_at,finished_at,workout_sets(kg,reps)").eq("user_id", v.id).order("day", { ascending: false }).limit(10),
  ]);
  const weights = (w ?? []).map((r) => ({ d: r.day as string, v: Number(r.kg) }));
  const rows = (sets ?? []) as unknown as { exercise: string; kg: number | null; reps: number | null; workouts: { day: string } }[];
  const lifts = pickLifts(rows.map((r) => ({ exercise: r.exercise, kg: r.kg, reps: r.reps, day: r.workouts.day })));
  const workouts: WorkoutRow[] = (wk ?? []).map((r) => {
    const s = (r.workout_sets ?? []) as { kg: number | null; reps: number }[];
    return { d: r.day as string, tpl: workoutName(String(r.template ?? "")), sets: s.length, vol: Math.round(s.reduce((a, x) => a + (Number(x.kg) || 0) * (x.reps || 0), 0)), mins: minutesBetween(r.started_at, r.finished_at), fun: r.fun as number };
  });
  return { weights, lifts: byId(lifts), tracked: lifts, workouts };
}
