// Panel de temporadas (0048): resumen anónimo por temporada y borradores de la próxima. Solo servidor.
import "server-only";
import { createClient, type Viewer } from "@/lib/supabase/server";
import { ALTS } from "@/lib/engine/data";
import { exInfo } from "@/lib/programs-server";
import type { ProgramSession } from "@/lib/programs";
import { SEASON_SEED_BY_SLUG } from "@/lib/season-content";
import { parseDraft, type DraftContent } from "@/lib/season-draft";
import { AVOID_SWAPS, INJURY_SWAPS, aggregateFeedback, intakeSummary, parseIntake, retention, toReplace, type ExerciseStat, type FeedbackRow, type SeasonIntake, type SportId } from "@/lib/seasons";

export type SeasonStats = {
  owners: number; started: number; runs: { count: number; km: number }; exercises: ExerciseStat[]; replace: string[];
  retention: { week: number; users: number; pct: number }[]; intakes: SeasonIntake[]; summary: ReturnType<typeof intakeSummary>;
};

/** Datos de ejemplo para el modo demo (sin personas reales). */
function demoRaw(slug: string) {
  const ids = (SEASON_SEED_BY_SLUG[slug]?.sessions ?? []).flatMap((s) => s.exercises.map((e) => e.id)).slice(0, 10);
  const feedback: FeedbackRow[] = ids.flatMap((id, k) => Array.from({ length: 8 }, (_, n) => ({ exercise_id: id, week: 1 + (n % 3), liked: k === 3 ? n < 2 : n % 4 !== 0, difficulty: k === 1 && n < 3 ? ("dificil" as const) : null, skipped: k === 5 && n < 3, completed: !(k === 5 && n < 3) })));
  const weeks = Array.from({ length: 20 }, (_, n) => Array.from({ length: 8 - (n % 5) }, (_, w) => w + 1));
  return { owners: 24, started: 20, feedback, weeks, intakes: [] as unknown[], runs: { count: slug.includes("running") ? 86 : 0, km: slug.includes("running") ? 612.4 : 0 } };
}

export async function seasonStats(v: Viewer, slug: string, sport: SportId): Promise<SeasonStats | { error: string }> {
  let raw: { owners: number; started: number; feedback: FeedbackRow[]; weeks: number[][]; intakes: unknown[]; runs: { count: number; km: number } };
  if (v.demo) raw = demoRaw(slug);
  else {
    const { data, error } = await (await createClient()).rpc("admin_season_stats", { p_slug: slug });
    if (error) return { error: error.code === "42883" || error.code === "PGRST202" ? "Falta aplicar la migración 0048_temporadas.sql." : "No pudimos leer las estadísticas." };
    const d = (data ?? {}) as Partial<typeof raw>;
    raw = { owners: Number(d.owners) || 0, started: Number(d.started) || 0, feedback: Array.isArray(d.feedback) ? d.feedback : [], weeks: Array.isArray(d.weeks) ? d.weeks.filter(Array.isArray) : [], intakes: Array.isArray(d.intakes) ? d.intakes : [], runs: { count: Number(d.runs?.count) || 0, km: Number(d.runs?.km) || 0 } };
  }
  const exercises = aggregateFeedback(raw.feedback);
  const intakes = raw.intakes.map((x) => parseIntake(x, sport)).filter((x): x is SeasonIntake => !!x);
  return { owners: raw.owners, started: raw.started, runs: raw.runs, exercises, replace: toReplace(exercises), retention: retention(raw.weeks), intakes, summary: intakeSummary(intakes, sport) };
}

/** Alternativas para cambiar un ejercicio: las del motor y los cambios por molestia que ya revisamos. */
export function altsFor(id: string): string[] {
  const out: string[] = [...((ALTS as Record<string, string[]>)[id] ?? [])];
  for (const m of [...Object.values(INJURY_SWAPS), ...Object.values(AVOID_SWAPS)]) { const to = m[id]; if (to && !out.includes(to)) out.push(to); }
  return out;
}

export const exName = (id: string) => exInfo(id)?.name ?? id;

/** Sesiones actuales de una temporada (lo editado en el panel manda; sin BD, la siembra). */
export async function seasonSessions(v: Viewer, slug: string): Promise<ProgramSession[]> {
  if (!v.demo) {
    const { data } = await (await createClient()).from("program_sessions").select("phase,day,title,focus,optional,exercises").eq("slug", slug).order("phase").order("day");
    if (data?.length) return data as ProgramSession[];
  }
  return SEASON_SEED_BY_SLUG[slug]?.sessions ?? [];
}

export type DraftRow = { id: number; sport: SportId; number: number; status: "borrador" | "publicado" | "descartado"; content: DraftContent; createdAt: string };

export async function listDrafts(v: Viewer, sport: SportId): Promise<DraftRow[]> {
  if (v.demo) return [];
  const { data, error } = await (await createClient()).from("season_drafts").select("id,sport,number,status,content,created_at").eq("sport", sport).order("created_at", { ascending: false }).limit(10);
  if (error) return [];
  return ((data ?? []) as { id: number; sport: SportId; number: number; status: DraftRow["status"]; content: unknown; created_at: string }[])
    .map((r) => ({ id: r.id, sport: r.sport, number: r.number, status: r.status, content: parseDraft(r.content)!, createdAt: r.created_at }))
    .filter((r) => r.content);
}
