"use server";
import { revalidatePath } from "next/cache";
import { createClient, getViewer } from "@/lib/supabase/server";
import { todayFor } from "@/lib/today";
import { workoutXp } from "@/lib/gamify";

export type DoneSet = { kg: number | null; reps: number; rir: number | null };
export type Finished = { template: string; startedAt: string; fun: number; exercises: { id: string; sets: DoneSet[] }[]; xp: number; prs: number; total?: number; title?: string; icon?: string; prNames?: string[]; note?: string };

const fin = (x: unknown, lo: number, hi: number) => (typeof x === "number" && Number.isFinite(x) && x >= lo && x <= hi);

/** El navegador manda el entreno: acotamos tamaños y valores antes de tocar la base de datos. */
async function normalizeWorkout(w: Finished): Promise<Finished | null> {
  if (!w || typeof w !== "object" || !Array.isArray(w.exercises) || w.exercises.length > 30) return null;
  if (typeof w.template !== "string" || !/^[A-Za-z0-9 _.:áéíóúñÁÉÍÓÚÑ+-]{1,60}$/.test(w.template)) return null;
  const exercises: Finished["exercises"] = [];
  for (const e of w.exercises) {
    if (!e || typeof e.id !== "string" || !/^[A-Za-z0-9_]{1,40}$/.test(e.id) || !Array.isArray(e.sets) || e.sets.length > 12) return null;
    const sets: DoneSet[] = [];
    for (const s of e.sets) {
      if (!s || !fin(s.reps, 0, 100) || !(s.kg === null || fin(s.kg, 0, 500)) || !(s.rir === null || s.rir === undefined || fin(s.rir, 0, 10))) return null;
      sets.push({ kg: s.kg === null ? null : Math.round(s.kg * 100) / 100, reps: Math.round(s.reps), rir: s.rir == null ? null : Math.round(s.rir) });
    }
    exercises.push({ id: e.id, sets });
  }
  return {
    template: w.template, startedAt: String(w.startedAt ?? ""), fun: fin(w.fun, 1, 5) ? w.fun : 3, exercises, xp: 0,
    prs: fin(w.prs, 0, 100) ? w.prs : 0, total: fin(w.total, 0, 200) ? w.total : undefined,
    title: typeof w.title === "string" ? w.title.slice(0, 60) : undefined, icon: typeof w.icon === "string" ? w.icon : undefined,
    prNames: Array.isArray(w.prNames) ? w.prNames.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 60)) : [],
    note: typeof w.note === "string" ? w.note : undefined,
  };
}

export async function saveWorkout(input: Finished): Promise<{ ok: boolean; demo?: boolean; error?: string; postId?: string }> {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Inicia sesión." };
  let w = await normalizeWorkout(input);
  if (!w) return { ok: false, error: "Datos del entreno inválidos." };
  if (v.demo) return { ok: true, demo: true };
  const sb = await createClient();
  // El servidor recalcula XP y récords con su propio reloj: no confiamos en lo que manda el navegador.
  const now = Date.now();
  let started = new Date(w.startedAt).getTime();
  if (!Number.isFinite(started) || started > now || now - started > 6 * 3600_000) started = now;
  const doneSets = w.exercises.reduce((a, e) => a + e.sets.length, 0);
  const calc = workoutXp({ doneSets, totalSets: Math.max(doneSets, Math.min(w.total ?? doneSets, 60)), prs: w.prs, seconds: (now - started) / 1000 });
  w = { ...w, xp: calc.xp, prs: calc.prs, prNames: calc.rushed ? [] : (w.prNames ?? []).slice(0, calc.prs) };
  const { data: wk, error } = await sb.from("workouts").insert({
    user_id: v.id, day: todayFor(v).iso, template: w.template, started_at: new Date(started).toISOString(), finished_at: new Date().toISOString(), fun: Math.min(5, Math.max(1, Math.round(w.fun))), xp: w.xp,
  }).select("id").single();
  if (error || !wk) return { ok: false, error: "No pudimos guardar el entreno. Intenta de nuevo." };
  const rows = w.exercises.flatMap((e) => e.sets.map((s, i) => ({ workout_id: wk.id, user_id: v.id, exercise: e.id, set_no: i + 1, kg: s.kg, reps: s.reps, rir: s.rir })));
  if (rows.length) {
    const r = await sb.from("workout_sets").insert(rows);
    if (r.error) return { ok: false, error: "Guardamos el entreno, pero no las series. Intenta de nuevo." };
  }
  const prXp = w.prs * 50;
  await sb.from("xp_events").insert([{ user_id: v.id, kind: "workout", xp: Math.max(0, w.xp - prXp) }, ...Array.from({ length: w.prs }, () => ({ user_id: v.id, kind: "pr", xp: 50 }))]);
  // Publicación automática en la comunidad (si el usuario lo permite)
  const { data: prof } = await sb.from("profiles").select("share_workouts,visibility").eq("id", v.id).maybeSingle();
  let postId: string | undefined;
  if (prof?.share_workouts !== false && !calc.rushed) {
    const volume = Math.round(w.exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + (s.kg ?? 0) * s.reps, 0), 0));
    const mins = Math.max(1, Math.round((now - started) / 60000));
    const { data: post } = await sb.from("posts").insert({
      user_id: v.id, kind: "workout", workout_id: wk.id, body: w.note?.slice(0, 500) || null, visibility: prof?.visibility === "privado" ? "privado" : prof?.visibility ?? "seguidores",
      data: { title: w.title?.slice(0, 60), icon: /^[a-zA-Z]{1,24}$/.test(w.icon ?? "") ? w.icon : "barbell", mins: Math.min(mins, 240), sets: rows.length, volume, prs: (w.prNames ?? []).slice(0, 10) },
    }).select("id").single();
    postId = post ? String(post.id) : undefined;
  }
  revalidatePath("/app", "layout");
  return { ok: true, postId };
}
