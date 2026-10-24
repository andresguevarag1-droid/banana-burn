"use server";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { creditChallenges, getCatalog } from "@/lib/challenges-server";
import { createClient, getViewer } from "@/lib/supabase/server";
import { accessError } from "@/lib/entitlements";
import { todayFor } from "@/lib/today";
import { workoutXp } from "@/lib/gamify";
import { getHistory } from "@/lib/history";
import { EX, type ExerciseId } from "@/lib/engine";
import { getLibEx } from "@/lib/library";
import { normalizeWorkout, serverPrs, workoutTiming, type Finished } from "./validate";
import { errCode, logError } from "@/lib/log";
import { parseProgramTemplate, weeksOf } from "@/lib/programs";
import { limitError } from "@/lib/security/limits";

const nameOf = (id: string) => (id.startsWith("ds:") ? getLibEx(id.slice(3))?.n : EX[id as ExerciseId]?.n) ?? id;

export type SaveResult = { ok: boolean; demo?: boolean; error?: string; postId?: string; xp?: number; prNames?: string[]; repeat?: boolean; /** Ya estaba guardado (doble envío o reintento al volver la señal). */ already?: boolean };

const SAVE_FAILED = "No pudimos guardar el entreno. Tu entreno sigue en este teléfono: intenta de nuevo.";

/**
 * Guarda un entreno terminado. Nunca lanza al navegador: siempre responde { ok, error }.
 * Es seguro llamarla dos veces con el mismo entreno (doble toque, reintento sin señal): se reconoce por su hora de inicio.
 */
export async function saveWorkout(input: Finished): Promise<SaveResult> {
  try {
    return await save(input);
  } catch (e) {
    unstable_rethrow(e);
    logError("entreno", "save_failed", { kind: errCode(e) });
    return { ok: false, error: SAVE_FAILED };
  }
}

async function save(input: Finished): Promise<SaveResult> {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar; tu entreno sigue guardado en este teléfono." };
  { const lim = v.demo ? null : await limitError("entreno:guardar", v.id); if (lim) return { ok: false, error: lim }; }
  const w = normalizeWorkout(input);
  if (!w) return { ok: false, error: "Datos del entreno inválidos." };
  if (v.demo) return { ok: true, demo: true };
  const denied = await accessError(v, "app"); // sin plan ni prueba: no se guarda (la base lo repite con RLS, 0025)
  if (denied) return { ok: false, error: denied };
  const sb = await createClient();
  // El servidor recalcula XP y récords con su propio reloj y el historial guardado: no confiamos en lo que manda el navegador.
  const now = Date.now();
  const t = workoutTiming(w.startedAt, w.finishedAt, now);
  // El día es el del inicio en la zona de la persona: un entreno de las 11 p. m. que sube al otro día sin señal conserva su fecha.
  const day = todayFor(v, new Date(t.started)).iso;
  const rows = (workoutId: string | number) => w.exercises.flatMap((e) => e.sets.map((s, i) => ({ workout_id: workoutId, user_id: v.id, exercise: e.id, set_no: i + 1, kg: s.kg, reps: s.reps, rir: s.rir })));

  // Doble envío: mismo usuario, plantilla y hora de inicio. Si quedó sin series (falla a medias), se completan ahora.
  if (t.clientStart) {
    const { data: dup, error: dupErr } = await sb.from("workouts").select("id,xp").eq("user_id", v.id).eq("template", w.template).eq("started_at", t.startIso).limit(1).maybeSingle();
    if (dupErr) return { ok: false, error: SAVE_FAILED };
    if (dup) {
      const { count } = await sb.from("workout_sets").select("id", { count: "exact", head: true }).eq("workout_id", dup.id);
      const pending = rows(dup.id);
      if (!count && pending.length) {
        const r = await sb.from("workout_sets").insert(pending);
        if (r.error) return { ok: false, error: SAVE_FAILED };
        revalidatePath("/app", "layout");
      }
      return { ok: true, already: true, xp: Number(dup.xp ?? 0), prNames: [] };
    }
  }

  const [{ data: same }, history] = await Promise.all([
    sb.from("workouts").select("id").eq("user_id", v.id).eq("day", day).eq("template", w.template).limit(1),
    getHistory(v, [...new Set(w.exercises.map((e) => e.id))]),
  ]);
  // Repetir la misma plantilla el mismo día queda guardado (sirve al motor), pero no vuelve a sumar XP.
  const repeat = (same ?? []).length > 0;
  const prIds = serverPrs(w.exercises, history);
  const doneSets = w.exercises.reduce((a, e) => a + e.sets.length, 0);
  const calc = workoutXp({ doneSets, totalSets: Math.max(doneSets, Math.min(w.total ?? doneSets, 60)), prs: prIds.length, seconds: t.seconds });
  const xp = repeat ? 0 : calc.xp;
  const prNames = calc.rushed ? [] : prIds.slice(0, calc.prs).map(nameOf);
  const { data: wk, error } = await sb.from("workouts").insert({
    user_id: v.id, day, template: w.template, started_at: t.startIso, finished_at: new Date(t.finished).toISOString(), fun: w.fun, xp,
  }).select("id").single();
  if (error?.code === "23505") return { ok: true, already: true, xp: 0, prNames: [] };
  if (error?.hint === "rate_limit" || /Demasiadas acciones/.test(error?.message ?? "")) return { ok: false, error: "Llegaste al máximo de entrenos guardados por hoy. Tu entreno sigue en este teléfono: intenta mañana." };
  if (error || !wk) { logError("entreno", "insert_workout_failed", { code: error?.code }); return { ok: false, error: SAVE_FAILED }; }
  const setRows = rows(wk.id);
  if (setRows.length) {
    const r = await sb.from("workout_sets").insert(setRows);
    if (r.error) {
      // Sin series el entreno queda a medias: se deshace para que el reintento lo guarde completo (y el XP no se cuente dos veces).
      logError("entreno", "insert_sets_failed", { code: r.error.code });
      await sb.from("workouts").delete().eq("id", wk.id).eq("user_id", v.id);
      return { ok: false, error: SAVE_FAILED };
    }
  }
  // Lo que sigue es extra (XP, publicación, retos): si falla, el entreno ya quedó guardado y no se reporta como error.
  if (!repeat) {
    const prXp = calc.prs * 50;
    const xr = await sb.from("xp_events").insert([{ user_id: v.id, kind: "workout", xp: Math.max(0, xp - prXp) }, ...Array.from({ length: calc.prs }, () => ({ user_id: v.id, kind: "pr", xp: 50 }))]);
    if (xr.error) logError("entreno", "xp_insert_failed", { code: xr.error.code });
  }
  // Publicación automática en la comunidad (si el usuario lo permite)
  const { data: prof } = await sb.from("profiles").select("share_workouts,visibility").eq("id", v.id).maybeSingle();
  let postId: string | undefined;
  if (prof && prof.share_workouts !== false && !calc.rushed && !repeat) {
    const volume = Math.round(w.exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + (s.kg ?? 0) * s.reps, 0), 0));
    const mins = Math.max(1, Math.round(t.seconds / 60));
    const { data: post } = await sb.from("posts").insert({
      user_id: v.id, kind: "workout", workout_id: wk.id, body: w.note?.slice(0, 500) || null, visibility: prof?.visibility === "privado" ? "privado" : prof?.visibility ?? "seguidores",
      data: {
        title: w.title?.slice(0, 60), icon: /^[a-zA-Z]{1,24}$/.test(w.icon ?? "") ? w.icon : "barbell", mins: Math.min(mins, 240), sets: setRows.length, volume, prs: prNames.slice(0, 10),
        // Para la tarjeta del feed: XP ganado y los ejercicios hechos (nombres, máx. 6). Nunca peso corporal ni medidas.
        xp, ex: [...new Set(w.exercises.filter((e) => e.sets.length).map((e) => nameOf(e.id).slice(0, 40)))].slice(0, 6),
      },
    }).select("id").single();
    postId = post ? String(post.id) : undefined;
  }
  await creditChallenges(v).catch(() => null);
  // Última semana de un programa: si con esta sesión ya hizo todas, se cierra con su certificado (la RPC lo vuelve a validar).
  const pt = parseProgramTemplate(w.template);
  if (pt && !repeat) {
    const pc = (await getCatalog(false)).get(pt.slug);
    if (pc?.program && pt.week >= weeksOf(pc.program)) await sb.rpc("program_finish", { p_slug: pt.slug, p_day: day }).then(() => null, () => null);
  }
  revalidatePath("/app", "layout");
  return { ok: true, postId, xp, prNames, repeat };
}
