// Poder del perfil en el servidor: tu perfil (my_profile_power), el de otra persona (community_profile_power) y las
// insignias junto al nombre en la comunidad (community_flair). La regla está en profile-power.ts y en 0030.
import "server-only";
import { cache } from "react";
import { createClient, type Viewer } from "@/lib/supabase/server";
import { todayFor } from "@/lib/today";
import { demoActiveDays, demoXp } from "@/lib/demo-story";
import { levelOf } from "@/lib/gamify";
import { getCatalog, getCompletedChallenges, getOwned } from "@/lib/challenges-server";
import { getProgramStates } from "@/lib/programs-server";
import { addDaysIso } from "@/lib/challenges";
import { pointsFor, sortInsignias, tierFor, toFlair, toInsignia, type CoverName, type Flair, type Insignia, type PowerStats } from "@/lib/profile-power";
import type { IdStatus } from "@/lib/identity";

export type ShowcaseItem = { slug: string; title: string; icon: string; cover: CoverName; kind: "reto" | "programa"; badge: string; rewardTitle: string | null; owned: boolean; doneAt: string | null };
export type Power = { visible: true; stats: PowerStats & { totalXp: number }; points: number; tier: number; featured: string | null; insignias: Insignia[]; showcase: ShowcaseItem[] };
export type PowerView = Power | { visible: false; verified: boolean };

type Sb = Awaited<ReturnType<typeof createClient>>;
const COVERS: CoverName[] = ["banana", "ember", "sky", "peel", "noche", "selva", "fresa"];

function parseShowcase(raw: unknown): ShowcaseItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r) => {
    if (!r || typeof r !== "object") return [];
    const x = r as Record<string, unknown>;
    if (typeof x.slug !== "string" || typeof x.title !== "string") return [];
    return [{
      slug: x.slug, title: x.title.slice(0, 80), icon: typeof x.icon === "string" ? x.icon : "medal", cover: COVERS.includes(x.cover as CoverName) ? (x.cover as CoverName) : "banana",
      kind: x.kind === "programa" ? "programa" : "reto", badge: typeof x.badge === "string" ? x.badge : "", rewardTitle: typeof x.reward_title === "string" && x.reward_title ? x.reward_title : null,
      owned: x.owned === true, doneAt: typeof x.done_at === "string" ? x.done_at : null,
    } satisfies ShowcaseItem];
  });
}

/** jsonb de my_profile_power / community_profile_power a Power. */
function parsePower(j: Record<string, unknown>): PowerView {
  if (j.visible === false) return { visible: false, verified: j.verified === true };
  const num = (k: string) => (typeof j[k] === "number" ? (j[k] as number) : Number(j[k] ?? 0)) || 0;
  const stats: Power["stats"] = {
    premiumOwned: num("premium_owned"), certs: num("certs"), retosDone: num("retos_done"), levelIdx: num("level_idx") || 1,
    bestStreak: j.best_streak === null || j.best_streak === undefined ? null : num("best_streak"), verified: j.verified === true, totalXp: num("total_xp"),
  };
  const insignias = sortInsignias((Array.isArray(j.insignias) ? j.insignias : []).map((r) => toInsignia(r as Record<string, unknown>, stats.levelIdx)).filter((x): x is Insignia => !!x));
  // Los puntos se recalculan con la misma regla para mostrar el desglose; el nivel de perfil es el de la base.
  const points = num("points") || pointsFor(stats);
  return { visible: true, stats, points, tier: num("tier") || tierFor(points).idx, featured: typeof j.featured === "string" ? j.featured : null, insignias, showcase: parseShowcase(j.showcase) };
}

// ───────────── Modo demo: el mismo Andrés de demo-story, con programas que de verdad muestra la app ─────────────
async function demoPower(v: Viewer): Promise<Power> {
  const today = todayFor(v).iso;
  const [owned, catalog, states, certs] = await Promise.all([getOwned(v), getCatalog(true), getProgramStates(v), getCompletedChallenges(v)]);
  const xp = demoXp(today);
  const lv = levelOf(xp);
  // Mejor racha del demo: días seguidos en demoActiveDays.
  const days = [...demoActiveDays(today)].sort();
  let best = 0, run = 0, prev = "";
  for (const d of days) { run = prev && addDaysIso(prev, 1) === d ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  const done = states.filter((s) => s.status === "completado");
  const stats: Power["stats"] = { premiumOwned: owned.size, certs: done.length, retosDone: certs.filter((c) => c.c.priceUsd === 0).length, levelIdx: lv.idx, bestStreak: best, verified: false, totalXp: xp };
  const showcase: ShowcaseItem[] = [...owned].map((slug) => catalog.get(slug)).filter((c): c is NonNullable<typeof c> => !!c).map((c) => ({
    slug: c.id, title: c.title, icon: c.icon, cover: c.cover, kind: c.kind, badge: c.badge, rewardTitle: c.rewardTitle, owned: true,
    doneAt: done.find((s) => s.slug === c.id)?.completedAt ?? null,
  })).sort((a, b) => String(b.doneAt ?? "").localeCompare(String(a.doneAt ?? "")));
  const raw = [
    ...done.map((s) => { const c = catalog.get(s.slug)!; return { id: `prog:${c.id}`, label: c.rewardTitle || c.badge, detail: c.title, icon: c.icon, cover: c.cover, kind: "certificado", at: s.completedAt }; }),
    ...certs.map((x) => ({ id: `reto:${x.c.id}`, label: x.c.badge, detail: x.c.title, icon: x.c.icon, cover: x.c.cover, kind: x.c.priceUsd > 0 ? "certificado" : "medalla", at: x.at })),
    { id: "nivel" }, ...(best >= 7 ? [{ id: "racha7" }] : []), ...(owned.size >= 3 ? [{ id: "coleccion" }] : []), { id: "pr" }, { id: "w10" },
  ];
  const insignias = sortInsignias(raw.map((r) => toInsignia(r, lv.idx)).filter((x): x is Insignia => !!x));
  const points = pointsFor(stats);
  return { visible: true, stats, points, tier: tierFor(points).idx, featured: done[0] ? `prog:${done[0].slug}` : null, insignias, showcase };
}

/** Personas del demo de la comunidad: insignias junto al nombre (coherentes con su XP de demo). */
export const DEMO_FLAIR: Record<string, Flair> = {
  d1: { verified: true, tier: 3, featured: { id: "prog:abdomen-marcado", label: "Core de acero", icon: "target", cover: "sky" } },
  d2: { verified: true, tier: 4, featured: { id: "prog:reconstruccion-8-semanas", label: "Reconstruido", icon: "gorilla", cover: "noche" } },
  d3: { verified: false, tier: 2, featured: { id: "reto:agua-21", label: "Hidratado", icon: "drop", cover: "sky" } },
  d4: { verified: true, tier: 2, featured: null },
  d5: { verified: false, tier: 1, featured: null },
  d6: { verified: false, tier: 1, featured: null },
};

/** Perfil público de demo de otra persona: lo justo para que la vitrina se vea, sin inventar compras raras. */
function demoOther(id: string, xp: number): Power | null {
  const f = DEMO_FLAIR[id];
  if (!f) return null;
  const lv = levelOf(xp);
  const owned = f.tier && f.tier >= 4 ? ["reconstruccion-8-semanas", "abdomen-marcado", "brazos-definidos", "gluteos-30"] : f.tier === 3 ? ["abdomen-marcado", "banana-girl"] : f.tier === 2 ? ["abdomen-21"] : [];
  const doneSlug = f.featured?.id.startsWith("prog:") ? f.featured.id.slice(5) : null;
  const stats: Power["stats"] = { premiumOwned: owned.length, certs: doneSlug ? 1 : 0, retosDone: f.featured?.id.startsWith("reto:") ? 1 : 0, levelIdx: lv.idx, bestStreak: null, verified: f.verified, totalXp: xp };
  const points = pointsFor(stats);
  return { visible: true, stats, points, tier: Math.max(f.tier ?? 1, tierFor(points).idx), featured: f.featured?.id ?? null, insignias: [], showcase: owned.map((slug) => ({ slug, title: slug, icon: "medal", cover: "banana", kind: "programa", badge: "", rewardTitle: null, owned: true, doneAt: slug === doneSlug ? new Date(Date.now() - 20 * 864e5).toISOString() : null })) };
}

/** Rellena la vitrina de demo con los datos del catálogo de siempre. */
async function hydrateDemo(p: Power): Promise<Power> {
  const catalog = await getCatalog(true);
  const showcase = p.showcase.map((s) => { const c = catalog.get(s.slug); return c ? { ...s, title: c.title, icon: c.icon, cover: c.cover, kind: c.kind, badge: c.badge, rewardTitle: c.rewardTitle } : s; });
  const insignias = p.insignias.length ? p.insignias : sortInsignias([
    ...showcase.filter((s) => s.doneAt).map((s) => toInsignia({ id: `prog:${s.slug}`, label: s.rewardTitle || s.badge, detail: s.title, icon: s.icon, cover: s.cover, kind: "certificado", at: s.doneAt }, p.stats.levelIdx)),
    toInsignia({ id: "nivel" }, p.stats.levelIdx), p.stats.verified ? toInsignia({ id: "verificado" }, 1) : null, p.stats.premiumOwned >= 3 ? toInsignia({ id: "coleccion" }, 1) : null,
  ].filter((x): x is Insignia => !!x));
  return { ...p, showcase, insignias };
}

// ───────────── Lecturas ─────────────

/** Tu poder de perfil (recalcula en la base y puede dejar el aviso de subida). Sin la migración 0030: con lo que hay. */
export const getMyPower = cache(async (v: Viewer): Promise<Power> => {
  if (v.demo) return demoPower(v);
  const sb = await createClient();
  const { data, error } = await sb.rpc("my_profile_power");
  if (!error && data && typeof data === "object") { const p = parsePower(data as Record<string, unknown>); if (p.visible) return p; }
  return fallbackPower(v, sb);
});

/** Respaldo sin 0030: compras, certificados y nivel con las tablas de siempre (sin verificación ni racha). */
async function fallbackPower(v: Viewer, sb: Sb): Promise<Power> {
  const [owned, certs, states, catalog, xpRes] = await Promise.all([getOwned(v), getCompletedChallenges(v).catch(() => []), getProgramStates(v), getCatalog(false), sb.rpc("community_levels", { p_ids: [v.id] })]);
  const xp = Number(((xpRes.data ?? []) as { total_xp: number }[])[0]?.total_xp ?? 0);
  const done = states.filter((s) => s.status === "completado");
  const stats: Power["stats"] = { premiumOwned: owned.size, certs: done.length + certs.filter((c) => c.c.priceUsd > 0).length, retosDone: certs.filter((c) => c.c.priceUsd === 0).length, levelIdx: levelOf(xp).idx, bestStreak: null, verified: false, totalXp: xp };
  const points = pointsFor(stats);
  const showcase: ShowcaseItem[] = [...owned].map((s) => catalog.get(s)).filter((c): c is NonNullable<typeof c> => !!c)
    .map((c) => ({ slug: c.id, title: c.title, icon: c.icon, cover: c.cover, kind: c.kind, badge: c.badge, rewardTitle: c.rewardTitle, owned: true, doneAt: done.find((s) => s.slug === c.id)?.completedAt ?? null }));
  return { visible: true, stats, points, tier: tierFor(points).idx, featured: null, insignias: sortInsignias([toInsignia({ id: "nivel" }, stats.levelIdx)!]), showcase };
}

/** Poder de otro perfil (la base decide qué puedes ver). */
export async function getProfilePower(v: Viewer, userId: string, me: boolean, demoXpOf?: number | null): Promise<PowerView | null> {
  if (me) return getMyPower(v);
  if (v.demo) { const p = demoOther(userId, demoXpOf ?? 0); return p ? hydrateDemo(p) : null; }
  const sb = await createClient();
  const { data, error } = await sb.rpc("community_profile_power", { p_user: userId });
  if (error || !data || typeof data !== "object") return null;
  return parsePower(data as Record<string, unknown>);
}

/** Insignias junto al nombre para muchas personas (máx. 100). Sin 0030: vacío (la comunidad sigue con el nivel de 0019). */
export async function getFlair(sb: Sb, ids: string[]): Promise<Map<string, Flair & { xp: number | null }> | null> {
  if (!ids.length) return new Map();
  const { data, error } = await sb.rpc("community_flair", { p_ids: ids.slice(0, 100) });
  // Sin 0030 (o con un error): null, y quien llama sigue con el nivel de 0019.
  if (error) return null;
  return new Map(((data ?? []) as Record<string, unknown>[]).map((r) => [String(r.user_id), { ...toFlair(r), xp: r.total_xp === null || r.total_xp === undefined ? null : Number(r.total_xp) }]));
}

// ───────────── Verificación (estado propio) ─────────────
export type MyVerification = { status: IdStatus; docType: string; country: string; submittedAt: string; reviewedAt: string | null; rejectionReason: string | null; filesDeleted: boolean } | null;

export async function getMyVerification(v: Viewer): Promise<MyVerification> {
  if (v.demo) return null; // el Andrés del demo todavía no se verifica: así se ve el flujo completo
  const sb = await createClient();
  const { data, error } = await sb.from("identity_verifications").select("status,doc_type,country,submitted_at,reviewed_at,rejection_reason,files_deleted_at").eq("user_id", v.id).maybeSingle();
  if (error || !data) return null;
  return { status: data.status as IdStatus, docType: data.doc_type as string, country: data.country as string, submittedAt: data.submitted_at as string, reviewedAt: (data.reviewed_at as string) ?? null, rejectionReason: (data.rejection_reason as string) ?? null, filesDeleted: !!data.files_deleted_at };
}
