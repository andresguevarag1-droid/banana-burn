// Lee de la base (solo service_role, solo lectura) las filas del embudo de plata (#279) y el gasto en anuncios por semana.
// Todo acotado a las cuentas creadas en las últimas WEEKS semanas: por fecha de alta (profiles_created_idx, 0068) y por
// user_id en las demás tablas (sus índices o llaves únicas). Cada fuente que falla llega como null: la página dice "sin dato".
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/supabase/admin";
import { TRIAL_HABIT } from "@/lib/meta-semanal";
import { CARD_ASK_EVENTS, STEP_EVENTS, secondWorkoutUsers, type FunnelRows, type SignupRow, type Week } from "@/lib/embudo-plata";

const PAGE = 1000;
/** Tope de filas por fuente: con más, la cifra estaría incompleta, así que la fuente sale "sin dato". */
const CAP = 50_000;
const CHUNK = 150;

type Res = { data: unknown[] | null; error: unknown };

/** Todas las filas, de a PAGE (PostgREST corta en 1,000). Lanza si falla o pasa del tope. */
async function readAll<T>(page: (from: number, to: number) => PromiseLike<Res>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return out;
    if (out.length >= CAP) throw new Error("tope de filas");
  }
}

/** Lo mismo, partiendo la lista de cuentas en grupos para el filtro in(). */
async function byUsers<T>(ids: string[], page: (chunk: string[], from: number, to: number) => PromiseLike<Res>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    out.push(...(await readAll<T>((from, to) => page(chunk, from, to))));
    if (out.length >= CAP) throw new Error("tope de filas");
  }
  return out;
}

const orNull = <T>(p: Promise<T>) => p.catch(() => null);

/** Filas del embudo de las cuentas creadas en `weeks`. null si no se pudo leer quiénes se registraron (sin eso no hay tabla). */
export async function loadFunnelRows(db: SupabaseClient, weeks: Week[]): Promise<FunnelRows | null> {
  const start = weeks[weeks.length - 1].start, end = weeks[0].end;
  const profiles = await orNull(readAll<FunnelRows["profiles"][number]>((f, t) =>
    db.from("profiles").select("id,created_at,role,country").gte("created_at", start).lt("created_at", end).order("created_at").range(f, t)));
  if (!profiles) return null;
  const ids = profiles.map((p) => p.id);
  const ids1 = <T>(rows: { user_id: string }[]) => rows.map((r) => r.user_id) as T;

  // Sin la lista de testers no se sabe a quién quitar: sin tabla, igual que sin perfiles.
  const testers = await orNull(byUsers<{ user_id: string }>(ids, (c, f, t) => db.from("tester_grants").select("user_id").in("user_id", c).order("id").range(f, t)).then(ids1<string[]>));
  if (!testers) return null;

  const [condo, utm, signup, events, cardAsks, workouts, charges, methods, subs] = await Promise.all([
    orNull(byUsers<{ user_id: string }>(ids, (c, f, t) => db.from("condo_members").select("user_id").in("user_id", c).order("id").range(f, t)).then(ids1<string[]>)),
    orNull(byUsers<{ user_id: string; utm: unknown }>(ids, (c, f, t) => db.from("affiliate_referrals").select("user_id,utm").in("user_id", c).order("user_id").range(f, t))),
    orNull(byUsers<SignupRow>(ids, (c, f, t) =>
      db.from("signup_attribution").select("user_id,utm_source,utm_medium,utm_campaign,utm_content,fbclid").in("user_id", c).order("user_id").range(f, t))),
    orNull(byUsers<{ user_id: string; name: string }>(ids, (c, f, t) =>
      db.from("funnel_events").select("user_id,name").in("user_id", c).in("name", STEP_EVENTS).gte("created_at", start).order("id").range(f, t))),
    // Pedidos de tarjeta (#308): solo el `where` de props.
    orNull(byUsers<NonNullable<FunnelRows["cardAsks"]>[number]>(ids, (c, f, t) =>
      db.from("funnel_events").select("user_id,name,where:props->>where").in("user_id", c).in("name", Object.values(CARD_ASK_EVENTS)).gte("created_at", start).order("id").range(f, t))),
    orNull(byUsers<{ user_id: string; finished_at: string | null }>(ids, (c, f, t) =>
      db.from("workouts").select("user_id,finished_at").in("user_id", c).not("finished_at", "is", null).order("id").range(f, t))),
    orNull(byUsers<NonNullable<FunnelRows["charges"]>[number]>(ids, (c, f, t) => db.from("trial_charges").select("user_id,status,amount_minor").in("user_id", c).order("id").range(f, t))),
    orNull(byUsers<NonNullable<FunnelRows["methods"]>[number]>(ids, (c, f, t) => db.from("payment_methods").select("user_id,provider,status").in("user_id", c).order("user_id").range(f, t))),
    orNull(byUsers<NonNullable<FunnelRows["subs"]>[number]>(ids, (c, f, t) =>
      db.from("subscriptions").select("user_id,provider,status,plan,billing,current_period_end,cancel_at_period_end").in("user_id", c).order("id").range(f, t))),
  ]);
  const finished = workouts && [...new Set(workouts.map((r) => r.user_id))];
  const second = workouts && secondWorkoutUsers(profiles, workouts);
  const third = workouts && secondWorkoutUsers(profiles, workouts, TRIAL_HABIT);
  return { profiles, testers, condo, utm, signup, events, cardAsks, finished, second, third, charges, methods, subs };
}

/** Gasto en anuncios por semana (lunes → USD). null si la tabla no se pudo leer (por ejemplo, sin 0068). */
export async function loadAdSpend(db: SupabaseClient, weeks: Week[]): Promise<Map<string, number> | null> {
  const { data, error } = await db.from("ad_spend_weeks").select("week_start,amount_minor").in("week_start", weeks.map((w) => w.key));
  if (error) return null;
  return new Map((data ?? []).map((r) => [String(r.week_start), Number(r.amount_minor) / 100]));
}

/** Para /admin/embudo. Sin base (sin service_role) o sin perfiles: null. */
export async function getFunnel(weeks: Week[]): Promise<{ rows: FunnelRows | null; spend: Map<string, number> | null }> {
  const db = adminClient();
  if (!db) return { rows: null, spend: null };
  const [rows, spend] = await Promise.all([loadFunnelRows(db, weeks).catch(() => null), loadAdSpend(db, weeks).catch(() => null)]);
  return { rows, spend };
}
