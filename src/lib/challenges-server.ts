import "server-only";
import { errCode, logError, logWarn } from "@/lib/log";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, type Viewer } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { todayFor, todayIn } from "@/lib/today";
import { MILESTONE_DAYS, MILESTONE_XP, levelOf, perksAt } from "@/lib/gamify";
import { addDaysIso, challengeState, fromCatalogRow, mergeCatalog, parsePlan, SEED_CHALLENGES, type CatalogRow, type Challenge, type DayTask, type Outcome } from "@/lib/challenges";

export type Metrics = { workout: boolean; steps: number; water: number; protein: number; proteinGoal: number };
export type MyChallenge = { ucId: string; c: Challenge; startedOn: string; state: ReturnType<typeof challengeState>; autoOk: boolean;
  /** Comodines extra por nivel guardados al unirse (0018). */
  bonusGrace: number;
  /** Hoy se cumple automáticamente pero aún no está guardado (la tarjeta pide guardarlo con `syncChallenges`). */
  pendingSync?: boolean };
export type EndedChallenge = { ucId: string; c: Challenge; startedOn: string; outcome: Exclude<Outcome, "activo" | "completado">; completed: number; canRetry: boolean };

type UcRow = { id: number; challenge_id: string; started_on: string; status: string; completed_at: string | null; bonus_grace?: number | null };
const graceOf = (c: Challenge, r: Pick<UcRow, "bonus_grace">) => ({ days: c.days, grace: Math.min(Math.max(0, c.days - 1), c.grace + Math.max(0, Number(r.bonus_grace ?? 0))) });

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

/** Columnas de la tienda (0018). */
export const STORE_COLS = "slug,title,description,days,rules,status,price_usd,difficulty,minutes,cover,icon,verify,grace,xp,steps_goal,badge,reward_title,start_mode,start_date,featured,coming_soon,safety_note,sort";
type DefRow = CatalogRow & { plan?: unknown };

/**
 * Catálogo efectivo: lo publicado (RLS) más los retos en los que el usuario está o estuvo (my_challenge_defs, con su plan),
 * aunque luego se ocultaran. Una lectura por request. Sin la migración 0018 cae al catálogo de 0005 + el base.
 */
export const getCatalog = cache(async (demo: boolean): Promise<Map<string, Challenge>> => {
  if (demo) return new Map(SEED_CHALLENGES.map((c) => [c.id, c]));
  const sb = await createClient();
  const [{ data, error }, mine] = await Promise.all([
    sb.from("challenges_catalog").select(STORE_COLS).order("sort").order("created_at"),
    sb.rpc("my_challenge_defs"),
  ]);
  if (error) {
    // Base sin 0018: catálogo de 0005 (solo activos) sobre el base.
    const { data: old, error: e2 } = await sb.from("challenges_catalog").select("slug,title,description,days,rules").eq("active", true).order("sort");
    return new Map(mergeCatalog(e2 ? [] : ((old ?? []) as CatalogRow[])).map((c) => [c.id, c]));
  }
  const out = new Map<string, Challenge>();
  for (const row of (data ?? []) as CatalogRow[]) { const c = fromCatalogRow(row); if (c) out.set(c.id, c); }
  for (const row of ((mine.data ?? []) as DefRow[])) { const c = fromCatalogRow(row, parsePlan(row.plan, row.days)); if (c) out.set(c.id, c); }
  return out;
});

/** Retos de pago que el usuario tiene (compra o cortesía). */
export const getOwned = cache(async (v: Viewer): Promise<Set<string>> => {
  if (v.demo) return new Set(["abdomen-21"]);
  const { data } = await (await createClient()).from("challenge_entitlements").select("challenge_slug").eq("user_id", v.id);
  return new Set(((data ?? []) as { challenge_slug: string }[]).map((r) => r.challenge_slug));
});

/** Personas con cada reto en curso (dato real; en demo no se inventa: queda vacío). */
export const getParticipants = cache(async (v: Viewer): Promise<Map<string, number>> => {
  if (v.demo) return new Map();
  const { data, error } = await (await createClient()).rpc("challenge_participants");
  if (error) return new Map();
  return new Map(((data ?? []) as { slug: string; n: number }[]).map((r) => [r.slug, Number(r.n)]));
});

/** Plan de un reto para quien mira (completo, o los primeros días si es de pago y no lo tiene). */
export async function getPlan(v: Viewer, c: Challenge, owned: boolean): Promise<{ days: DayTask[]; locked: boolean }> {
  if (v.demo || c.plan) {
    const all = c.plan ?? [];
    const locked = c.priceUsd > 0 && !owned;
    return { days: locked ? all.slice(0, 3) : all, locked };
  }
  const { data, error } = await (await createClient()).rpc("challenge_plan", { p_slug: c.id });
  if (error || !data) return { days: [], locked: c.priceUsd > 0 && !owned };
  const j = data as { days?: unknown; locked?: boolean };
  return { days: parsePlan(j.days, c.days), locked: !!j.locked };
}

/** XP total y beneficios del nivel (descuento en la tienda, comodines extra). */
export async function levelPerks(v: Viewer) {
  const { getXpTotal } = await import("@/lib/xp-server");
  const xp = await getXpTotal(v);
  const lv = levelOf(xp);
  return { xp, level: lv, ...perksAt(lv.idx) };
}

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
      return { ucId: `demo-${id}`, c, startedOn, state: challengeState(c, startedOn, autoOk ? [...days, today] : days, today), autoOk, bonusGrace: 0 };
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
  const { data: rows } = await sb.from("user_challenges").select("*").eq("user_id", v.id)
    .or(`status.eq.activo,status.eq.completado,and(status.in.(fallido,vencido),started_on.gte.${since})`).order("created_at");
  const list = (rows ?? []) as UcRow[];
  const ids = list.filter((r) => r.status !== "completado").map((r) => r.id);
  const { data: ck, error: ckErr } = ids.length ? await sb.from("challenge_checkins").select("user_challenge_id,day").in("user_challenge_id", ids) : { data: [], error: null };
  // Sin los días cumplidos, un reto en curso se vería "fallido": mejor la pantalla de error con "Intentar de nuevo".
  if (ckErr) throw Object.assign(new Error("No se pudieron leer los días de los retos"), { code: ckErr.code });
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
    const state = challengeState(graceOf(c, r), r.started_on, autoOk && !saved.includes(today) ? [...saved, today] : saved, today);
    if (state.outcome === "completado") { done.push({ c, at: today }); continue; }
    if (state.outcome !== "activo") { ended.push({ ucId: String(r.id), c, startedOn: r.started_on, outcome: state.outcome, completed: state.completed, canRetry: true }); continue; }
    activeIds.add(c.id);
    active.push({ ucId: String(r.id), c, startedOn: r.started_on, state, autoOk, bonusGrace: Number(r.bonus_grace ?? 0), pendingSync: autoOk && !saved.includes(today) });
  }
  // Reintentar solo si no estás ya en ese reto; un reto terminado se muestra una sola vez (el más reciente).
  const seen = new Set<string>();
  const endedOut = ended.reverse().filter((e) => (seen.has(e.c.id) || activeIds.has(e.c.id) ? false : (seen.add(e.c.id), true)));
  return { active, done, ended: endedOut };
}

/** Retos completados (medallas y certificados del perfil), del más reciente al más viejo. */
export async function getCompletedChallenges(v: Viewer): Promise<{ c: Challenge; at: string }[]> {
  const today = todayFor(v).iso;
  const catalog = await getCatalog(v.demo);
  if (v.demo) return DEMO_DONE(today).map((d) => ({ c: catalog.get(d.c)!, at: d.at }));
  const { data } = await (await createClient()).from("user_challenges").select("challenge_id,completed_at,started_on").eq("user_id", v.id).eq("status", "completado").order("completed_at", { ascending: false }).limit(50);
  return ((data ?? []) as { challenge_id: string; completed_at: string | null; started_on: string }[])
    .map((r) => ({ c: catalog.get(r.challenge_id), at: String(r.completed_at ?? r.started_on).slice(0, 10) }))
    .filter((x): x is { c: Challenge; at: string } => !!x.c);
}

// ───────────── Escrituras (acciones de servidor y cron) ─────────────

/**
 * Cierra los retos activos cuyo resultado ya está decidido. El `update … where status = 'activo' returning`
 * garantiza que solo una corrida gana: el XP del reto completado se otorga una sola vez.
 */
async function finalize(db: SupabaseClient, userId: string, r: UcRow, c: Challenge, days: string[], today: string): Promise<Outcome> {
  const state = challengeState(graceOf(c, r), r.started_on, days, today);
  if (state.outcome === "activo" || state.outcome === "completado") await milestones(db, userId, r, state.completed, c.days);
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

/** Hitos de los días 7 y 14 cumplidos: +25 XP una sola vez por reto (la clave primaria de challenge_milestones lo garantiza). */
async function milestones(db: SupabaseClient, userId: string, r: UcRow, completed: number, days: number) {
  for (const m of MILESTONE_DAYS) {
    if (completed < m || m >= days) continue;
    const { data, error } = await db.from("challenge_milestones").upsert({ user_challenge_id: r.id, user_id: userId, milestone: m }, { onConflict: "user_challenge_id,milestone", ignoreDuplicates: true }).select("milestone");
    if (!error && data?.length) await db.from("xp_events").insert({ user_id: userId, kind: "challenge_milestone", xp: MILESTONE_XP });
  }
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
  const { data: rows } = await db.from("user_challenges").select("*").eq("user_id", v.id).eq("status", "activo");
  const list = (rows ?? []) as UcRow[];
  if (!list.length) { await settle(v); return out; }
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
    const { data: ck, error: ckErr } = await db.from("challenge_checkins").select("day").eq("user_challenge_id", r.id);
    if (ckErr) continue; // sin los días cumplidos no se cierra nada (con la lista vacía el reto parecería fallido)
    const res = await finalize(db, v.id, r, c, (ck ?? []).map((x) => x.day as string), today);
    if (res !== "activo") out.closed.push(res);
  }
  await settle(v);
  return out;
}

/** Bono de racha del día (nunca bloquea la acción que lo dispara). */
async function settle(v: Viewer) {
  try { const { settleStreakBonus } = await import("@/lib/xp-server"); await settleStreakBonus(v); } catch (e) { logWarn("xp", "streak_bonus_failed", { kind: errCode(e) }); }
}

/** Solo cierra retos decididos (antes de contar el cupo de activos al unirse). No acredita nada. */
export async function closeDecidedChallenges(v: Viewer) {
  if (v.demo) return;
  const db = writer();
  if (!db) return;
  const today = todayFor(v).iso;
  const { data: rows } = await db.from("user_challenges").select("*").eq("user_id", v.id).eq("status", "activo");
  const catalog = await getCatalog(false);
  for (const r of (rows ?? []) as UcRow[]) {
    const c = catalog.get(r.challenge_id);
    if (!c) continue;
    const { data: ck, error: ckErr } = await db.from("challenge_checkins").select("day").eq("user_challenge_id", r.id);
    if (ckErr) continue;
    await finalize(db, v.id, r, c, (ck ?? []).map((x) => x.day as string), today);
  }
}

/**
 * Cron diario: acredita el día ANTERIOR (en la zona horaria de cada usuario) de los retos de entreno, pasos y agua
 * con sus registros, y cierra los retos decididos (libera el cupo de 3 activos aunque el usuario no abra la app).
 * La proteína necesita la meta personal del motor: esa se acredita con `creditChallenges` al guardar comidas.
 */
export async function sweepChallenges(now = new Date(), opts: { deadline?: number } = {}): Promise<{ users: number; credited: number; closed: number; errors: number; partial?: boolean }> {
  const stats: { users: number; credited: number; closed: number; errors: number; partial?: boolean } = { users: 0, credited: 0, closed: 0, errors: 0 };
  const db = adminClient();
  if (!db) return stats;
  const catalog = await catalogForCron(db);
  // Paginación por id (no por posición): al cerrar retos, las filas "activo" se mueven y un range() saltaría algunas.
  let lastId: number | string | null = null;
  for (;;) {
    if (opts.deadline != null && Date.now() > opts.deadline) { stats.partial = true; break; }
    let q = db.from("user_challenges").select("*").eq("status", "activo").order("id").limit(200); // 200: los ids de usuario viajan en la URL
    if (lastId !== null) q = q.gt("id", lastId);
    const { data, error } = await q;
    if (error) { stats.errors++; logError("cron:retos", "query_failed", { code: error.code }); break; }
    if (!data?.length) break;
    lastId = (data[data.length - 1] as { id: number | string }).id;
    const rows = data as (UcRow & { user_id: string })[];
    const users = [...new Set(rows.map((r) => r.user_id))];
    stats.users += users.length;
    const { data: profs } = await db.from("profiles").select("id,timezone").in("id", users);
    const { data: prefs } = await db.from("notification_prefs").select("user_id,timezone").in("user_id", users);
    const tzOf = new Map<string, string>();
    for (const p of (profs ?? []) as { id: string; timezone: string | null }[]) if (p.timezone) tzOf.set(p.id, p.timezone);
    for (const p of (prefs ?? []) as { user_id: string; timezone: string | null }[]) if (p.timezone) tzOf.set(p.user_id, p.timezone);
    for (const r of rows) {
      if (opts.deadline != null && Date.now() > opts.deadline) { stats.partial = true; break; }
      // Un reto con datos raros no detiene al resto. Acreditar (upsert) y cerrar son idempotentes: correr dos veces es seguro.
      try {
        const c = catalog.get(r.challenge_id);
        if (!c) continue; // reto borrado del catálogo: se deja como está
        const today = todayIn(tzOf.get(r.user_id), now).iso;
        const yesterday = addDaysIso(today, -1);
        if (c.verify !== "manual" && c.verify !== "protein" && r.started_on <= yesterday && (await metOn(db, r.user_id, c, yesterday))) {
          const { data: added } = await db.from("challenge_checkins").upsert({ user_challenge_id: r.id, user_id: r.user_id, day: yesterday }, { onConflict: "user_challenge_id,day", ignoreDuplicates: true }).select("day");
          stats.credited += added?.length ?? 0;
        }
        const { data: ck, error: ckErr } = await db.from("challenge_checkins").select("day").eq("user_challenge_id", r.id);
        // Sin la lista de días cumplidos no se decide nada: cerrar con datos vacíos marcaría el reto como fallido.
        if (ckErr) { stats.errors++; continue; }
        if ((await finalize(db, r.user_id, r, c, (ck ?? []).map((x) => x.day as string), today)) !== "activo") stats.closed++;
      } catch (e) { stats.errors++; logError("cron:retos", "row_failed", { kind: errCode(e) }); }
    }
    if (stats.partial || data.length < 200) break;
  }
  return stats;
}

/** Todo el catálogo (también ocultos y archivados: quien ya está inscrito debe poder terminar). */
async function catalogForCron(db: SupabaseClient) {
  const { data, error } = await db.from("challenges_catalog").select(STORE_COLS);
  if (error) {
    const { data: old, error: e2 } = await db.from("challenges_catalog").select("slug,title,description,days,rules").eq("active", true);
    return new Map(mergeCatalog(e2 ? [] : ((old ?? []) as CatalogRow[])).map((c) => [c.id, c]));
  }
  const out = new Map<string, Challenge>();
  for (const row of (data ?? []) as CatalogRow[]) { const c = fromCatalogRow(row); if (c) out.set(c.id, c); }
  return out;
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
