"use server";
import { revalidatePath } from "next/cache";
import { createClient, getViewer } from "@/lib/supabase/server";
import { crToday } from "@/lib/today";

export type DoneSet = { kg: number | null; reps: number; rir: number | null };
export type Finished = { template: string; startedAt: string; fun: number; exercises: { id: string; sets: DoneSet[] }[]; xp: number };

export async function saveWorkout(w: Finished): Promise<{ ok: boolean; demo?: boolean; error?: string }> {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Inicia sesión." };
  if (v.demo) return { ok: true, demo: true };
  const sb = await createClient();
  const { data: wk, error } = await sb.from("workouts").insert({
    user_id: v.id, day: crToday().iso, template: w.template, started_at: w.startedAt, finished_at: new Date().toISOString(), fun: w.fun, xp: w.xp,
  }).select("id").single();
  if (error || !wk) return { ok: false, error: "No se pudo guardar el entreno." };
  const rows = w.exercises.flatMap((e) => e.sets.map((s, i) => ({ workout_id: wk.id, user_id: v.id, exercise: e.id, set_no: i + 1, kg: s.kg, reps: s.reps, rir: s.rir })));
  if (rows.length) {
    const r = await sb.from("workout_sets").insert(rows);
    if (r.error) return { ok: false, error: "Se guardó el entreno pero no las series." };
  }
  await sb.from("xp_events").insert({ user_id: v.id, kind: "workout", xp: w.xp });
  revalidatePath("/app", "layout");
  return { ok: true };
}
