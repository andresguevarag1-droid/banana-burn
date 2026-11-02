// Lee de la base las filas de la activación de un día (solo service_role) y las cuenta con activacion.ts.
// La usan el resumen diario del dueño (admin-avisos-server.ts) y el Resumen de /admin.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/supabase/admin";
import { COHORT_DAYS_AGO, computeActivation, type Activation, type ActivationRows } from "@/lib/activacion";

const DAY = 86400_000;

/** Activación del día [start, end) observada en `now`. Lanza si una lectura falla (quien llama decide qué mostrar). */
export async function loadActivation(db: SupabaseClient, range: { start: string; end: string }, now = new Date()): Promise<Activation> {
  const { start, end } = range;
  const cStart = new Date(new Date(start).getTime() - COHORT_DAYS_AGO * DAY).toISOString();
  const cEnd = new Date(new Date(end).getTime() - COHORT_DAYS_AGO * DAY).toISOString();
  const ok = <T>(r: { data: T | null; error: unknown }): T => { if (r.error) throw r.error; return r.data as T; };
  const [signups, cohort, events, finished, cards, trialPaid, subs] = await Promise.all([
    db.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", start).lt("created_at", end),
    db.from("profiles").select("id,created_at").gte("created_at", cStart).lt("created_at", cEnd).limit(5000),
    db.from("funnel_events").select("user_id,name").in("name", ["workout_open", "workout_leave"]).gte("created_at", start).lt("created_at", end).limit(20000),
    db.from("workouts").select("user_id").not("finished_at", "is", null).gte("finished_at", start).lt("finished_at", end).limit(5000),
    db.from("trial_charges").select("id", { count: "exact", head: true }).gte("created_at", start).lt("created_at", end),
    db.from("trial_charges").select("user_id,last_attempt_at,updated_at").eq("status", "succeeded").limit(10000),
    db.from("subscriptions").select("user_id,created_at").in("provider", ["onvo", "tilopay"]).lt("created_at", end).limit(10000),
  ]);
  if (signups.error) throw signups.error;
  if (cards.error) throw cards.error;
  const cohortRows = ok(cohort) as ActivationRows["cohort"];
  const ids = cohortRows.map((p) => p.id);
  const cohortWorkouts = ids.length
    ? ok(await db.from("workouts").select("user_id,finished_at").in("user_id", ids).not("finished_at", "is", null).lt("finished_at", end).limit(20000)) as ActivationRows["cohortWorkouts"]
    : [];
  return computeActivation({
    signups: signups.count ?? 0,
    cohort: cohortRows,
    cohortWorkouts,
    events: ok(events) as ActivationRows["events"],
    finished: ok(finished) as ActivationRows["finished"],
    cards: cards.count ?? 0,
    trialPaid: ok(trialPaid) as ActivationRows["trialPaid"],
    subs: ok(subs) as ActivationRows["subs"],
  }, range, now);
}

/** Para /admin: el día de hoy en Costa Rica hasta este momento. Sin base (modo demo) o si algo falla, null. */
export async function getTodayActivation(range: { start: string; end: string }): Promise<Activation | null> {
  const db = adminClient();
  if (!db) return null;
  return loadActivation(db, range).catch(() => null);
}
