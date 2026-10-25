"use server";
// Acciones de la persona sobre sus temporadas: cuestionario, opiniones de cada sesión y activar. La base (RLS de 0048 y
// program_start) valida todo otra vez: solo filas propias y solo con la temporada comprada o canjeada.
import { revalidatePath } from "next/cache";
import { createClient, getViewer } from "@/lib/supabase/server";
import { todayFor } from "@/lib/today";
import { limitError } from "@/lib/security/limits";
import { getSeason } from "@/lib/seasons-server";
import { isSeasonSlug, parseIntake, parseSeasonSlug, planWeek, seasonWeek, type SeasonIntake, type WeekPlan } from "@/lib/seasons";
import { startProgram, type ProgramResult } from "@/app/actions/programs";

export type IntakeResult = { ok: boolean; demo?: boolean; error?: string; plan?: WeekPlan; fromWeek?: number };

/** Guarda (o edita) el cuestionario. Al editar a mitad de temporada, el plan cambia desde la semana en curso. */
export async function saveSeasonIntake(slug: string, raw: unknown): Promise<IntakeResult> {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar." };
  const m = typeof slug === "string" && isSeasonSlug(slug) ? parseSeasonSlug(slug) : null;
  if (!m) return { ok: false, error: "Esta temporada no existe." };
  const answers = parseIntake(raw, m.sport);
  if (!answers) return { ok: false, error: "Elige al menos un día para entrenar." };
  const plan = planWeek(m.sport, answers);
  if (v.demo) return { ok: true, demo: true, plan, fromWeek: 1 };
  { const lim = await limitError("programas", v.id); if (lim) return { ok: false, error: lim }; }
  const s = await getSeason(false, slug);
  if (!s) return { ok: false, error: "Esta temporada no existe." };
  const fromWeek = Math.max(1, Math.min(8, seasonWeek(s, todayFor(v).iso) || 1));
  const sb = await createClient();
  const row = { user_id: v.id, slug, answers: answers as unknown as Record<string, unknown>, plan: { slots: plan.slots, warnings: plan.warnings } as Record<string, unknown>, from_week: fromWeek, updated_at: new Date().toISOString() };
  const { error } = await sb.from("season_intake").upsert(row, { onConflict: "user_id,slug" });
  if (error) return { ok: false, error: error.code === "42501" ? "Primero suma esta temporada a tu cuenta." : "No pudimos guardar tus respuestas. Intenta de nuevo." };
  revalidatePath("/app", "layout");
  return { ok: true, plan, fromWeek };
}

/** Opinión rápida de una sesión: me gustó o no, muy difícil o muy fácil, y si la saltó. Todo opcional. */
export type FeedbackItem = { exercise_id: string; liked: boolean | null; difficulty: "dificil" | "facil" | null; skipped: boolean };
const EX_ID = /^(ds:\d{4}|[a-z][a-zA-Z0-9_]{1,30})$/;
export async function saveSeasonFeedback(slug: string, week: number, day: number, items: FeedbackItem[]): Promise<{ ok: boolean; demo?: boolean; error?: string }> {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar." };
  if (!isSeasonSlug(slug) || !Number.isInteger(week) || week < 1 || week > 8 || !Number.isInteger(day) || day < 1 || day > 6) return { ok: false, error: "Sesión inválida." };
  const clean = (Array.isArray(items) ? items : []).slice(0, 12).filter((x) => x && typeof x.exercise_id === "string" && EX_ID.test(x.exercise_id)).map((x) => ({
    user_id: v.id, slug, week, day, exercise_id: x.exercise_id, liked: typeof x.liked === "boolean" ? x.liked : null,
    difficulty: x.difficulty === "dificil" || x.difficulty === "facil" ? x.difficulty : null, skipped: x.skipped === true, completed: x.skipped !== true, updated_at: new Date().toISOString(),
  }));
  if (!clean.length) return { ok: true };
  if (v.demo) return { ok: true, demo: true };
  { const lim = await limitError("programas", v.id); if (lim) return { ok: false, error: lim }; }
  const { error } = await (await createClient()).from("season_feedback").upsert(clean, { onConflict: "user_id,slug,week,day,exercise_id" });
  if (error) return { ok: false, error: "No pudimos guardar tu opinión. Intenta de nuevo." };
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** Activa la temporada (con otra activa devuelve `conflict` salvo que `pauseCurrent`). */
export async function activateSeason(slug: string, pauseCurrent = false): Promise<ProgramResult> {
  if (!isSeasonSlug(slug)) return { ok: false, error: "Esta temporada no existe." };
  const r = await startProgram(slug, pauseCurrent);
  if (r.ok) revalidatePath(`/app/temporadas/${slug}`);
  return r;
}

export type { SeasonIntake };
