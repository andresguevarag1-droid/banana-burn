"use server";
import { revalidatePath } from "next/cache";
import { createClient, getViewer } from "@/lib/supabase/server";
import { todayFor } from "@/lib/today";
import { workoutXp } from "@/lib/gamify";
import { getHistory } from "@/lib/history";
import { EX, type ExerciseId } from "@/lib/engine";
import { getLibEx } from "@/lib/library";
import { normalizeWorkout, serverPrs, type Finished } from "./validate";

const nameOf = (id: string) => (id.startsWith("ds:") ? getLibEx(id.slice(3))?.n : EX[id as ExerciseId]?.n) ?? id;

export type SaveResult = { ok: boolean; demo?: boolean; error?: string; postId?: string; xp?: number; prNames?: string[]; repeat?: boolean };

export async function saveWorkout(input: Finished): Promise<SaveResult> {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Inicia sesión." };
  const w = normalizeWorkout(input);
  if (!w) return { ok: false, error: "Datos del entreno inválidos." };
  if (v.demo) return { ok: true, demo: true };
  const sb = await createClient();
  const day = todayFor(v).iso;
  // El servidor recalcula XP y récords con su propio reloj y el historial guardado: no confiamos en lo que manda el navegador.
  const now = Date.now();
  let started = new Date(w.startedAt).getTime();
  if (!Number.isFinite(started) || started > now || now - started > 6 * 3600_000) started = now;
  const [{ data: same }, history] = await Promise.all([
    sb.from("workouts").select("id").eq("user_id", v.id).eq("day", day).eq("template", w.template).limit(1),
    getHistory(v, [...new Set(w.exercises.map((e) => e.id))]),
  ]);
  // Repetir la misma plantilla el mismo día queda guardado (sirve al motor), pero no vuelve a sumar XP.
  const repeat = (same ?? []).length > 0;
  const prIds = serverPrs(w.exercises, history);
  const doneSets = w.exercises.reduce((a, e) => a + e.sets.length, 0);
  const calc = workoutXp({ doneSets, totalSets: Math.max(doneSets, Math.min(w.total ?? doneSets, 60)), prs: prIds.length, seconds: (now - started) / 1000 });
  const xp = repeat ? 0 : calc.xp;
  const prNames = calc.rushed ? [] : prIds.slice(0, calc.prs).map(nameOf);
  const { data: wk, error } = await sb.from("workouts").insert({
    user_id: v.id, day, template: w.template, started_at: new Date(started).toISOString(), finished_at: new Date().toISOString(), fun: w.fun, xp,
  }).select("id").single();
  if (error || !wk) return { ok: false, error: "No pudimos guardar el entreno. Intenta de nuevo." };
  const rows = w.exercises.flatMap((e) => e.sets.map((s, i) => ({ workout_id: wk.id, user_id: v.id, exercise: e.id, set_no: i + 1, kg: s.kg, reps: s.reps, rir: s.rir })));
  if (rows.length) {
    const r = await sb.from("workout_sets").insert(rows);
    if (r.error) return { ok: false, error: "Guardamos el entreno, pero no las series. Intenta de nuevo." };
  }
  if (!repeat) {
    const prXp = calc.prs * 50;
    await sb.from("xp_events").insert([{ user_id: v.id, kind: "workout", xp: Math.max(0, xp - prXp) }, ...Array.from({ length: calc.prs }, () => ({ user_id: v.id, kind: "pr", xp: 50 }))]);
  }
  // Publicación automática en la comunidad (si el usuario lo permite)
  const { data: prof } = await sb.from("profiles").select("share_workouts,visibility").eq("id", v.id).maybeSingle();
  let postId: string | undefined;
  if (prof?.share_workouts !== false && !calc.rushed && !repeat) {
    const volume = Math.round(w.exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + (s.kg ?? 0) * s.reps, 0), 0));
    const mins = Math.max(1, Math.round((now - started) / 60000));
    const { data: post } = await sb.from("posts").insert({
      user_id: v.id, kind: "workout", workout_id: wk.id, body: w.note?.slice(0, 500) || null, visibility: prof?.visibility === "privado" ? "privado" : prof?.visibility ?? "seguidores",
      data: { title: w.title?.slice(0, 60), icon: /^[a-zA-Z]{1,24}$/.test(w.icon ?? "") ? w.icon : "barbell", mins: Math.min(mins, 240), sets: rows.length, volume, prs: prNames.slice(0, 10) },
    }).select("id").single();
    postId = post ? String(post.id) : undefined;
  }
  revalidatePath("/app", "layout");
  return { ok: true, postId, xp, prNames, repeat };
}
