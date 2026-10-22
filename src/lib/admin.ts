// Capa de datos del panel de staff (solo servidor). Lee con el cliente del usuario: RLS y las funciones
// SECURITY DEFINER de 0005_admin.sql repiten los permisos. En modo demo devuelve datos de ejemplo.
import { createClient, type Role, type Viewer } from "@/lib/supabase/server";
import { can } from "@/lib/admin-perms";
import {
  activeCounts, activityMap, addDays, churn, cohortRetention, crDay, dailySeries, FAILED, mrr, pct, resolvePlan, monthlyValue,
  signupsWithin, weekOf, type CohortRow, type SubRow,
} from "@/lib/admin-kpis";
import { DEMO_ANNOUNCEMENTS, DEMO_AUDIT, DEMO_CHALLENGES, DEMO_OVERRIDES, DEMO_REPORTS, demoWorld } from "@/lib/admin-demo";
import { crToday } from "@/lib/today";
import { EX } from "@/lib/engine/data";
import { FOODS } from "@/lib/foods";

export const PAGE_SIZE = 25;

type PgErr = { code?: string; message?: string } | null;
/** ¿El error indica que falta la migración 0005 (tabla o función inexistente)? */
export function isMissing(e: PgErr) {
  return !!e && ["42P01", "42883", "PGRST202", "PGRST205", "PGRST200"].includes(e.code ?? "");
}

// ─────────── Resumen ───────────

export type Dashboard = {
  source: "demo" | "rpc" | "fallback";
  today: string;
  users_total: number; onboarded: number; new_7: number; new_prev_7: number; new_30: number;
  active_today: number; active_7: number; active_30: number;
  paying: number; comps_active: number; workouts_today: number; workouts_7: number;
  series: { day: string; signups: number; workouts: number; active: number }[];
  retention: CohortRow[];
  revenue: null | { mrr: number; byPlan: Record<string, { n: number; mrr: number }>; churn: { base: number; lost: number; rate: number }; conversion: number };
};

const RET_WEEKS = 8;

export async function getDashboard(v: Viewer): Promise<Dashboard> {
  const today = crToday().iso;
  const withRevenue = can(v.role, "metrics.revenue");

  if (v.demo) {
    const { users, subs } = demoWorld();
    const act = new Map(users.map((u) => [u.id, u.days]));
    const acts = activeCounts(act, today);
    const allDays = users.flatMap((u) => [...u.days]);
    const signups = dailySeries(users.map((u) => crDay(u.created_at)), today, 30);
    const work = dailySeries(allDays.filter((_, i) => i % 3 !== 0), today, 30);
    const active = dailySeries(allDays, today, 30);
    const paying = new Set(subs.filter((s) => s.status === "active" || s.status === "past_due").map((s) => s.user_id)).size;
    const created = users.map((u) => u.created_at);
    return {
      source: "demo", today,
      users_total: users.length, onboarded: users.filter((u) => u.onboarded).length,
      new_7: signupsWithin(created, today, 7), new_prev_7: signupsWithin(created, addDays(today, -7), 7), new_30: signupsWithin(created, today, 30),
      active_today: acts.today, active_7: acts.d7, active_30: acts.d30, paying, comps_active: 2,
      workouts_today: work[work.length - 1].n, workouts_7: work.slice(-7).reduce((a, b) => a + b.n, 0),
      series: signups.map((s, i) => ({ day: s.day, signups: s.n, workouts: work[i].n, active: active[i].n })),
      retention: cohortRetention(users, act, today, RET_WEEKS),
      revenue: withRevenue ? revenueOf(subs, (id) => users.find((u) => u.id === id)?.plan, users.length, paying) : null,
    };
  }

  const sb = await createClient();
  const [k, s, r] = await Promise.all([sb.rpc("admin_kpis"), sb.rpc("admin_series", { p_days: 30 }), sb.rpc("admin_retention", { p_weeks: RET_WEEKS })]);
  let base: Omit<Dashboard, "revenue">;
  if (!k.error && !s.error && !r.error && k.data) {
    const K = k.data as Record<string, number>;
    base = {
      source: "rpc", today,
      users_total: K.users_total ?? 0, onboarded: K.onboarded ?? 0, new_7: K.new_7 ?? 0, new_prev_7: K.new_prev_7 ?? 0, new_30: K.new_30 ?? 0,
      active_today: K.active_today ?? 0, active_7: K.active_7 ?? 0, active_30: K.active_30 ?? 0,
      paying: K.paying ?? 0, comps_active: K.comps_active ?? 0, workouts_today: K.workouts_today ?? 0, workouts_7: K.workouts_7 ?? 0,
      series: ((s.data ?? []) as { day: string; signups: number; workouts: number; active: number }[]).map((x) => ({ ...x, day: String(x.day).slice(0, 10) })),
      retention: retentionFromRpc((r.data ?? []) as RetRpc[], today),
    };
  } else {
    base = await dashboardFallback(sb, today);
  }
  let revenue: Dashboard["revenue"] = null;
  if (withRevenue) {
    const { data: subs } = await sb.from("subscriptions").select("*").order("created_at", { ascending: false }).limit(5000);
    const planOf = await profilePlans(sb, ((subs ?? []) as SubRow[]).map((x) => x.user_id!).filter(Boolean));
    revenue = revenueOf((subs ?? []) as SubRow[], (id) => (id ? planOf.get(id) : null), base.users_total, base.paying);
  }
  return { ...base, revenue };
}

function revenueOf(subs: SubRow[], planOf: (id?: string) => string | null | undefined, users: number, paying: number): NonNullable<Dashboard["revenue"]> {
  const m = mrr(subs, planOf);
  return { mrr: m.total, byPlan: m.byPlan, churn: churn(subs, new Date(), 30), conversion: pct(paying, users) };
}

type RetRpc = { cohort: string; size: number; d1: number; d1_eligible: number; d7: number; d7_eligible: number; d30: number; d30_eligible: number };
function retentionFromRpc(rows: RetRpc[], today: string): CohortRow[] {
  const by = new Map(rows.map((x) => [String(x.cohort).slice(0, 10), x]));
  const first = addDays(weekOf(today), -7 * (RET_WEEKS - 1));
  const c = (n: number, e: number) => ({ n, eligible: e, rate: e ? pct(n, e) : null });
  return Array.from({ length: RET_WEEKS }, (_, i) => {
    const w = addDays(first, 7 * (RET_WEEKS - 1 - i));
    const x = by.get(w);
    return { cohort: w, size: x?.size ?? 0, d1: c(x?.d1 ?? 0, x?.d1_eligible ?? 0), d7: c(x?.d7 ?? 0, x?.d7_eligible ?? 0), d30: c(x?.d30 ?? 0, x?.d30_eligible ?? 0) };
  });
}

type SB = Awaited<ReturnType<typeof createClient>>;

/** Sin 0005 aplicada: calcula lo mismo con lecturas directas (RLS staff: leer) y los helpers puros. */
async function dashboardFallback(sb: SB, today: string): Promise<Omit<Dashboard, "revenue">> {
  const since = addDays(weekOf(today), -7 * (RET_WEEKS - 1) - 1);
  const [p, w, wt, dl, ml, subs] = await Promise.all([
    sb.from("profiles").select("id,created_at,onboarded").limit(10000),
    sb.from("workouts").select("user_id,day").gte("day", since).limit(50000),
    sb.from("weights").select("user_id,day").gte("day", since).limit(50000),
    sb.from("daily_logs").select("user_id,day").gte("day", since).limit(50000),
    sb.from("meals").select("user_id,day").gte("day", since).limit(50000),
    sb.from("subscriptions").select("user_id,status").in("status", ["active", "past_due"]).limit(10000),
  ]);
  const profiles = (p.data ?? []) as { id: string; created_at: string; onboarded: boolean }[];
  const workouts = (w.data ?? []) as { user_id: string; day: string }[];
  const act = activityMap([...workouts, ...((wt.data ?? []) as never[]), ...((dl.data ?? []) as never[]), ...((ml.data ?? []) as never[])]);
  const acts = activeCounts(act, today);
  const created = profiles.map((x) => x.created_at);
  const signups = dailySeries(created.map((c) => crDay(c)), today, 30);
  const work = dailySeries(workouts.map((x) => x.day), today, 30);
  const activeSeries = dailySeries([...act.values()].flatMap((s) => [...s]), today, 30);
  return {
    source: "fallback", today,
    users_total: profiles.length, onboarded: profiles.filter((x) => x.onboarded).length,
    new_7: signupsWithin(created, today, 7), new_prev_7: signupsWithin(created, addDays(today, -7), 7), new_30: signupsWithin(created, today, 30),
    active_today: acts.today, active_7: acts.d7, active_30: acts.d30,
    paying: new Set(((subs.data ?? []) as { user_id: string }[]).map((x) => x.user_id)).size, comps_active: 0,
    workouts_today: work[work.length - 1].n, workouts_7: work.slice(-7).reduce((a, b) => a + b.n, 0),
    series: signups.map((x, i) => ({ day: x.day, signups: x.n, workouts: work[i].n, active: activeSeries[i].n })),
    retention: cohortRetention(profiles, act, today, RET_WEEKS),
  };
}

async function profilePlans(sb: SB, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const uniq = [...new Set(ids)];
  for (let i = 0; i < uniq.length; i += 200) {
    const { data } = await sb.from("profiles").select("id,plan").in("id", uniq.slice(i, i + 200));
    for (const x of (data ?? []) as { id: string; plan: string }[]) out.set(x.id, x.plan);
  }
  return out;
}

async function profileNames(sb: SB, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const uniq = [...new Set(ids.filter((x) => x && /^[0-9a-f-]{36}$/i.test(x)))];
  for (let i = 0; i < uniq.length; i += 200) {
    const { data } = await sb.from("profiles").select("id,full_name").in("id", uniq.slice(i, i + 200));
    for (const x of (data ?? []) as { id: string; full_name: string | null }[]) out.set(x.id, x.full_name || "Sin nombre");
  }
  return out;
}

// ─────────── Usuarios ───────────

export type UserFilters = { q?: string; plan?: string; role?: string; status?: string; from?: string; to?: string; page?: number };
export type UserRow = { id: string; full_name: string | null; email: string | null; role: Role; plan: string; onboarded: boolean; created_at: string; last_active: string | null; comp_until: string | null };

export const USER_STATUS = [["activo", "Activo (7 d)"], ["inactivo", "Inactivo"], ["pendiente", "Sin terminar bienvenida"], ["cortesia", "Con cortesía"]] as const;

export function statusOf(u: Pick<UserRow, "onboarded" | "last_active" | "comp_until">, today = crToday().iso): string {
  if (!u.onboarded) return "pendiente";
  if (u.last_active && u.last_active > addDays(today, -7)) return "activo";
  return "inactivo";
}

export async function listUsers(v: Viewer, f: UserFilters): Promise<{ rows: UserRow[]; total: number; limited: boolean }> {
  const page = Math.max(1, f.page ?? 1);
  const today = crToday().iso;
  if (v.demo) {
    const { users } = demoWorld();
    const norm = (x?: string | null) => (x ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const q = f.q ? norm(f.q.trim()) : "";
    let rows: UserRow[] = users.map((u) => {
      const last = [...u.days].sort().pop() ?? null;
      return { id: u.id, full_name: u.full_name, email: u.email, role: u.role, plan: u.plan, onboarded: u.onboarded, created_at: u.created_at, last_active: last, comp_until: u.id.endsWith("09") || u.id.endsWith("17") ? `${addDays(today, 20)}T23:59:59Z` : null };
    });
    rows = rows.filter((u) =>
      (!q || norm(u.full_name).includes(q) || norm(u.email).includes(q) || u.id === q) &&
      (!f.plan || u.plan === f.plan) && (!f.role || u.role === f.role) &&
      (!f.from || crDay(u.created_at) >= f.from) && (!f.to || crDay(u.created_at) <= f.to) &&
      (!f.status || (f.status === "cortesia" ? !!u.comp_until : statusOf(u, today) === f.status)));
    rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { rows: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total: rows.length, limited: false };
  }
  const sb = await createClient();
  const { data, error } = await sb.rpc("admin_list_users", {
    p_q: f.q || null, p_plan: f.plan || null, p_role: f.role || null, p_status: f.status || null,
    p_from: f.from || null, p_to: f.to || null, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE,
  });
  if (!error) {
    const rows = (data ?? []) as (UserRow & { total: number })[];
    return { rows, total: Number(rows[0]?.total ?? 0), limited: false };
  }
  // Sin 0005: lectura directa de perfiles (sin correo ni última actividad).
  let query = sb.from("profiles").select("id,full_name,role,plan,onboarded,created_at", { count: "exact" }).order("created_at", { ascending: false });
  if (f.q) query = query.ilike("full_name", `%${f.q.replace(/[%_]/g, "")}%`);
  if (f.plan) query = query.eq("plan", f.plan);
  if (f.role) query = query.eq("role", f.role);
  if (f.status === "pendiente") query = query.eq("onboarded", false);
  if (f.from) query = query.gte("created_at", `${f.from}T00:00:00-06:00`);
  if (f.to) query = query.lte("created_at", `${f.to}T23:59:59-06:00`);
  const res = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const rows = ((res.data ?? []) as Omit<UserRow, "email" | "last_active" | "comp_until">[]).map((u) => ({ ...u, email: null, last_active: null, comp_until: null }));
  return { rows, total: res.count ?? rows.length, limited: true };
}

export type CompGrant = { id: number | string; plan: string; reason: string | null; starts_at: string; expires_at: string; revoked_at: string | null; granted_by_name?: string };
export type AuditRow = { id: number; actor: string | null; actor_name?: string; action: string; target: string | null; meta: Record<string, unknown> | null; created_at: string };

export type UserDetail = {
  account: { id: string; full_name: string | null; email: string | null; role: Role; plan: string; onboarded: boolean; created_at: string; country: string | null; last_sign_in_at: string | null; last_active: string | null };
  health?: { goal_type: string | null; equipment: string | null; train_days: number | null; goal: { start_weight: number; goal_weight: number; goal_date: string; mode: string } | null; weights: { day: string; kg: number }[] };
  activity?: { workouts_total: number; workouts_30: number; active_days_30: number; recent: string[] };
  billing?: { subs: (SubRow & { planLabel: string; monthly: number })[]; comps: CompGrant[] };
  audit?: AuditRow[];
};

export async function getUserDetail(v: Viewer, id: string): Promise<UserDetail | null> {
  const today = crToday().iso;
  const from30 = addDays(today, -29);
  if (v.demo) {
    const { users, subs } = demoWorld();
    const u = users.find((x) => x.id === id);
    if (!u) return null;
    const days = [...u.days].sort();
    const d: UserDetail = { account: { id: u.id, full_name: u.full_name, email: u.email, role: u.role, plan: u.plan, onboarded: u.onboarded, created_at: u.created_at, country: u.country, last_sign_in_at: days.length ? `${days[days.length - 1]}T07:30:00-06:00` : null, last_active: days[days.length - 1] ?? null } };
    if (can(v.role, "users.health")) d.health = { goal_type: u.goal_type, equipment: u.equipment, train_days: u.train_days, goal: u.goal, weights: u.weights.slice(-60) };
    if (can(v.role, "users.activity")) d.activity = { workouts_total: Math.round(days.length * 0.7), workouts_30: Math.round(days.filter((x) => x >= from30).length * 0.7), active_days_30: days.filter((x) => x >= from30).length, recent: days.slice(-28) };
    if (can(v.role, "users.billing")) d.billing = {
      subs: subs.filter((s) => s.user_id === u.id).map((s) => decorateSub(s, u.plan)),
      comps: u.id.endsWith("09") || u.id.endsWith("17") ? [{ id: 1, plan: "completo", reason: "Influencer piloto", starts_at: `${addDays(today, -10)}T10:00:00Z`, expires_at: `${addDays(today, 20)}T23:59:59Z`, revoked_at: null, granted_by_name: "Andrés Guevara" }] : [],
    };
    if (can(v.role, "audit.view")) d.audit = DEMO_AUDIT.filter((a) => a.target === u.id);
    return d;
  }

  const sb = await createClient();
  const { data: p } = await sb.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!p) return null;
  const acc = await sb.rpc("admin_user_account", { p_target: id });
  const a0 = (acc.data as { email: string; last_sign_in_at: string | null; last_active: string | null }[] | null)?.[0];
  const d: UserDetail = { account: { id, full_name: p.full_name, email: a0?.email ?? null, role: p.role, plan: p.plan, onboarded: p.onboarded, created_at: p.created_at, country: p.country ?? null, last_sign_in_at: a0?.last_sign_in_at ?? null, last_active: a0?.last_active ? String(a0.last_active).slice(0, 10) : null } };

  const jobs: Promise<void>[] = [];
  if (can(v.role, "users.health")) jobs.push((async () => {
    const [g, w] = await Promise.all([
      sb.from("goals").select("start_weight,goal_weight,goal_date,mode").eq("user_id", id).eq("active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      sb.from("weights").select("day,kg").eq("user_id", id).order("day", { ascending: false }).limit(60),
    ]);
    d.health = { goal_type: p.goal_type ?? null, equipment: p.equipment ?? null, train_days: p.train_days ?? null, goal: g.data ?? null, weights: ((w.data ?? []) as { day: string; kg: number }[]).map((x) => ({ day: x.day, kg: Number(x.kg) })).reverse() };
  })());
  if (can(v.role, "users.activity")) jobs.push((async () => {
    const [tot, w30, recent] = await Promise.all([
      sb.from("workouts").select("*", { count: "exact", head: true }).eq("user_id", id),
      sb.from("workouts").select("*", { count: "exact", head: true }).eq("user_id", id).gte("day", from30),
      sb.from("workouts").select("day").eq("user_id", id).gte("day", addDays(today, -27)).order("day"),
    ]);
    const rec = [...new Set(((recent.data ?? []) as { day: string }[]).map((x) => x.day))];
    d.activity = { workouts_total: tot.count ?? 0, workouts_30: w30.count ?? 0, active_days_30: rec.length, recent: rec };
  })());
  if (can(v.role, "users.billing")) jobs.push((async () => {
    const [s, c] = await Promise.all([
      sb.from("subscriptions").select("*").eq("user_id", id).order("created_at", { ascending: false }),
      sb.from("comp_grants").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(20),
    ]);
    const comps = (c.error ? [] : (c.data ?? [])) as (CompGrant & { granted_by: string | null })[];
    const names = await profileNames(sb, comps.map((x) => x.granted_by!).filter(Boolean));
    d.billing = { subs: ((s.data ?? []) as SubRow[]).map((x) => decorateSub(x, p.plan)), comps: comps.map((x) => ({ ...x, granted_by_name: x.granted_by ? names.get(x.granted_by) : undefined })) };
  })());
  if (can(v.role, "audit.view")) jobs.push((async () => {
    const { data } = await sb.from("audit_log").select("*").eq("target", id).order("created_at", { ascending: false }).limit(20);
    const rows = (data ?? []) as AuditRow[];
    const names = await profileNames(sb, rows.map((x) => x.actor!).filter(Boolean));
    d.audit = rows.map((x) => ({ ...x, actor_name: x.actor ? names.get(x.actor) : undefined }));
  })());
  await Promise.all(jobs);
  return d;
}

const PLAN_LABEL: Record<string, string> = { entreno: "Entreno", completo: "Entreno + Nutrición" };
function decorateSub(s: SubRow, fallbackPlan?: string | null) {
  const { plan, billing } = resolvePlan(s, fallbackPlan);
  return { ...s, planLabel: `${plan ? PLAN_LABEL[plan] : "—"} · ${billing === "anual" ? "anual" : "mensual"}`, monthly: Math.round(monthlyValue(s, fallbackPlan) * 100) / 100 };
}

// ─────────── Pagos ───────────

type PaymentRow = { id: string | number; user_id?: string; amount?: number; status?: string; created_at?: string; failure_reason?: string };
export type SubListRow = SubRow & { planLabel: string; monthly: number; name: string | null };
export async function listSubscriptions(v: Viewer, f: { status?: string; page?: number }) {
  const page = Math.max(1, f.page ?? 1);
  let all: SubRow[] = [];
  let names = new Map<string, string>();
  let plans = new Map<string, string>();
  let payments: PaymentRow[] | null = null;
  if (v.demo) {
    const w = demoWorld();
    all = w.subs;
    names = new Map(w.users.map((u) => [u.id, u.full_name]));
    plans = new Map(w.users.map((u) => [u.id, u.plan]));
  } else {
    const sb = await createClient();
    const { data } = await sb.from("subscriptions").select("*").order("created_at", { ascending: false }).limit(5000);
    all = (data ?? []) as SubRow[];
    const ids = all.map((s) => s.user_id!).filter(Boolean);
    [names, plans] = await Promise.all([profileNames(sb, ids), profilePlans(sb, ids)]);
    // La integración de pagos puede crear public.payments; si existe, mostramos los cobros fallidos.
    const pay = await sb.from("payments").select("*").in("status", ["failed", "declined", "error"]).order("created_at", { ascending: false }).limit(50);
    if (!pay.error) payments = (pay.data ?? []) as PaymentRow[];
  }
  const now = new Date();
  const m = mrr(all, (id) => (id ? plans.get(id) : null));
  const count = (st: string) => all.filter((s) => s.status === st).length;
  const deco = (s: SubRow): SubListRow => ({ ...decorateSub(s, s.user_id ? plans.get(s.user_id) : null), name: s.user_id ? names.get(s.user_id) ?? null : null });
  const filtered = f.status ? all.filter((s) => (f.status === "fallido" ? FAILED.has(s.status ?? "") : s.status === f.status)) : all;
  const in7 = now.getTime() + 7 * 864e5;
  return {
    summary: {
      mrr: m.total, byPlan: m.byPlan, arr: Math.round(m.total * 12 * 100) / 100,
      active: count("active"), trialing: count("trialing"), past_due: count("past_due"), canceled: all.filter((s) => s.status === "canceled" || s.status === "cancelled").length,
      churn: churn(all, now, 30),
      renewing7: all.filter((s) => s.status === "active" && s.current_period_end && Date.parse(s.current_period_end) <= in7 && Date.parse(s.current_period_end) >= now.getTime()).length,
    },
    failed: all.filter((s) => FAILED.has(s.status ?? "")).map(deco),
    payments,
    rows: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(deco),
    total: filtered.length,
  };
}

// ─────────── Contenido ───────────

export type ExerciseItem = { id: string; base: string; muscle: string; name: string | null; cues: string[]; enabled: boolean; updated_at: string | null };
export async function getExercises(v: Viewer): Promise<{ items: ExerciseItem[]; needsMigration: boolean }> {
  let ov: Record<string, { name: string | null; cues: string[]; enabled: boolean; updated_at: string }> = {};
  let needsMigration = false;
  if (v.demo) ov = DEMO_OVERRIDES;
  else {
    const sb = await createClient();
    const { data, error } = await sb.from("exercise_overrides").select("*");
    needsMigration = isMissing(error);
    for (const r of (data ?? []) as ({ exercise_id: string } & (typeof ov)[string])[]) ov[r.exercise_id] = r;
  }
  const items = Object.entries(EX).map(([id, e]) => ({ id, base: e.n, muscle: e.m, name: ov[id]?.name ?? null, cues: ov[id]?.cues ?? [], enabled: ov[id]?.enabled ?? true, updated_at: ov[id]?.updated_at ?? null }));
  return { items, needsMigration };
}

export type FoodRow = { id: number | string; name: string; portion: string | null; kcal: number | null; protein: number | null; carbs: number | null; fat: number | null; country: string | null; verified: boolean; slug?: string | null; grp?: string | null };
export async function getFoods(v: Viewer, f: { q?: string; verified?: string; page?: number }): Promise<{ rows: FoodRow[]; total: number; empty: boolean }> {
  const page = Math.max(1, f.page ?? 1);
  if (v.demo) {
    let rows: FoodRow[] = FOODS.map((x, i) => ({ id: i + 1, name: x.n, portion: x.p, kcal: x.k, protein: x.pr, carbs: x.c, fat: x.f, country: "CR", verified: i % 4 !== 3, slug: x.id, grp: x.g }));
    const q = f.q?.toLowerCase();
    rows = rows.filter((x) => (!q || x.name.toLowerCase().includes(q)) && (!f.verified || String(x.verified) === (f.verified === "si" ? "true" : "false")));
    return { rows: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total: rows.length, empty: false };
  }
  const sb = await createClient();
  let query = sb.from("foods").select("*", { count: "exact" }).order("name");
  if (f.q) query = query.ilike("name", `%${f.q.replace(/[%_]/g, "")}%`);
  if (f.verified) query = query.eq("verified", f.verified === "si");
  const { data, count } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const rows = (data ?? []) as FoodRow[];
  return { rows, total: count ?? rows.length, empty: !f.q && !f.verified && (count ?? 0) === 0 };
}

export type ChallengeRow = { id: string; slug: string; title: string; description: string | null; days: number; rules: Record<string, unknown>; active: boolean; sort: number };
export async function getChallenges(v: Viewer): Promise<{ rows: ChallengeRow[]; needsMigration: boolean }> {
  if (v.demo) return { rows: DEMO_CHALLENGES, needsMigration: false };
  const sb = await createClient();
  const { data, error } = await sb.from("challenges_catalog").select("*").order("sort").order("created_at");
  return { rows: (data ?? []) as ChallengeRow[], needsMigration: isMissing(error) };
}

export type AnnouncementRow = { id: string; title: string; body: string | null; audience: string; tone: string; cta_label: string | null; cta_href: string | null; starts_at: string | null; ends_at: string | null; active: boolean };
export async function getAnnouncements(v: Viewer): Promise<{ rows: AnnouncementRow[]; needsMigration: boolean }> {
  if (v.demo) return { rows: DEMO_ANNOUNCEMENTS, needsMigration: false };
  const sb = await createClient();
  const { data, error } = await sb.from("announcements").select("*").order("created_at", { ascending: false }).limit(100);
  return { rows: (data ?? []) as AnnouncementRow[], needsMigration: isMissing(error) };
}

// ─────────── Comunidad ───────────

export type ReportRow = { id: number; target_type: string; target_id: string; reporter: string | null; reporter_name?: string; reason: string; details: string | null; excerpt: string | null; status: string; created_at: string; resolved_at: string | null; resolution_note: string | null };
export async function listReports(v: Viewer, status = "abierto"): Promise<{ rows: ReportRow[]; counts: Record<string, number>; needsMigration: boolean }> {
  if (v.demo) {
    const counts = DEMO_REPORTS.reduce<Record<string, number>>((a, r) => ({ ...a, [r.status]: (a[r.status] ?? 0) + 1 }), {});
    return { rows: DEMO_REPORTS.filter((r) => status === "todos" || r.status === status).map((r) => ({ ...r, reporter_name: "Usuario demo" })), counts, needsMigration: false };
  }
  const sb = await createClient();
  let q = sb.from("reports").select("*").order("created_at", { ascending: false }).limit(100);
  if (status !== "todos") q = q.eq("status", status);
  const [{ data, error }, open] = await Promise.all([q, sb.from("reports").select("*", { count: "exact", head: true }).eq("status", "abierto")]);
  const rows = (data ?? []) as ReportRow[];
  const names = await profileNames(sb, rows.map((r) => r.reporter!).filter(Boolean));
  return { rows: rows.map((r) => ({ ...r, reporter_name: r.reporter ? names.get(r.reporter) : undefined })), counts: { abierto: open.count ?? 0 }, needsMigration: isMissing(error) };
}

// ─────────── Auditoría ───────────

export type AuditFilters = { action?: string; actor?: string; target?: string; from?: string; to?: string; page?: number };
export async function listAudit(v: Viewer, f: AuditFilters): Promise<{ rows: AuditRow[]; total: number; actions: string[] }> {
  const page = Math.max(1, f.page ?? 1);
  if (v.demo) {
    let rows: AuditRow[] = DEMO_AUDIT;
    rows = rows.filter((r) => (!f.action || r.action.startsWith(f.action)) && (!f.actor || r.actor === f.actor || r.actor_name?.toLowerCase().includes(f.actor.toLowerCase())) && (!f.target || r.target?.includes(f.target)) && (!f.from || crDay(r.created_at) >= f.from) && (!f.to || crDay(r.created_at) <= f.to));
    return { rows: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total: rows.length, actions: [...new Set(DEMO_AUDIT.map((r) => r.action))].sort() };
  }
  const sb = await createClient();
  let q = sb.from("audit_log").select("*", { count: "exact" }).order("created_at", { ascending: false });
  if (f.action) q = q.like("action", `${f.action.replace(/[%_]/g, "")}%`);
  if (f.actor && /^[0-9a-f-]{36}$/i.test(f.actor)) q = q.eq("actor", f.actor);
  if (f.target) q = q.ilike("target", `%${f.target.replace(/[%_]/g, "")}%`);
  if (f.from) q = q.gte("created_at", `${f.from}T00:00:00-06:00`);
  if (f.to) q = q.lte("created_at", `${f.to}T23:59:59-06:00`);
  const [{ data, count }, acts] = await Promise.all([q.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1), sb.from("audit_log").select("action").order("created_at", { ascending: false }).limit(500)]);
  const rows = (data ?? []) as AuditRow[];
  const names = await profileNames(sb, rows.map((r) => r.actor!).filter(Boolean));
  return { rows: rows.map((r) => ({ ...r, actor_name: r.actor ? names.get(r.actor) : undefined })), total: count ?? rows.length, actions: [...new Set(((acts.data ?? []) as { action: string }[]).map((x) => x.action))].sort() };
}

// ─────────── Búsqueda del topbar ───────────
/** Conteo de reportes abiertos para el badge de la navegación. */
export async function openReportsCount(v: Viewer): Promise<number> {
  if (v.demo) return DEMO_REPORTS.filter((r) => r.status === "abierto").length;
  const sb = await createClient();
  const { count, error } = await sb.from("reports").select("*", { count: "exact", head: true }).eq("status", "abierto");
  return error ? 0 : count ?? 0;
}
