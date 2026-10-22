// XP del usuario para Hoy, Niveles y la tienda: total, historial de 7 días, meta semanal y bono de racha.
// SOLO SERVIDOR. El bono de racha lo calcula gamify.streakBonus y lo otorga public.grant_streak_bonus (service_role).
import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, type Viewer } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { todayFor } from "@/lib/today";
import { DEMO_PRS, demoActiveDays, demoWeights, demoWorkouts, demoXp } from "@/lib/demo-story";
import { weekDays } from "@/lib/daily";
import { BONUS_EXCLUDED, levelOf, localDay, nextStreakTier, nextUnlock, perksAt, streakBonus, streakMultiplier, streakOf, weeklyGoalFor, xpByDay, type XpEvent } from "@/lib/gamify";
import { addDaysIso } from "@/lib/challenges";

/** XP total (una lectura por request; la comparten el layout, Hoy y la tienda). */
export const getXpTotal = cache(async (v: Viewer): Promise<number> => {
  if (v.demo) return demoXp(todayFor(v).iso);
  const { data } = await (await createClient()).from("xp_events").select("xp").eq("user_id", v.id);
  return ((data ?? []) as { xp: number }[]).reduce((a, r) => a + (r.xp ?? 0), 0);
});

/** Días con actividad (entreno, registro diario o pesaje) de los últimos 90 días: la misma regla que la racha de Hoy. */
async function activeDays(sb: SupabaseClient, userId: string, today: string) {
  const since = addDaysIso(today, -90);
  const [{ data: wk }, { data: dl }, { data: ws }] = await Promise.all([
    sb.from("workouts").select("day").eq("user_id", userId).gte("day", since),
    sb.from("daily_logs").select("day").eq("user_id", userId).gte("day", since),
    sb.from("weights").select("day").eq("user_id", userId).gte("day", since),
  ]);
  return new Set<string>([...(wk ?? []), ...(dl ?? []), ...(ws ?? [])].map((r) => r.day as string));
}

/** Eventos de XP del modo demo, coherentes con demoXp (140 por entreno, 10 por pesaje, 50 por récord). */
function demoEvents(today: string): XpEvent[] {
  const w = demoWorkouts(today);
  return [
    ...w.map((x) => ({ kind: "workout", xp: 140, created_at: `${x.d}T18:00:00-06:00` })),
    ...demoWeights(today).map((x) => ({ kind: "weigh", xp: 10, created_at: `${x.d}T07:00:00-06:00` })),
    ...w.slice(0, DEMO_PRS).map((x) => ({ kind: "pr", xp: 50, created_at: `${x.d}T18:01:00-06:00` })),
  ];
}

export type XpSummary = Awaited<ReturnType<typeof getXpSummary>>;

/** Todo lo que muestran la tarjeta de nivel de Hoy y la página de Niveles. Sin datos inventados. */
export const getXpSummary = cache(async (v: Viewer) => {
  const today = todayFor(v).iso;
  const days7 = Array.from({ length: 7 }, (_, i) => addDaysIso(today, i - 6));
  const week = weekDays(today);
  let total: number, events: XpEvent[], active: Set<string>;
  if (v.demo) {
    total = demoXp(today);
    events = demoEvents(today).filter((e) => e.created_at.slice(0, 10) >= addDaysIso(today, -9));
    active = demoActiveDays(today);
  } else {
    const sb = await createClient();
    const since = new Date(Date.now() - 10 * 864e5).toISOString();
    const [t, { data }, act] = await Promise.all([
      getXpTotal(v),
      sb.from("xp_events").select("kind,xp,created_at").eq("user_id", v.id).gte("created_at", since).order("created_at"),
      activeDays(sb, v.id, today),
    ]);
    total = t; events = (data ?? []) as XpEvent[]; active = act;
  }
  const history = xpByDay(events, days7, v.tz);
  const todayRow = history[history.length - 1];
  const todayEvents = events.filter((e) => localDay(e.created_at, v.tz) === today);
  const count = (k: string) => todayEvents.filter((e) => e.kind === k).length;
  const weekXp = xpByDay(events, week, v.tz).reduce((a, d) => a + d.xp, 0);
  const streak = streakOf(active, today);
  const level = levelOf(total);
  return {
    total, level, next: nextUnlock(total), perks: perksAt(level.idx),
    history, today: todayRow,
    week: { xp: weekXp, goal: weeklyGoalFor(level.idx), days: week },
    streak, multiplier: streakMultiplier(streak.days), nextTier: nextStreakTier(streak.days),
    /** Bono que corresponde hoy con lo ganado hasta ahora (se acredita al guardar tu próxima acción). */
    bonusDue: streakBonus(todayRow.base, streak.days),
    sources: {
      workout: count("workout") > 0,
      meals: count("meal"),
      checkin: count("checkin") > 0,
      weigh: count("weigh") > 0,
      challengeDays: count("challenge_day"),
    },
  };
});

/**
 * Acredita el bono de racha de HOY: (multiplicador − 1) × XP base del día local, con tope.
 * Idempotente y solo sube (grant_streak_bonus deja el total del día en el valor calculado si es mayor).
 * Se llama después de guardar entrenos, registros, comidas y retos (creditChallenges).
 */
export async function settleStreakBonus(v: Viewer): Promise<number> {
  if (v.demo) return 0;
  const db = adminClient();
  if (!db) return 0;
  const today = todayFor(v).iso;
  const since = new Date(Date.now() - 40 * 3600e3).toISOString();
  const [{ data }, active] = await Promise.all([
    db.from("xp_events").select("kind,xp,created_at").eq("user_id", v.id).gte("created_at", since),
    activeDays(db, v.id, today),
  ]);
  const base = ((data ?? []) as XpEvent[]).filter((e) => !BONUS_EXCLUDED.has(e.kind) && localDay(e.created_at, v.tz) === today).reduce((a, e) => a + Math.max(0, e.xp), 0);
  const bonus = streakBonus(base, streakOf(active, today).days);
  if (bonus <= 0) return 0;
  const { data: added, error } = await db.rpc("grant_streak_bonus", { p_user: v.id, p_day: today, p_xp: bonus });
  if (error) { console.warn("[xp] grant_streak_bonus", error.message); return 0; }
  return Number(added ?? 0);
}
