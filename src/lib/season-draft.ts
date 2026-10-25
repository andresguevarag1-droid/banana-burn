// Borrador de la próxima temporada (panel): parte de las sesiones de la temporada actual y cambia lo que no gustó
// o se saltó mucho (toReplace) por una alternativa conocida. Pura: el panel la llama con los datos anónimos de 0048.
// Nada se publica solo: el borrador se revisa, se edita y se crea en la tienda como borrador del editor de retos.
import type { ProgramSession } from "@/lib/programs";
import { addDaysIso, makeSeason, toReplace, type ExerciseStat, type SeasonInfo } from "@/lib/seasons";

export type DraftChange = { from: string; to: string | null; reason: string };
export type DraftContent = {
  slug: string; title: string; startsOn: string; endsOn: string; enrollUntil: string; priceMinor: number;
  sessions: ProgramSession[]; changes: DraftChange[];
  /** Lo que más gustó (se queda). */
  keep: string[];
  /** Notas para quien revisa (reglas o el asistente, con el tope de gasto). */
  notes: string;
};

/** La siguiente temporada empieza el lunes después de que termina la actual. */
export const nextSeason = (prev: SeasonInfo): SeasonInfo => makeSeason(prev.sport, prev.number + 1, addDaysIso(prev.endsOn, 1));

const reasonOf = (s: ExerciseStat | undefined) => {
  if (!s) return "Cambio sugerido";
  if (s.votes >= 5 && (s.likeRate ?? 1) < 0.5) return `No gustó: ${Math.round((s.likeRate ?? 0) * 100)} % de ${s.votes} votos a favor`;
  return `Se saltó en ${Math.round(s.skipRate * 100)} % de ${s.seen} sesiones`;
};

/**
 * Arma el borrador. `alts(id)` da alternativas del mismo patrón (ALTS del motor y los cambios por molestia);
 * `known(id)` confirma que existe. Si un ejercicio no tiene alternativa válida, se queda y se marca para revisarlo a mano.
 */
export function buildDraft(prev: SeasonInfo, sessions: ProgramSession[], stats: ExerciseStat[], alts: (id: string) => string[], known: (id: string) => boolean): DraftContent {
  const next = nextSeason(prev);
  const bad = new Set(toReplace(stats));
  const byId = new Map(stats.map((s) => [s.id, s]));
  const pick = new Map<string, string | null>();
  for (const id of bad) {
    const used = new Set(sessions.flatMap((s) => s.exercises.map((e) => e.id)));
    const to = alts(id).find((a) => a !== id && !bad.has(a) && known(a) && !used.has(a)) ?? alts(id).find((a) => a !== id && !bad.has(a) && known(a)) ?? null;
    pick.set(id, to);
  }
  const out = sessions.map((s) => ({ ...s, exercises: s.exercises.map((e) => {
    const to = pick.get(e.id);
    if (!to) return e;
    const { home: _h, ...rest } = e;
    void _h;
    return { ...rest, id: to };
  }) }));
  const changes: DraftChange[] = [...pick.entries()].map(([from, to]) => ({ from, to, reason: to ? reasonOf(byId.get(from)) : `${reasonOf(byId.get(from))}. Sin alternativa automática: revísalo a mano` }));
  const keep = stats.filter((s) => s.votes >= 5 && (s.likeRate ?? 0) >= 0.8).slice(0, 8).map((s) => s.id);
  return { slug: next.slug, title: next.title, startsOn: next.startsOn, endsOn: next.endsOn, enrollUntil: next.enrollUntil, priceMinor: next.priceMinor, sessions: out, changes, keep, notes: "" };
}

/** Notas por reglas (sin costo) cuando no hay asistente o se acabó el cupo del día. */
export function ruleNotes(d: DraftContent, total: number, retention: { week: number; pct: number }[]): string {
  const drop = retention.find((r) => r.pct < 0.5);
  const lines = [
    `${total} personas respondieron el cuestionario.`,
    d.changes.length ? `${d.changes.length} ejercicios cambian por opinión o por saltos.` : "Ningún ejercicio llegó al umbral para cambiarse (5 votos o 5 sesiones).",
    d.keep.length ? `Se quedan los que más gustaron: ${d.keep.join(", ")}.` : "",
    drop ? `La asistencia baja de la mitad en la semana ${drop.week}: revisa la duración o la dificultad de esa fase.` : "",
  ];
  return lines.filter(Boolean).join(" ");
}

/** Lee un borrador guardado (jsonb) sin confiar en su forma. */
export function parseDraft(raw: unknown): DraftContent | null {
  const d = raw as Partial<DraftContent> | null;
  if (!d || typeof d !== "object" || typeof d.slug !== "string" || !Array.isArray(d.sessions)) return null;
  return {
    slug: d.slug, title: String(d.title ?? "").slice(0, 80), startsOn: String(d.startsOn ?? ""), endsOn: String(d.endsOn ?? ""), enrollUntil: String(d.enrollUntil ?? ""),
    priceMinor: Number(d.priceMinor) || 0, sessions: d.sessions as ProgramSession[], changes: Array.isArray(d.changes) ? d.changes : [], keep: Array.isArray(d.keep) ? d.keep : [], notes: String(d.notes ?? "").slice(0, 4000),
  };
}
