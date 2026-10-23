// Corrida del cron de recordatorios: carga usuarios por lotes, decide con `decide()` y envía push/correo/in-app.
import "server-only";
// Idempotente: cada envío se "reclama" primero en notification_log (unique user_id+kind+local_day).
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/supabase/admin";
import { errCode, logError } from "@/lib/log";
import { planDay, planWeek, scheduleFor, weeklyTrend, type Equipment } from "@/lib/engine";
import { streakOf } from "@/lib/gamify";
import { DEFAULT_PREFS, copyFor, cronModeFrom, daysBetween, decide, isRelevantHour, localClock, type Decision, type Kind, type Prefs } from "@/lib/notify";
import { sendPush, type PushSub } from "@/lib/push";
import { sendEmail, unsubscribeUrl } from "@/lib/email/send";
import * as T from "@/lib/email/templates";

// 200 por página: la lista de ids va en la URL (`in.(...)`) y con 1000 UUID pasaría de ~37 KB, más de lo que aceptan los proxies.
const PAGE = 200;
const CHUNK = 100;
const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

type Profile = { id: string; full_name: string | null; train_days: number | null; equipment: string | null; timezone: string | null };
export type RunStats = { ok: boolean; skipped?: string; mode: "hourly" | "daily"; scanned: number; candidates: number; sent: Record<string, number>; push: number; email: number; errors: number; /** Se cortó por tiempo: la próxima corrida sigue (los envíos ya hechos no se repiten). */ partial?: boolean };

const isoMinus = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

const ROWS = 1000; // tope de filas por respuesta de Supabase (max-rows)
type Page<T> = { data: T[] | null; error: { code?: string } | null };

/** Lee todas las páginas de una consulta (`range` de a 1000) hasta que una venga incompleta. Exportada para pruebas. */
export async function allPages<T>(page: (from: number, to: number) => PromiseLike<Page<T>>, max = 50_000): Promise<{ data: T[]; error: { code?: string } | null }> {
  const out: T[] = [];
  for (let from = 0; from < max; from += ROWS) {
    const { data, error } = await page(from, from + ROWS - 1);
    if (error) return { data: out, error };
    out.push(...(data ?? []));
    if (!data || data.length < ROWS) break;
  }
  return { data: out, error: null };
}

export function cronMode(): "hourly" | "daily" {
  return cronModeFrom(process.env.NOTIFY_CRON_MODE);
}

/**
 * `deadline` (epoch ms): deja de tomar lotes nuevos al acercarse el límite de la función, para terminar
 * con estadísticas en vez de que Vercel la corte a la mitad. Reintentar es seguro (notification_log).
 */
export async function runReminders(now = new Date(), mode = cronMode(), opts: { deadline?: number } = {}): Promise<RunStats> {
  const stats: RunStats = { ok: true, mode, scanned: 0, candidates: 0, sent: {}, push: 0, email: 0, errors: 0 };
  const admin = adminClient();
  if (!admin) return { ...stats, skipped: "Supabase service_role no configurado (modo demo)" };

  const late = () => opts.deadline != null && Date.now() > opts.deadline;
  for (let from = 0; ; from += PAGE) {
    if (late()) { stats.partial = true; break; }
    const { data: profiles, error } = await admin.from("profiles")
      .select("id,full_name,train_days,equipment,timezone").eq("onboarded", true)
      .order("id").range(from, from + PAGE - 1);
    if (error) { stats.ok = false; stats.errors++; logError("cron:recordatorios", "profiles_query_failed", { code: error.code, from }); break; }
    if (!profiles?.length) break;
    stats.scanned += profiles.length;

    const ids = profiles.map((p) => p.id as string);
    const { data: prefRows, error: prefErr } = await admin.from("notification_prefs").select("*").in("user_id", ids);
    // Sin preferencias no sabemos quién apagó los avisos ni su horario: mejor no mandar nada en esta página.
    if (prefErr) { stats.ok = false; stats.errors++; logError("cron:recordatorios", "prefs_query_failed", { code: prefErr.code }); if (profiles.length < PAGE) break; continue; }
    const prefsOf = new Map<string, Prefs>();
    for (const p of profiles as Profile[]) prefsOf.set(p.id, { ...DEFAULT_PREFS, timezone: p.timezone || DEFAULT_PREFS.timezone });
    for (const r of prefRows ?? []) prefsOf.set(r.user_id as string, { ...DEFAULT_PREFS, ...stripNulls(r) } as Prefs);

    const due = (profiles as Profile[]).filter((p) => isRelevantHour(now, prefsOf.get(p.id)!, mode));
    stats.candidates += due.length;
    for (let i = 0; i < due.length; i += CHUNK) {
      if (late()) { stats.partial = true; break; }
      try { await processChunk(admin, due.slice(i, i + CHUNK), prefsOf, now, mode, stats); }
      catch (e) { stats.errors++; logError("cron:recordatorios", "chunk_failed", { kind: errCode(e) }); }
    }
    if (stats.partial) break;
    if (profiles.length < PAGE) break;
  }
  return stats;
}

function stripNulls(r: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) if (v !== null || k === "quiet_start" || k === "quiet_end") out[k] = v;
  return out;
}

async function processChunk(admin: SupabaseClient, users: Profile[], prefsOf: Map<string, Prefs>, now: Date, mode: "hourly" | "daily", stats: RunStats) {
  const ids = users.map((u) => u.id);
  const utcToday = now.toISOString().slice(0, 10);
  const since = isoMinus(utcToday, 61);
  // 100 usuarios × 61 días pasan de las 1000 filas que devuelve Supabase por respuesta: se lee por páginas.
  // Sin esto, alguien activo quedaba fuera del corte, parecía inactivo y recibía "te extrañamos".
  const [wk, dl, ws, logs, subs] = await Promise.all([
    allPages((a, b) => admin.from("workouts").select("user_id,day").in("user_id", ids).gte("day", since).order("id").range(a, b)),
    allPages((a, b) => admin.from("daily_logs").select("user_id,day").in("user_id", ids).gte("day", since).order("user_id").order("day").range(a, b)),
    allPages((a, b) => admin.from("weights").select("user_id,day,kg").in("user_id", ids).gte("day", isoMinus(utcToday, 21)).order("user_id").order("day").range(a, b)),
    allPages((a, b) => admin.from("notification_log").select("user_id,kind,local_day,pushes").in("user_id", ids).gte("local_day", isoMinus(utcToday, 2)).order("id").range(a, b)),
    allPages((a, b) => admin.from("push_subscriptions").select("user_id,endpoint,p256dh,auth").in("user_id", ids).order("endpoint").range(a, b)),
  ]);
  // Si falla una lectura, el lote se salta: con datos incompletos alguien activo parecería inactivo y recibiría "te extrañamos".
  const failed = [wk, dl, ws, logs, subs].find((r) => r.error);
  if (failed) throw Object.assign(new Error("lectura incompleta"), { code: failed.error?.code ?? "query_failed" });
  const group = <R extends { user_id: string }>(rows: R[] | null) => {
    const m = new Map<string, R[]>();
    for (const r of rows ?? []) { const l = m.get(r.user_id) ?? []; l.push(r); m.set(r.user_id, l); }
    return m;
  };
  const wkBy = group(wk.data as { user_id: string; day: string }[]);
  const dlBy = group(dl.data as { user_id: string; day: string }[]);
  const wsBy = group(ws.data as { user_id: string; day: string; kg: number }[]);
  const logBy = group(logs.data as { user_id: string; kind: string; local_day: string; pushes: number }[]);
  const subBy = group(subs.data as (PushSub & { user_id: string })[]);

  for (const u of users) {
    // Un usuario con datos raros (o un fallo puntual de push/correo) no detiene al resto del lote.
    try { await processUser(admin, u, prefsOf, now, mode, stats, { wkBy, dlBy, wsBy, logBy, subBy }); }
    catch (e) { stats.errors++; logError("cron:recordatorios", "user_failed", { kind: errCode(e) }); }
  }
}

type Grouped = {
  wkBy: Map<string, { user_id: string; day: string }[]>; dlBy: Map<string, { user_id: string; day: string }[]>; wsBy: Map<string, { user_id: string; day: string; kg: number }[]>;
  logBy: Map<string, { user_id: string; kind: string; local_day: string; pushes: number }[]>; subBy: Map<string, (PushSub & { user_id: string })[]>;
};

async function processUser(admin: SupabaseClient, u: Profile, prefsOf: Map<string, Prefs>, now: Date, mode: "hourly" | "daily", stats: RunStats, { wkBy, dlBy, wsBy, logBy, subBy }: Grouped) {
  {
    const prefs = prefsOf.get(u.id)!;
    const c = localClock(now, prefs.timezone);
    const workouts = (wkBy.get(u.id) ?? []).map((r) => r.day);
    const active = new Set<string>([...workouts, ...(dlBy.get(u.id) ?? []).map((r) => r.day), ...(wsBy.get(u.id) ?? []).map((r) => r.day)]);
    const past = [...active].filter((d) => d <= c.iso).sort();
    const last = past[past.length - 1];
    const todayLogs = (logBy.get(u.id) ?? []).filter((l) => l.local_day === c.iso);
    const sched = scheduleFor(Number(u.train_days ?? 6));
    const eq = (u.equipment as Equipment) ?? "gym";
    const plan = planDay(c.dow, 0, sched, eq);
    const streak = streakOf(active, c.iso).days;
    const userSubs = subBy.get(u.id) ?? [];

    const decisions = decide({
      now, prefs, mode,
      trainingDay: plan.tpl !== null,
      trainedToday: workouts.includes(c.iso),
      activeToday: active.has(c.iso),
      streak,
      daysInactive: last ? daysBetween(last, c.iso) : null,
      sentToday: todayLogs.map((l) => l.kind),
      pushesToday: todayLogs.reduce((a, l) => a + (l.pushes ?? 0), 0),
      hasPushSubscription: userSubs.length > 0,
      hasEmail: true,
    });
    if (!decisions.length) return;

    let email: string | null | undefined;
    const getEmail = async () => {
      if (email === undefined) { const { data } = await admin.auth.admin.getUserById(u.id); email = data.user?.email ?? null; }
      return email;
    };
    const name = u.full_name || "";

    for (const d of decisions) {
      // Reclamar el envío: si otra corrida ya lo hizo hoy, no se repite.
      const { data: claimed, error } = await admin.from("notification_log")
        .upsert({ user_id: u.id, kind: d.kind, local_day: c.iso, channels: channels(d), pushes: d.push ? 1 : 0 }, { onConflict: "user_id,kind,local_day", ignoreDuplicates: true })
        .select("id");
      if (error) { stats.errors++; continue; }
      if (!claimed?.length) continue;

      const weekly = d.kind === "semanal" ? await weeklyData(admin, u, c.iso, workouts, wsBy.get(u.id) ?? [], streak, sched, eq) : null;
      const copy = copyFor(d.kind, { name, routine: plan.name, mins: plan.mins, streak, trainingDay: plan.tpl !== null, workouts: weekly?.workouts, kgDelta: weekly && weekly.kgStart != null && weekly.kgEnd != null ? weekly.kgEnd - weekly.kgStart : null, day: c.iso });

      if (d.inapp) await admin.from("notifications").insert({ user_id: u.id, kind: d.kind, title: copy.title, body: copy.body, url: copy.url });
      if (d.push) stats.push += await sendPush(admin, userSubs, { ...copy, tag: d.kind });
      if (d.email) {
        const to = await getEmail();
        if (to) {
          const msg = emailFor(d.kind, { u, name, plan, streak, weekly });
          const r = await sendEmail(to, msg.email, { idempotencyKey: `${d.kind}/${u.id}/${c.iso}`, unsubscribe: msg.unsubscribe, tags: { kind: d.kind } });
          if (r.ok) stats.email++;
        }
      }
      stats.sent[d.kind] = (stats.sent[d.kind] ?? 0) + 1;
    }
  }
}

const channels = (d: Decision) => [d.inapp && "inapp", d.push && "push", d.email && "email"].filter(Boolean) as string[];

type WeeklyCtx = Omit<T.WeeklyData, "name" | "unsubscribe">;

async function weeklyData(admin: SupabaseClient, u: Profile, today: string, workouts: string[], weights: { day: string; kg: number }[], streak: number, sched: ReturnType<typeof scheduleFor>, eq: Equipment): Promise<WeeklyCtx> {
  const from = isoMinus(today, 7);
  const week = workouts.filter((d) => d >= from && d < today);
  const ws = weights.filter((w) => w.day >= from && w.day < today).sort((a, b) => (a.day < b.day ? -1 : 1));
  const trend = weeklyTrend(weights.filter((w) => w.day < today).map((w) => ({ d: w.day, kg: Number(w.kg) })));
  const { data: prRows } = await admin.from("xp_events").select("kind").eq("user_id", u.id).eq("kind", "pr").gte("created_at", from + "T00:00:00Z");
  const prs = (prRows ?? []).length;
  const planned = Object.values(sched).filter(Boolean).length;
  const next = planWeek(0, sched, eq).filter((d) => d.tpl).map((d) => ({ day: DAYS[d.dow], name: d.name }));
  return {
    workouts: new Set(week).size, planned, streak,
    kgStart: ws.length ? Number(ws[0].kg) : null, kgEnd: ws.length > 1 ? Number(ws[ws.length - 1].kg) : null, trendPerWeek: trend,
    prs: prs ? [`${prs} récord${prs > 1 ? "s" : ""} nuevo${prs > 1 ? "s" : ""} esta semana`] : [],
    nextWeek: next,
  };
}

function emailFor(kind: Kind, x: { u: Profile; name: string; plan: ReturnType<typeof planDay>; streak: number; weekly: WeeklyCtx | null }) {
  switch (kind) {
    case "semanal": { const unsubscribe = unsubscribeUrl(x.u.id, "semanal"); return { unsubscribe, email: T.resumenSemanal({ name: x.name, ...x.weekly!, unsubscribe }) }; }
    case "racha": { const unsubscribe = unsubscribeUrl(x.u.id, "recordatorios"); return { unsubscribe, email: T.rachaEnPeligro({ name: x.name, streak: x.streak, unsubscribe }) }; }
    case "reactivacion_3":
    case "reactivacion_7": { const unsubscribe = unsubscribeUrl(x.u.id, "recordatorios"); return { unsubscribe, email: T.reactivacion({ name: x.name, days: kind === "reactivacion_3" ? 3 : 7, routine: x.plan.name, trainingDay: x.plan.tpl !== null, unsubscribe }) }; }
    case "recordatorio":
    default: { const unsubscribe = unsubscribeUrl(x.u.id, "recordatorios"); return { unsubscribe, email: T.recordatorio({ name: x.name, routine: x.plan.name, mins: x.plan.mins, exercises: x.plan.exercises.map((e) => e.name), streak: x.streak, unsubscribe }) }; }
  }
}
