// Temporadas en el servidor: catálogo (fechas y precios de la base), lo que la persona tiene, su cuestionario, el canje
// del plan anual y el programa a su medida. La lógica pura vive en seasons.ts y season-plan.ts.
import "server-only";
import { cache } from "react";
import { createClient, type Viewer } from "@/lib/supabase/server";
import { todayFor } from "@/lib/today";
import { getOwned } from "@/lib/challenges-server";
import { getEntitlements } from "@/lib/entitlements";
import { demoState } from "@/lib/demo-persona";
import { SEASON_SEED_BY_SLUG } from "@/lib/season-content";
import { personalSeason, type PersonalSeason } from "@/lib/season-plan";
import {
  SEASONS_T1, SPORT_IDS, canRedeemAnnual, currentSeason, isSeasonSlug, parseIntake, parseSeasonSlug, type AnnualSub, type SeasonInfo, type SeasonIntake, type SportId,
} from "@/lib/seasons";
import type { ProgramDef } from "@/lib/programs";

type SeasonRow = { slug: string; sport: string; number: number; starts_on: string; ends_on: string; enroll_until: string; price_minor: number };
const toInfo = (r: SeasonRow, title?: string): SeasonInfo => ({
  slug: r.slug, sport: r.sport as SportId, number: r.number, title: title ?? `Temporada ${r.number}`, startsOn: String(r.starts_on).slice(0, 10), endsOn: String(r.ends_on).slice(0, 10),
  enrollUntil: String(r.enroll_until).slice(0, 10), priceMinor: Number(r.price_minor),
});

/** Todas las temporadas (de la base; sin la base o en demo, la Temporada 1 del código). */
export const getSeasons = cache(async (demo: boolean): Promise<SeasonInfo[]> => {
  if (demo) return SEASONS_T1;
  try {
    const sb = await createClient();
    const { data, error } = await sb.from("seasons").select("slug,sport,number,starts_on,ends_on,enroll_until,price_minor").order("number");
    if (error || !data?.length) return SEASONS_T1;
    const { data: cat } = await sb.from("challenges_catalog").select("slug,title").in("slug", (data as SeasonRow[]).map((r) => r.slug));
    const titles = new Map(((cat ?? []) as { slug: string; title: string }[]).map((c) => [c.slug, c.title]));
    return (data as SeasonRow[]).filter((r) => SPORT_IDS.includes(r.sport as SportId)).map((r) => toInfo(r, titles.get(r.slug)));
  } catch {
    return SEASONS_T1;
  }
});

export const getSeason = async (demo: boolean, slug: string) => (await getSeasons(demo)).find((s) => s.slug === slug) ?? null;

/** La temporada vigente o próxima de cada deporte. */
export async function getCurrentSeasons(v: Viewer): Promise<SeasonInfo[]> {
  const all = await getSeasons(v.demo);
  const today = todayFor(v).iso;
  return SPORT_IDS.map((s) => currentSeason(all, s, today)).filter((s): s is SeasonInfo => !!s);
}

/** Cuestionario guardado (null si todavía no lo llena). */
export const getIntake = cache(async (v: Viewer, slug: string): Promise<{ answers: SeasonIntake; fromWeek: number; updatedAt: string } | null> => {
  const meta = parseSeasonSlug(slug);
  if (!meta) return null;
  if (v.demo) {
    const ds = await demoState();
    if (!ds.season) return null;
    return { answers: parseIntake(DEMO_INTAKE[meta.sport], meta.sport)!, fromWeek: 1, updatedAt: new Date().toISOString() };
  }
  const { data } = await (await createClient()).from("season_intake").select("answers,from_week,updated_at").eq("user_id", v.id).eq("slug", slug).maybeSingle();
  const a = data ? parseIntake(data.answers, meta.sport) : null;
  return a ? { answers: a, fromWeek: Number(data!.from_week ?? 1), updatedAt: String(data!.updated_at) } : null;
});

/** Respuestas de ejemplo para el demo (?temporada=running|raquetas|cross). */
export const DEMO_INTAKE: Record<SportId, unknown> = {
  running: { level: "recreativo", years: 3, trainDays: [0, 1, 2, 3, 4], time: "manana", sessions: 3, minutes: 45, place: "gym", equipment: [], injuries: [], goal: "marca", eventDate: "2026-12-13", eventType: "21K",
    running: { runDays: [1, 3, 5], longRunDay: 5, kmWeek: 30, paceDist: "10k", paceTime: "52:00", target: "21k", surface: ["calle"], watch: "reloj" } },
  raquetas: { level: "recreativo", years: 2, trainDays: [0, 1, 3, 4], time: "tarde", sessions: 3, minutes: 45, place: "gym", equipment: [], injuries: [], goal: "potencia", eventDate: null, eventType: null,
    raquetas: { which: "padel", playDays: [2, 5], competitiveDays: [5], hand: "derecha", category: "Quinta", matchMin: 90, pains: ["codo"] } },
  cross: { level: "recreativo", years: 1, trainDays: [0, 2, 4, 6], time: "noche", sessions: 3, minutes: 60, place: "gym", equipment: [], injuries: [], goal: "fuerza", eventDate: null, eventType: null,
    cross: { boxDays: [1, 3], oly: "basica", gymnastics: "basica", benchWod: null, squat1rm: 90, avoid: [] } },
};

/** Suscripciones de quien mira (para el canje del plan anual). */
async function mySubs(v: Viewer): Promise<AnnualSub[]> {
  if (v.demo) return [];
  const { data } = await (await createClient()).from("subscriptions").select("id,billing,status,current_period_start,current_period_end,plan").eq("user_id", v.id);
  return (data ?? []) as AnnualSub[];
}
/** Canjes del plan anual ya usados. */
async function myRedemptions(v: Viewer): Promise<{ sub_id: string; period_start: string; slug: string }[]> {
  if (v.demo) return [];
  const { data } = await (await createClient()).from("season_redemptions").select("sub_id,period_start,slug").eq("user_id", v.id);
  return (data ?? []) as { sub_id: string; period_start: string; slug: string }[];
}

export type SeasonsView = {
  today: string;
  seasons: SeasonInfo[];
  owned: Set<string>;
  /** Plan o prueba vigente: puede sumar una temporada. */
  access: boolean;
  /** Le queda la temporada incluida en su plan anual (periodo vigente). */
  annual: { subId: string; periodStart: string } | null;
  /** Tiene plan anual (aunque ya canjeó): para decir "incluida en tu plan anual". */
  hasAnnual: boolean;
};

export const getSeasonsView = cache(async (v: Viewer): Promise<SeasonsView> => {
  const [seasons, owned, ent, subs, reds] = await Promise.all([getCurrentSeasons(v), getOwned(v), getEntitlements(v), mySubs(v), myRedemptions(v)]);
  const ownedSeasons = new Set([...owned].filter(isSeasonSlug));
  if (v.demo && (await demoState()).season) ownedSeasons.add(`temporada-${(await demoState()).season}-1`);
  const annual = canRedeemAnnual(subs, reds);
  return { today: todayFor(v).iso, seasons, owned: ownedSeasons, access: ent.app, annual, hasAnnual: subs.some((s) => s.billing === "anual" && s.status === "active") };
});

/** Programa de una temporada a la medida de la persona (cuestionario, días, molestias, minutos y evento). */
export async function personalize(v: Viewer, def: ProgramDef): Promise<PersonalSeason | null> {
  const meta = parseSeasonSlug(def.slug);
  if (!meta) return null;
  const season = (await getSeason(v.demo, def.slug)) ?? SEASONS_T1.find((s) => s.slug === def.slug) ?? null;
  if (!season) return null;
  const intake = await getIntake(v, def.slug);
  return personalSeason(def, season, intake?.answers ?? null);
}

/** Sesiones completas de una temporada en el código (respaldo del demo). */
export const seasonSeedSessions = (slug: string) => SEASON_SEED_BY_SLUG[slug]?.sessions ?? [];
