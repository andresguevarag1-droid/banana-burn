import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, type Viewer } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { todayFor, todayIn } from "@/lib/today";
import { DEMO_CHALLENGES } from "@/lib/admin-demo";
import { addDaysIso, challengeState, mergeCatalog, type CatalogRow, type Challenge, type Outcome } from "@/lib/challenges";

export type Metrics = { workout: boolean; steps: number; water: number; protein: number; proteinGoal: number };
export type MyChallenge = { ucId: string; c: Challenge; startedOn: string; state: ReturnType<typeof challengeState>; autoOk: boolean;
  /** Hoy se cumple automáticamente pero aún no está guardado (la tarjeta pide guardarlo con `syncChallenges`). */
  pendingSync?: boolean };
export type EndedChallenge = { ucId: string; c: Challenge; startedOn: string; outcome: Exclude<Outcome, "activo" | "completado">; completed: number; canRetry: boolean };

type UcRow = { id: number; challenge_id: string; started_on: string; status: string; completed_at: string | null };

/** ¿Las métricas de hoy cumplen el reto automático? */
export function metAuto(c: Challenge, m: Metrics) {
  switch (c.verify) {
    case "workout": return m.workout;
    case "steps": return m.steps >= (c.stepsGoal ?? 10000);
    case "water": return m.water >= 8;
    case "protein": return m.proteinGoal > 0 && m.protein >= m.proteinGoal * 0.95;
    default: return false;
  }
}

// ───────────── Catálogo ─────────────

/** Catálogo efectivo (base + panel). Una lectura por request; si la tabla no existe o falla, queda el base. */
export const getCatalog = cache(async (demo: boolean): Promise<Map<string, Challenge>> => {
  let rows: CatalogRow[] = [];
  if (demo) rows = DEMO_CHALLENGES.filter((c) => c.active);
  else {
    const { data, error } = await (await createClient()).from("challenges_catalog").select("slug,title,description,days,rules").eq("active", true).order("sort");
    if (!error) rows = (data ?? []) as CatalogRow[];
  }
  return new Map(mergeCatalog(rows).map((c) => [c.id, c]));
});

// ───────────── Lectura (sin escrituras: el render no modifica la base) ─────────────

const DEMO_DONE = (today: string) => [{ c: "agua-21", at: addDaysIso(today, -14) }];

/**
 * Retos del usuario para mostrar. Calcula el estado con lo guardado y, si las métricas de hoy ya cumplen un reto
 * automático, lo muestra cumplido (lo persiste `creditChallenges`, que llaman las acciones al guardar y el cron).
 */
export async function getMyChallenges(v: Viewer, m: Metrics): Promise<{ active: MyChallenge[]; done: { c: Challenge; at: string }[]; ended: EndedChallenge[] }> {
  const today = todayFor(v).iso;
  const catalog = await getCatalog(v.demo);
  if (v.demo) {
    const mk = (id: string, start: number, done: number[]): MyChallenge => {
      const c = catalog.get(id)!; const startedOn = addDaysIso(today, -start);
      const autoOk = metAuto(c, m);
      const days = done.map((i) => addDaysIso(startedOn, i));
      return { ucId: `demo-${id}`, c, startedOn, state: challengeState(c, startedOn, autoOk ? [...days, today] : days, today), autoOk };
    };
    const failedStart = addDaysIso(today, -12);
    const plancha = catalog.get("plancha-30")!;
    return {
      active: [mk("banana-30", 10, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), mk("flexiones-30", 2, [0, 1])],
      done: DEMO_DONE(today).map((d) => ({ c: catalog.get(d.c)!, at: d.at })),
      ended: [{ ucId: "demo-plancha", c: plancha, startedOn: failedStart, outcome: "fallido", completed: 5, canRetry: true }],
    };
  }
  const sb = await createClient();
  const since = addDaysIso(today, -45);
  const { data: rows } = await sb.from("user_challenges").select("id,challenge_id,started_on,status,completed_at").eq("user_id", v.id)
    .or(`status.eq.activo,status.eq.completado,and(status.in.(fallido,vencido),started_on.gte.${since})`).order("created_at");
  const list = (rows ?? []) as UcRow[];
  const ids = list.filter((r) => r.status !== "completado").map((r) => r.id);
  const { data: ck } = ids.length ? await sb.from("challenge_checkins").select("user_challenge_id,day").in("user_challenge_id", ids) : { data: [] };
  const daysOf = new Map<number, string[]>();
  for (const x of (ck ?? []) as { user_challenge_id: number; day: string }[]) daysOf.set(x.user_challenge_id, [...(daysOf.get(x.user_challenge_id) ?? []), x.day]);

  const active: MyChallenge[] = [], done: { c: Challenge; at: string }[] = [], ended: EndedChallenge[] = [];
  const activeIds = new Set<string>();
  for (const r of list) {
    const c = catalog.get(r.challenge_id);
    if (!c) continue;
    if (r.status === "completado") { done.push({ c, at: String(r.completed_at ?? r.started_on).slice(0, 10) }); continue; }
    if (r.status === "fallido" || r.status === "vencido") { ended.push({ ucId: String(r.id), c, startedOn: r.started_on, outcome: r.status, completed: (daysOf.get(r.id) ?? []).length, canRetry: true }); continue; }
    const autoOk = metAuto(c, m);
    const saved = daysOf.get(r.id) ?? [];
    const state = challengeState(c, r.started_on, autoOk && !saved.includes(today) ? [...saved, today] : saved, today);
    if (state.outcome === "completado") { done.push({ c, at: today }); continue; }
    if (state.outcome !== "activo") { ended.push({ ucId: String(r.id), c, startedOn: r.started_on, outcome: state.outcome, completed: state.completed, canRetry: true }); continue; }
    activeIds.add(c.id);
    active.push({ ucId: String(r.id), c, startedOn: r.started_on, state, autoOk, pendingSync: autoOk && !saved.includes(today) });
  }
  // Reintentar solo si no estás ya en ese reto; un reto terminado se muestra una sola vez (el más reciente).
  const seen = new Set<string>();
  const endedOut = ended.reverse().filter((e) => (seen.has(e.c.id) || activeIds.has(e.c.id) ? false : (seen.add(e.c.id), true)));
  return { active, done, ended: endedOut };
}

// ───────────── Escrituras (acciones de servidor y cron) ─────────────

/**
 * Cierra los retos activos cuyo resultado ya está decidido. El `update … where status = 'activo' returning`
 * garantiza que solo una corrida gana: el XP del reto completado se otorga una sola vez.
 */
async function finalize(db: SupabaseClient, userId: string, r: UcRow, c: Challenge, days: string[], today: string): Promise<Outcome> {
  const state = challengeState(c, r.started_on, days, today);
  if (state.outcome === "activo") return "activo";
  const { data: won, error } = await db.from("user_challenges")
    .update({ status: state.outcome, completed_at: state.outcome === "completado" ? new Date().toISOString() : null })
    .eq("id", r.id).eq("user_id", userId).eq("status", "activo").select("id");
  if (error || !won?.length) return "activo";
  if (state.outcome === "completado") {
    await db.from("xp_events").insert({ user_id: userId, kind: "challenge", xp: c.xp });
    await postCompletion(db, userId, c);
  }
  return state.outcome;
}

/** Publicación "Completó el reto" en la comunidad, con la privacidad del perfil. */
async function postCompletion(db: SupabaseClient, userId: string, c: Challenge) {
  const { data: prof } = await db.from("profiles").select("share_workouts,visibility,suspended_at").eq("id", userId).maybeSingle();
  if (!prof || prof.share_workouts === false || prof.visibility === "privado" || prof.suspended_at) return;
  await db.from("posts").insert({ user_id: userId, kind: "challenge", visibility: prof.visibility ?? "seguidores", data: { title: `Completó el reto ${c.title}`.slice(0, 80), icon: "medal", challenge: c.title.slice(0, 80) } });
}

/** Cliente con permisos para acreditar retos automáticos y cerrar retos (la RLS solo deja al usuario marcar retos manuales de hoy). */
function writer(): SupabaseClient | null {
  const a = adminClient();
  if (!a) console.warn("[retos] sin SUPABASE_SERVICE_ROLE_KEY: no se acreditan retos automáticos ni se cierran retos");
  return a;
}

/**
 * Acredita los retos automáticos de HOY con las métricas del usuario y cierra los que ya se decidieron.
 * Llamar después de guardar el registro diario (pasos, agua, proteína), una comida o un entreno.
 * Idempotente: se puede llamar varias veces el mismo día. Si no pasas métricas, se calculan.
 */
export async function creditChallenges(v: Viewer, m?: Metrics): Promise<{ credited: number; closed: Outcome[] }> {
  const out = { credited: 0, closed: [] as Outcome[] };
  if (v.demo) return out;
  const db = writer();
  if (!db) return out;
  const today = todayFor(v).iso;
  const { data: rows } = await db.from("user_challenges").select("id,challenge_id,started_on,status,completed_at").eq("user_id", v.id).eq("status", "activo");
  const list = (rows ?? []) as UcRow[];
  if (!list.length) return out;
  const catalog = await getCatalog(false);
  const auto = list.some((r) => { const c = catalog.get(r.challenge_id); return c && c.verify !== "manual"; });
  const metrics = m ?? (auto ? await (await import("@/lib/metrics")).todayMetrics(v) : null);
  for (const r of list) {
    const c = catalog.get(r.challenge_id);
    if (!c) continue;
    if (metrics && c.verify !== "manual" && metAuto(c, metrics) && r.started_on <= today) {
      const { data: added } = await db.from("challenge_checkins").upsert({ user_challenge_id: r.id, user_id: v.id, day: today }, { onConflict: "user_challenge_id,day", ignoreDuplicates: true }).select("day");
      out.credited += added?.length ?? 0;
    }
    const { data: ck } = await db.from("challenge_checkins").select("day").eq("user_challenge_id", r.id);
    const res = await finalize(db, v.id, r, c, (ck ?? []).map((x) => x.day as string), today);
    if (res !== "activo") out.closed.push(res);
  }
  return out;
}

/** Solo cierra retos decididos (antes de contar el cupo de activos al unirse). No acredita nada. */
export async function closeDecidedChallenges(v: Viewer) {
  if (v.demo) return;
  const db = writer();
  if (!db) return;
  const today = todayFor(v).iso;
  const { data: rows } = await db.from("user_challenges").select("id,challenge_id,started_on,status,completed_at").eq("user_id", v.id).eq("status", "activo");
  const catalog = await getCatalog(false);
  for (const r of (rows ?? []) as UcRow[]) {
    const c = catalog.get(r.challenge_id);
    if (!c) continue;
    const { data: ck } = await db.from("challenge_checkins").select("day").eq("user_challenge_id", r.id);
    await finalize(db, v.id, r, c, (ck ?? []).map((x) => x.day as string), today);
  }
}

/**
 * Cron diario: acredita el día ANTERIOR (en la zona horaria de cada usuario) de los retos de entreno, pasos y agua
 * con sus registros, y cierra los retos decididos (libera el cupo de 3 activos aunque el usuario no abra la app).
 * La proteína necesita la meta personal del motor: esa se acredita con `creditChallenges` al guardar comidas.
 */
export async function sweepChallenges(now = new Date()): Promise<{ users: number; credited: number; closed: number }> {
  const stats = { users: 0, credited: 0, closed: 0 };
  const db = adminClient();
  if (!db) return stats;
  const catalog = await catalogForCron(db);
  for (let from = 0; ; from += 500) {
    const { data, error } = await db.from("user_challenges").select("id,user_id,challenge_id,started_on,status,completed_at").eq("status", "activo").order("id").range(from, from + 499);
    if (error || !data?.length) break;
    const rows = data as (UcRow & { user_id: string })[];
    const users = [...new Set(rows.map((r) => r.user_id))];
    stats.users += users.length;
    const { data: profs } = await db.from("profiles").select("id,timezone").in("id", users);
    const { data: prefs } = await db.from("notification_prefs").select("user_id,timezone").in("user_id", users);
    const tzOf = new Map<string, string>();
    for (const p of (profs ?? []) as { id: string; timezone: string | null }[]) if (p.timezone) tzOf.set(p.id, p.timezone);
    for (const p of (prefs ?? []) as { user_id: string; timezone: string | null }[]) if (p.timezone) tzOf.set(p.user_id, p.timezone);
    for (const r of rows) {
      const c = catalog.get(r.challenge_id);
      if (!c) continue;
      const today = todayIn(tzOf.get(r.user_id), now).iso;
      const yesterday = addDaysIso(today, -1);
      if (c.verify !== "manual" && c.verify !== "protein" && r.started_on <= yesterday && (await metOn(db, r.user_id, c, yesterday))) {
        const { data: added } = await db.from("challenge_checkins").upsert({ user_challenge_id: r.id, user_id: r.user_id, day: yesterday }, { onConflict: "user_challenge_id,day", ignoreDuplicates: true }).select("day");
        stats.credited += added?.length ?? 0;
      }
      const { data: ck } = await db.from("challenge_checkins").select("day").eq("user_challenge_id", r.id);
      if ((await finalize(db, r.user_id, r, c, (ck ?? []).map((x) => x.day as string), today)) !== "activo") stats.closed++;
    }
    if (data.length < 500) break;
  }
  return stats;
}

async function catalogForCron(db: SupabaseClient) {
  const { data, error } = await db.from("challenges_catalog").select("slug,title,description,days,rules").eq("active", true);
  return new Map(mergeCatalog(error ? [] : ((data ?? []) as CatalogRow[])).map((c) => [c.id, c]));
}

/** ¿Los registros del usuario cumplen el reto ese día? (entreno, pasos o agua). */
async function metOn(db: SupabaseClient, userId: string, c: Challenge, day: string) {
  if (c.verify === "workout") {
    const { count } = await db.from("workouts").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("day", day);
    return (count ?? 0) > 0;
  }
  const { data } = await db.from("daily_logs").select("steps,water_glasses").eq("user_id", userId).eq("day", day).maybeSingle();
  if (c.verify === "steps") return Number(data?.steps ?? 0) >= (c.stepsGoal ?? 10000);
  if (c.verify === "water") return Number(data?.water_glasses ?? 0) >= 8;
  return false;
}
