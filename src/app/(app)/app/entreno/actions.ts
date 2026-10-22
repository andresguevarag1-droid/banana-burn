"use server";
import { revalidatePath } from "next/cache";
import { createClient, getViewer } from "@/lib/supabase/server";
import { crToday } from "@/lib/today";

export type DoneSet = { kg: number | null; reps: number; rir: number | null };
export type Finished = { template: string; startedAt: string; fun: number; exercises: { id: string; sets: DoneSet[] }[]; xp: number; prs: number };

export async function saveWorkout(w: Finished): Promise<{ ok: boolean; demo?: boolean; error?: string }> {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Inicia sesión." };
  if (v.demo) return { ok: true, demo: true };
  const sb = await createClient();
  const { data: wk, error } = await sb.from("workouts").insert({
    user_id: v.id, day: crToday().iso, template: w.template, started_at: w.startedAt, finished_at: new Date().toISOString(), fun: Math.min(5, Math.max(1, Math.round(w.fun))), xp: Math.min(1000, Math.max(0, Math.round(w.xp))),
  }).select("id").single();
  if (error || !wk) return { ok: false, error: "No se pudo guardar el entreno." };
  const rows = w.exercises.flatMap((e) => e.sets.map((s, i) => ({ workout_id: wk.id, user_id: v.id, exercise: e.id, set_no: i + 1, kg: s.kg, reps: s.reps, rir: s.rir })));
  if (rows.length) {
    const r = await sb.from("workout_sets").insert(rows);
    if (r.error) return { ok: false, error: "Se guardó el entreno pero no las series." };
  }
  const prXp = Math.min(w.prs, 10) * 50;
  await sb.from("xp_events").insert([{ user_id: v.id, kind: "workout", xp: Math.max(0, w.xp - prXp) }, ...Array.from({ length: Math.min(w.prs, 10) }, () => ({ user_id: v.id, kind: "pr", xp: 50 }))]);
  revalidatePath("/app", "layout");
  return { ok: true };
}
