// Lecturas públicas del contenido editable desde el admin, para usar en la app (/app).
// RLS ya filtra por audiencia y vigencia; aquí solo repetimos el filtro de fechas para el modo demo.
import { createClient, getViewer } from "@/lib/supabase/server";
import { activeAnnouncements } from "@/lib/shared-cache";
import { DEMO_ANNOUNCEMENTS, DEMO_CHALLENGES, DEMO_OVERRIDES } from "@/lib/admin-demo";
import { EX } from "@/lib/engine/data";

export type LiveAnnouncement = { id: string; title: string; body: string | null; tone: string; cta_label: string | null; cta_href: string | null };

const live = (a: { active: boolean; starts_at: string | null; ends_at: string | null }, now = Date.now()) =>
  a.active && (!a.starts_at || Date.parse(a.starts_at) <= now) && (!a.ends_at || Date.parse(a.ends_at) > now);

/** Anuncios vigentes para el usuario actual (máx. 3, más recientes primero). */
export async function getLiveAnnouncements(): Promise<LiveAnnouncement[]> {
  const v = await getViewer();
  if (!v || v.demo) {
    return DEMO_ANNOUNCEMENTS.filter((a) => live(a) && (a.audience === "todos" || (a.audience === "free" && v?.plan === "free") || (a.audience === "pago" && v?.plan !== "free")))
      .slice(0, 3).map(({ id, title, body, tone, cta_label, cta_href }) => ({ id, title, body, tone, cta_label, cta_href }));
  }
  // Los anuncios activos son los mismos para todos: caché compartido (se invalida al guardar en el panel, vence en 2 min).
  // La vigencia y la audiencia se filtran aquí abajo con las mismas reglas de la RLS (announcement_audience_ok).
  let data: unknown[] | null = await activeAnnouncements().catch(() => null);
  if (!data) {
    const sb = await createClient();
    const r = await sb.from("announcements").select("id,title,body,tone,cta_label,cta_href,audience,active,starts_at,ends_at")
      .eq("active", true).order("created_at", { ascending: false }).limit(20);
    if (r.error) return [];
    data = r.data;
  }
  // El staff ve todo por RLS; en la app solo mostramos lo vigente y de su audiencia real.
  return ((data ?? []) as (LiveAnnouncement & { audience: string; active: boolean; starts_at: string | null; ends_at: string | null })[])
    .filter((a) => live(a))
    .filter((a) => a.audience === "todos" || (a.audience === "free" ? v.plan === "free" : a.audience === "pago" ? v.plan !== "free" : ["coach", "support", "admin", "superadmin"].includes(v.role)))
    .slice(0, 3).map(({ id, title, body, tone, cta_label, cta_href }) => ({ id, title, body, tone, cta_label, cta_href }));
}

export type CatalogChallenge = { id: string; slug: string; title: string; description: string | null; days: number; rules: Record<string, unknown> };
/** Retos activos del catálogo, ordenados. */
export async function getChallengeCatalog(): Promise<CatalogChallenge[]> {
  const v = await getViewer();
  if (!v || v.demo) return DEMO_CHALLENGES.filter((c) => c.active).map(({ id, slug, title, description, days, rules }) => ({ id, slug, title, description, days, rules }));
  const sb = await createClient();
  const { data, error } = await sb.from("challenges_catalog").select("id,slug,title,description,days,rules").eq("active", true).order("sort");
  return error ? [] : ((data ?? []) as CatalogChallenge[]);
}

export type ExerciseMeta = { name: string; cues: string[]; enabled: boolean };
/** Nombre/claves editados y ejercicios deshabilitados. Aplica sobre EX del motor: `meta[id]?.name ?? EX[id].n`. */
export async function getExerciseOverrides(): Promise<Record<string, ExerciseMeta>> {
  const v = await getViewer();
  let rows: { exercise_id: string; name: string | null; cues: string[]; enabled: boolean }[] = [];
  if (!v || v.demo) rows = Object.entries(DEMO_OVERRIDES).map(([exercise_id, o]) => ({ exercise_id, ...o }));
  else {
    const sb = await createClient();
    const { data } = await sb.from("exercise_overrides").select("exercise_id,name,cues,enabled");
    rows = (data ?? []) as typeof rows;
  }
  const out: Record<string, ExerciseMeta> = {};
  for (const r of rows) {
    const base = EX[r.exercise_id as keyof typeof EX];
    if (!base) continue;
    out[r.exercise_id] = { name: r.name || base.n, cues: r.cues ?? [], enabled: r.enabled };
  }
  return out;
}

/**
 * Aplica los cambios del panel a un ejercicio del motor: nombre visible, claves técnicas y si está habilitado.
 * Pura: el motor puede usarla al armar la rutina (`enabled: false` = usar la alternativa del ejercicio).
 */
export function applyExerciseOverride<T extends { id: string; name: string; cues?: string[] }>(ex: T, meta: Record<string, ExerciseMeta>): T & { enabled: boolean } {
  const o = meta[ex.id];
  if (!o) return { ...ex, enabled: true };
  return { ...ex, name: o.name?.trim() || ex.name, cues: o.cues?.length ? o.cues.slice(0, 8) : ex.cues, enabled: o.enabled !== false };
}

/** Lista de ejercicios con los cambios del panel; los deshabilitados se reemplazan con `alternative` (o se omiten si no hay). */
export function applyExerciseOverrides<T extends { id: string; name: string; cues?: string[] }>(list: T[], meta: Record<string, ExerciseMeta>, alternative?: (ex: T) => T | null): T[] {
  const out: T[] = [];
  for (const ex of list) {
    const e = applyExerciseOverride(ex, meta);
    if (e.enabled) { const { enabled: _e, ...rest } = e; void _e; out.push(rest as unknown as T); continue; }
    const alt = alternative?.(ex);
    if (alt && !out.some((x) => x.id === alt.id)) { const a = applyExerciseOverride(alt, meta); if (a.enabled) { const { enabled: _a, ...rest } = a; void _a; out.push(rest as unknown as T); } }
  }
  return out;
}
