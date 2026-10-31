// Corrida del cron de recordatorios: carga usuarios por lotes, decide con `decide()` y envía push/correo/in-app.
import "server-only";
// Idempotente: cada envío se "reclama" primero en notification_log (unique user_id+kind+local_day).
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/supabase/admin";
import { errCode, logError } from "@/lib/log";
import { EX, nextTrainingDow, planDay, planWeek, scheduleFor, weeklyTrend, type Equipment } from "@/lib/engine";
import { parseVoice, type Voice } from "@/lib/voice";
import { streakOf } from "@/lib/gamify";
import { DEFAULT_PREFS, ONCE_DAY, copyFor, cronModeFrom, daysBetween, decide, inQuietHours, isHHMM, isRelevantHour, liftFact, liftLine, localClock, toMinutes, type Decision, type Kind, type LiftFact, type Prefs } from "@/lib/notify";
import { sendPush, type NativeToken, type PushSub } from "@/lib/push";
import { sendEmail, unsubscribeUrl } from "@/lib/email/send";
import { withLoginLinks } from "@/lib/email/login-link";
import * as T from "@/lib/email/templates";
import { forEachLimit } from "@/lib/concurrency";
import { STAFF } from "@/lib/supabase/server";
import { stepDay, trialSequenceStep, trialStepAt, type TrialSequenceCharge, type TrialStep } from "@/lib/trial-sequence";
import { BETA_ENDS_AT } from "@/lib/plans";
import { entitlementsFrom, type CompRow, type SubscriptionRow } from "@/lib/entitlements";
import { kindFor, promoFor } from "@/lib/trial";
import { betaEndDay, betaEndEligible, betaEndIdemKey, betaEndKind, betaEndStep } from "@/lib/beta-fin";
import { recoveryDay, recoveryIdemKey, recoveryStep, recoveryStepAt, type RecoveryStep } from "@/lib/recuperacion";

// 200 por página: la lista de ids va en la URL (`in.(...)`) y con 1000 UUID pasaría de ~37 KB, más de lo que aceptan los proxies.
const PAGE = 200;
const CHUNK = 100;
const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

type Profile = { id: string; created_at?: string | null; full_name: string | null; sex?: string | null; train_days: number | null; equipment: string | null; timezone: string | null; /** "Cómo te hablo" (0035); sin la columna, intermedio. */ lenguaje?: string | null };
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
  // Fin de la beta (1 al 7 nov): primero, porque es una sola semana y son los primeros clientes posibles.
  try { await sendBetaEndEmails(admin, now, mode, stats, late); }
  catch (e) { stats.errors++; logError("cron:fin-beta", "run_failed", { kind: errCode(e) }); }
  for (let from = 0; ; from += PAGE) {
    if (late()) { stats.partial = true; break; }
    const { data: profiles, error } = await profilePage(admin, from);
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

const PROFILE_COLS = "id,created_at,full_name,sex,train_days,equipment,timezone";
/** Una página de perfiles con su registro de lenguaje. Si 0035 no corrió (columna inexistente), se lee sin él. */
async function profilePage(admin: SupabaseClient, from: number) {
  const q = (cols: string) => admin.from("profiles").select(cols).eq("onboarded", true).order("id").range(from, from + PAGE - 1);
  const r = await q(`${PROFILE_COLS},lenguaje`);
  if (r.error?.code === "42703" || r.error?.code === "PGRST204") return q(PROFILE_COLS) as unknown as Promise<{ data: Profile[] | null; error: { code?: string } | null }>;
  return r as unknown as { data: Profile[] | null; error: { code?: string } | null };
}

/**
 * Dato real para el recordatorio: el ejercicio principal de hoy (el primero con peso que la persona ya hizo),
 * con el peso más alto de cada una de sus dos últimas sesiones. Una sola consulta y solo para el recordatorio.
 * Si falla, el recordatorio sale igual, sin el dato.
 */
export async function lastLiftFact(admin: SupabaseClient, userId: string, exerciseIds: string[]): Promise<LiftFact | null> {
  const ids = exerciseIds.filter((id) => (EX[id as keyof typeof EX]?.inc ?? 0) > 0).slice(0, 4);
  if (!ids.length) return null;
  try {
    const { data, error } = await admin.from("workout_sets").select("exercise,kg,workout_id").eq("user_id", userId).in("exercise", ids).gt("kg", 0).order("workout_id", { ascending: false }).limit(80);
    if (error || !data?.length) return null;
    for (const id of ids) {
      const byWorkout = new Map<string, number>();
      for (const r of data as { exercise: string; kg: number | string; workout_id: string | number }[]) {
        if (r.exercise !== id) continue;
        const k = String(r.workout_id);
        byWorkout.set(k, Math.max(byWorkout.get(k) ?? 0, Number(r.kg) || 0));
      }
      // El orden de inserción ya es de reciente a antigua: se invierte para liftFact (antigua → reciente).
      const tops = [...byWorkout.values()].slice(0, 2).reverse();
      const f = liftFact(EX[id as keyof typeof EX].n, tops);
      if (f) return f;
    }
    return null;
  } catch {
    return null;
  }
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
  const [wk, dl, ws, logs, subs, gl, phones] = await Promise.all([
    allPages((a, b) => admin.from("workouts").select("user_id,day").in("user_id", ids).gte("day", since).order("id").range(a, b)),
    allPages((a, b) => admin.from("daily_logs").select("user_id,day").in("user_id", ids).gte("day", since).order("user_id").order("day").range(a, b)),
    allPages((a, b) => admin.from("weights").select("user_id,day,kg").in("user_id", ids).gte("day", isoMinus(utcToday, 21)).order("user_id").order("day").range(a, b)),
    allPages((a, b) => admin.from("notification_log").select("user_id,kind,local_day,pushes").in("user_id", ids).gte("local_day", isoMinus(utcToday, 2)).order("id").range(a, b)),
    allPages((a, b) => admin.from("push_subscriptions").select("user_id,endpoint,p256dh,auth").in("user_id", ids).order("endpoint").range(a, b)),
    // Meta activa: personaliza los correos ("te faltan X kg"). Si falla, los correos salen sin la tarjeta de meta.
    allPages((a, b) => admin.from("goals").select("user_id,start_weight,goal_weight,goal_date").in("user_id", ids).eq("active", true).order("id").range(a, b)),
    // Teléfonos con la app nativa (0057). Si la tabla aún no existe, el lote sigue solo con Web Push.
    allPages((a, b) => admin.from("native_push_tokens").select("user_id,token,platform").in("user_id", ids).order("id").range(a, b)),
  ]);
  // Si falla una lectura, el lote se salta: con datos incompletos alguien activo parecería inactivo y recibiría "te extrañamos".
  const failed = [wk, dl, ws, logs, subs].find((r) => r.error);
  if (gl.error) logError("cron:recordatorios", "goals_query_failed", { code: gl.error.code });
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
  const phoneBy = group((phones.error ? [] : phones.data) as (NativeToken & { user_id: string })[]);
  const goalBy = new Map<string, GoalRow>();
  for (const g of (gl.error ? [] : gl.data) as GoalRow[]) goalBy.set(g.user_id, g);
  const [stepBy, recoveryBy] = await Promise.all([trialSequenceFor(admin, users, prefsOf, now), recoveryFor(admin, users, prefsOf, now)]);

  // Varias personas a la vez (cada una espera push, correo y la base): con miles de cuentas, de una en una no alcanzaba
  // el tiempo de la función. Cada envío se reclama antes en notification_log, así que el orden no importa.
  await forEachLimit(users, USER_CONCURRENCY, async (u) => {
    // Un usuario con datos raros (o un fallo puntual de push/correo) no detiene al resto del lote.
    try { await processUser(admin, u, prefsOf, now, mode, stats, { wkBy, dlBy, wsBy, logBy, subBy, phoneBy, goalBy, stepBy, recoveryBy }); }
    catch (e) { stats.errors++; logError("cron:recordatorios", "user_failed", { kind: errCode(e) }); }
  });
}

/** Personas procesadas a la vez en cada lote (push y correo en paralelo, sin saturar la base ni Resend). */
const USER_CONCURRENCY = 8;

/**
 * Secuencia de la prueba (trial-sequence.ts): qué pieza le toca hoy a cada cuenta del lote. Solo consulta pagos, cortesías,
 * testers y cobros de las cuentas con una ventana abierta (registradas hace 1, 3 o 5 días). Si alguna lectura falla, nadie
 * del lote la recibe: sin esos datos podría llegarle a quien ya pagó. Exportada para pruebas.
 */
export async function trialSequenceFor(admin: SupabaseClient, users: Pick<Profile, "id" | "created_at">[], prefsOf: Map<string, Prefs>, now: Date): Promise<Map<string, TrialStep>> {
  const out = new Map<string, TrialStep>();
  const ids = users.filter((u) => trialStepAt(u.created_at, now) && prefsOf.get(u.id)?.email_reminders).map((u) => u.id);
  if (!ids.length) return out;
  const [prof, subs, comps, testers, charges] = await Promise.all([
    admin.from("profiles").select("id,plan,role").in("id", ids),
    admin.from("subscriptions").select("user_id,status").in("user_id", ids),
    admin.from("comp_grants").select("user_id,revoked_at").in("user_id", ids),
    admin.from("tester_grants").select("user_id,revoked_at").in("user_id", ids),
    admin.from("trial_charges").select("user_id,status,kind,charge_at,reminder_sent_at").in("user_id", ids),
  ]);
  const failed = [prof, subs, comps, testers, charges].find((r) => r.error);
  if (failed) { logError("cron:recordatorios", "trial_sequence_query_failed", { code: failed.error?.code }); return out; }
  const has = (rows: unknown[] | null, ok: (r: Record<string, unknown>) => boolean) => new Set((rows as Record<string, unknown>[] | null ?? []).filter(ok).map((r) => r.user_id as string));
  const paid = has(subs.data, (r) => r.status !== "incomplete");
  const comp = has(comps.data, (r) => !r.revoked_at);
  const tester = has(testers.data, (r) => !r.revoked_at);
  const profBy = new Map((prof.data as { id: string; plan: string | null; role: string | null }[] | null ?? []).map((r) => [r.id, r]));
  const chargeBy = new Map((charges.data as (TrialSequenceCharge & { user_id: string })[] | null ?? []).map((r) => [r.user_id, r]));
  for (const u of users) {
    if (!ids.includes(u.id)) continue;
    const pr = profBy.get(u.id);
    const step = trialSequenceStep({
      createdAt: u.created_at, now, emailReminders: true, profilePlan: pr?.plan, staff: STAFF.includes(pr?.role as (typeof STAFF)[number]),
      paid: paid.has(u.id), comp: comp.has(u.id), tester: tester.has(u.id), charge: chargeBy.get(u.id) ?? null,
    });
    if (step) out.set(u.id, step);
  }
  return out;
}

/**
 * Recuperación al terminar la prueba sin plan (recuperacion.ts): qué correo (día 8 o 14) le toca hoy a cada cuenta del lote.
 * Solo consulta las cuentas con una ventana abierta. Si alguna lectura falla, nadie del lote lo recibe: sin esos datos podría
 * llegarle a quien ya pagó o tiene un cobro en curso. Exportada para pruebas.
 */
export async function recoveryFor(admin: SupabaseClient, users: Pick<Profile, "id" | "created_at">[], prefsOf: Map<string, Prefs>, now: Date): Promise<Map<string, RecoveryStep>> {
  const out = new Map<string, RecoveryStep>();
  const ids = users.filter((u) => recoveryStepAt(u.created_at, now) && prefsOf.get(u.id)?.email_reminders).map((u) => u.id);
  if (!ids.length) return out;
  const [prof, subs, comps, testers, charges] = await Promise.all([
    admin.from("profiles").select("id,plan,role").in("id", ids),
    admin.from("subscriptions").select("user_id,status").in("user_id", ids),
    admin.from("comp_grants").select("user_id,revoked_at").in("user_id", ids),
    admin.from("tester_grants").select("user_id,revoked_at").in("user_id", ids),
    admin.from("trial_charges").select("user_id").in("user_id", ids),
  ]);
  const failed = [prof, subs, comps, testers, charges].find((r) => r.error);
  if (failed) { logError("cron:recordatorios", "recovery_query_failed", { code: failed.error?.code }); return out; }
  const has = (rows: unknown[] | null, ok: (r: Record<string, unknown>) => boolean = () => true) => new Set((rows as Record<string, unknown>[] | null ?? []).filter(ok).map((r) => r.user_id as string));
  const paid = has(subs.data, (r) => r.status !== "incomplete");
  const comp = has(comps.data, (r) => !r.revoked_at);
  const tester = has(testers.data, (r) => !r.revoked_at);
  const charged = has(charges.data);
  const profBy = new Map((prof.data as { id: string; plan: string | null; role: string | null }[] | null ?? []).map((r) => [r.id, r]));
  for (const u of users) {
    if (!ids.includes(u.id)) continue;
    const pr = profBy.get(u.id);
    const step = recoveryStep({
      createdAt: u.created_at, now, emailReminders: true, profilePlan: pr?.plan, staff: STAFF.includes(pr?.role as (typeof STAFF)[number]),
      paid: paid.has(u.id), comp: comp.has(u.id), tester: tester.has(u.id), hasCharge: charged.has(u.id),
    });
    if (step) out.set(u.id, step);
  }
  return out;
}

type Grouped = {
  wkBy: Map<string, { user_id: string; day: string }[]>; dlBy: Map<string, { user_id: string; day: string }[]>; wsBy: Map<string, { user_id: string; day: string; kg: number }[]>;
  logBy: Map<string, { user_id: string; kind: string; local_day: string; pushes: number }[]>; subBy: Map<string, (PushSub & { user_id: string })[]>;
  phoneBy: Map<string, (NativeToken & { user_id: string })[]>;
  goalBy: Map<string, GoalRow>;
  /** Pieza de la secuencia de la prueba que le toca hoy (trialSequenceFor). */
  stepBy: Map<string, TrialStep>;
  /** Correo de recuperación (día 8 o 14) cuya ventana está abierta hoy (recoveryFor). */
  recoveryBy: Map<string, RecoveryStep>;
};
type GoalRow = { user_id: string; start_weight: number | string; goal_weight: number | string; goal_date: string | null };

/** Meta para los correos: el peso actual es el último pesaje (hasta 21 días) o, si no hay, el inicial. Exportada para pruebas. */
export function goalFor(g: GoalRow | undefined, weights: { day: string; kg: number | string }[]): T.Goal | null {
  if (!g) return null;
  const goal = Number(g.goal_weight), start = Number(g.start_weight);
  if (!Number.isFinite(goal) || !Number.isFinite(start)) return null;
  const last = [...weights].sort((a, b) => (a.day < b.day ? -1 : 1)).at(-1);
  const current = last ? Number(last.kg) : start;
  return { start, current: Number.isFinite(current) ? current : start, goal, date: g.goal_date };
}

async function processUser(admin: SupabaseClient, u: Profile, prefsOf: Map<string, Prefs>, now: Date, mode: "hourly" | "daily", stats: RunStats, { wkBy, dlBy, wsBy, logBy, subBy, phoneBy, goalBy, stepBy, recoveryBy }: Grouped) {
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
    // Primera semana sin entrenar: cada día se le recuerda su primer entreno (en un día de descanso, la próxima sesión,
    // la misma que adelanta /app/entreno). Las cuentas nuevas no tienen entrenos más viejos que la ventana de 61 días.
    const firstWeek = workouts.length === 0 && !!u.created_at && daysBetween(u.created_at.slice(0, 10), c.iso) <= 7;
    const today = planDay(c.dow, 0, sched, { equipment: eq, sex: u.sex });
    const nd = firstWeek && today.tpl === null ? nextTrainingDow(sched, c.dow) : null;
    const plan = nd == null ? today : planDay(nd, 0, sched, { equipment: eq, sex: u.sex });
    const streak = streakOf(active, c.iso).days;
    const userSubs = subBy.get(u.id) ?? [];
    const userPhones = (phoneBy.get(u.id) ?? []).map((t) => ({ token: t.token, platform: t.platform }));

    const decisions = decide({
      now, prefs, mode,
      trainingDay: today.tpl !== null,
      firstWeek,
      trainedToday: workouts.includes(c.iso),
      activeToday: active.has(c.iso),
      streak,
      daysInactive: last ? daysBetween(last, c.iso) : null,
      sentToday: todayLogs.map((l) => l.kind),
      pushesToday: todayLogs.reduce((a, l) => a + (l.pushes ?? 0), 0),
      hasPushSubscription: userSubs.length + userPhones.length > 0,
      hasEmail: true,
    });
    // Secuencia de la prueba: a la hora del recordatorio, una vez por pieza y por cuenta (ONCE_DAY).
    const remindHour = isHHMM(prefs.reminder_time) ? Math.floor(toMinutes(prefs.reminder_time) / 60) : 7;
    const step = mode === "daily" || c.hour === remindHour ? stepBy.get(u.id) ?? null : null;
    const recovery = recoveryBy.get(u.id) ?? null;
    const recoveryNow = recovery && (mode === "daily" || c.hour === remindHour) ? recovery : null;
    if (!decisions.length && !step && !recoveryNow) return;

    let email: string | null | undefined;
    const getEmail = async () => {
      if (email === undefined) { const { data } = await admin.auth.admin.getUserById(u.id); email = data.user?.email ?? null; }
      return email;
    };
    const name = u.full_name || "";
    const voice: Voice = parseVoice(u.lenguaje);
    const goal = goalFor(goalBy.get(u.id), wsBy.get(u.id) ?? []);

    // La pieza reemplaza el correo del recordatorio (o la reactivación) de ese día; push y campanita siguen igual.
    if (step && await sendTrialStep(admin, u.id, step, getEmail, stats)) {
      for (const d of decisions) if (REPLACED_BY_STEP.has(d.kind)) d.email = false;
    }
    // Recuperación: en su ventana de 24 horas no sale ningún otro correo, ni el semanal, aunque la pieza vaya a otra hora.
    // Solo si reclamarla falló siguen los demás (ese día no salió). Push y campanita siguen igual.
    if (recovery && (!recoveryNow || await sendRecovery(admin, u.id, recoveryNow, getEmail, stats))) {
      for (const d of decisions) d.email = false;
    }

    for (const d of decisions) {
      // Reclamar el envío: si otra corrida ya lo hizo hoy, no se repite.
      const { data: claimed, error } = await admin.from("notification_log")
        .upsert({ user_id: u.id, kind: d.kind, local_day: c.iso, channels: channels(d), pushes: d.push ? 1 : 0 }, { onConflict: "user_id,kind,local_day", ignoreDuplicates: true })
        .select("id");
      if (error) { stats.errors++; continue; }
      if (!claimed?.length) continue;

      const weekly = d.kind === "semanal" ? await weeklyData(admin, u, c.iso, workouts, wsBy.get(u.id) ?? [], streak, sched, eq) : null;
      const lift = d.kind === "recordatorio" ? await lastLiftFact(admin, u.id, plan.exercises.map((e) => e.id)) : null;
      const copy = copyFor(d.kind, { name, routine: plan.name, mins: plan.mins, streak, trainingDay: plan.tpl !== null, firstWorkout: firstWeek, voice, hook: plan.hook, lift, workouts: weekly?.workouts, kgDelta: weekly && weekly.kgStart != null && weekly.kgEnd != null ? weekly.kgEnd - weekly.kgStart : null, day: c.iso });

      if (d.inapp) await admin.from("notifications").insert({ user_id: u.id, kind: d.kind, title: copy.title, body: copy.body, url: copy.url });
      if (d.push) stats.push += await sendPush(admin, { web: userSubs, native: userPhones }, { ...copy, tag: d.kind });
      if (d.email) {
        const to = await getEmail();
        if (to) {
          const msg = emailFor(d.kind, { u, name, plan, streak, weekly, goal, fact: lift ? liftLine(voice, lift) : null, first: firstWeek });
          const r = await sendEmail(to, withLoginLinks(msg.email, u.id), { idempotencyKey: `${d.kind}/${u.id}/${c.iso}`, unsubscribe: msg.unsubscribe, tags: { kind: d.kind } });
          if (r.ok) stats.email++;
        }
      }
      stats.sent[d.kind] = (stats.sent[d.kind] ?? 0) + 1;
    }
  }
}

/** Correos del día que la pieza de la prueba reemplaza (el resumen semanal no: es otro aviso que la persona eligió). */
const REPLACED_BY_STEP = new Set<Kind>(["recordatorio", "reactivacion_3", "reactivacion_7", "racha"]);

/** Reclama y envía una pieza de la secuencia. true si se reclamó en esta corrida (aunque el correo fallara). */
async function sendTrialStep(admin: SupabaseClient, userId: string, step: TrialStep, getEmail: () => Promise<string | null>, stats: RunStats): Promise<boolean> {
  const { data: claimed, error } = await admin.from("notification_log")
    .upsert({ user_id: userId, kind: step, local_day: ONCE_DAY, channels: ["email"], pushes: 0 }, { onConflict: "user_id,kind,local_day", ignoreDuplicates: true })
    .select("id");
  if (error) { stats.errors++; return false; }
  if (!claimed?.length) return false;
  const to = await getEmail();
  if (to) {
    const unsubscribe = unsubscribeUrl(userId, "recordatorios");
    const r = await sendEmail(to, withLoginLinks(T.secuenciaPrueba({ day: stepDay(step), unsubscribe }), userId), { idempotencyKey: `${step}/${userId}`, unsubscribe, tags: { kind: step } });
    if (r.ok) stats.email++;
  }
  stats.sent[step] = (stats.sent[step] ?? 0) + 1;
  return true;
}

/** Reclama y envía un correo de recuperación. false solo si reclamarlo falló; true si salió ahora o ya había salido. */
async function sendRecovery(admin: SupabaseClient, userId: string, step: RecoveryStep, getEmail: () => Promise<string | null>, stats: RunStats): Promise<boolean> {
  const { data: claimed, error } = await admin.from("notification_log")
    .upsert({ user_id: userId, kind: step, local_day: ONCE_DAY, channels: ["email"], pushes: 0 }, { onConflict: "user_id,kind,local_day", ignoreDuplicates: true })
    .select("id");
  if (error) { stats.errors++; return false; }
  if (!claimed?.length) return true;
  const to = await getEmail();
  if (to) {
    const unsubscribe = unsubscribeUrl(userId, "recordatorios");
    const r = await sendEmail(to, withLoginLinks(T.recuperacionPrueba({ day: recoveryDay(step), unsubscribe }), userId), { idempotencyKey: recoveryIdemKey(step, userId), unsubscribe, tags: { kind: step } });
    if (r.ok) stats.email++;
  }
  stats.sent[step] = (stats.sent[step] ?? 0) + 1;
  return true;
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

function emailFor(kind: Kind, x: { u: Profile; name: string; plan: ReturnType<typeof planDay>; streak: number; weekly: WeeklyCtx | null; goal: T.Goal | null; fact?: string | null; first?: boolean }) {
  switch (kind) {
    case "semanal": { const unsubscribe = unsubscribeUrl(x.u.id, "semanal"); return { unsubscribe, email: T.resumenSemanal({ name: x.name, ...x.weekly!, goal: x.goal, unsubscribe }) }; }
    case "racha": { const unsubscribe = unsubscribeUrl(x.u.id, "recordatorios"); return { unsubscribe, email: T.rachaEnPeligro({ name: x.name, streak: x.streak, unsubscribe }) }; }
    case "reactivacion_3":
    case "reactivacion_7": { const unsubscribe = unsubscribeUrl(x.u.id, "recordatorios"); return { unsubscribe, email: T.reactivacion({ name: x.name, days: kind === "reactivacion_3" ? 3 : 7, routine: x.plan.name, trainingDay: x.plan.tpl !== null, goal: x.goal, unsubscribe }) }; }
    case "recordatorio":
    default: { const unsubscribe = unsubscribeUrl(x.u.id, "recordatorios"); return { unsubscribe, email: T.recordatorio({ first: x.first, name: x.name, routine: x.plan.name, mins: x.plan.mins, exercises: x.plan.exercises.map((e) => e.name), streak: x.streak, goal: x.goal, unsubscribe, hook: x.plan.hook, fact: x.fact }) }; }
  }
}

// ───────────── Fin de la beta (#109) ─────────────

type BetaProfile = { id: string; created_at: string | null; full_name: string | null; plan: string | null; role: string | null; timezone: string | null };
const SUB_READ = "id,user_id,provider_customer_id,provider_subscription_id,status,price_id,plan,billing,cancel_at_period_end,canceled_at,current_period_start,current_period_end,created_at";

/**
 * Correos del fin de la beta (beta-fin.ts) para las cuentas de la beta sin tarjeta, sin cobro programado y sin plan.
 * No toca cobros: solo lee subscriptions, comp_grants, trial_charges y payment_methods. Cada correo se reclama en
 * notification_log (kind beta_fin_N, local_day = día del correo) antes de enviarse, y Resend recibe una llave por cuenta y
 * correo: nunca sale dos veces. Si falla una lectura, la página se salta (mejor no escribirle a quien quizá ya tiene tarjeta).
 * Exportada para pruebas.
 */
export async function sendBetaEndEmails(admin: SupabaseClient, now: Date, mode: "hourly" | "daily", stats: RunStats, late: () => boolean = () => false) {
  const step = betaEndStep(now);
  if (!step) return;
  const kind = betaEndKind(step), day = betaEndDay(step);
  for (let from = 0; ; from += PAGE) {
    if (late()) { stats.partial = true; break; }
    const { data, error } = await admin.from("profiles").select("id,created_at,full_name,plan,role,timezone")
      .eq("onboarded", true).lt("created_at", BETA_ENDS_AT).order("id").range(from, from + PAGE - 1);
    if (error) { stats.ok = false; stats.errors++; logError("cron:fin-beta", "profiles_query_failed", { code: error.code, from }); break; }
    const profiles = (data ?? []) as BetaProfile[];
    if (!profiles.length) break;
    const ids = profiles.map((p) => p.id);
    const [prefs, subs, comps, charges, cards] = await Promise.all([
      allPages((a, b) => admin.from("notification_prefs").select("user_id,email_reminders,timezone,quiet_start,quiet_end").in("user_id", ids).order("user_id").range(a, b)),
      allPages((a, b) => admin.from("subscriptions").select(SUB_READ).in("user_id", ids).order("id").range(a, b)),
      allPages((a, b) => admin.from("comp_grants").select("user_id,plan,previous_plan,starts_at,expires_at,revoked_at,created_at").in("user_id", ids).order("user_id").order("created_at").range(a, b)),
      allPages((a, b) => admin.from("trial_charges").select("user_id").in("user_id", ids).order("user_id").range(a, b)),
      allPages((a, b) => admin.from("payment_methods").select("user_id").in("user_id", ids).order("user_id").range(a, b)),
    ]);
    const failed = [prefs, subs, comps, charges, cards].find((r) => r.error);
    if (failed) { stats.ok = false; stats.errors++; logError("cron:fin-beta", "query_failed", { code: failed.error?.code }); if (profiles.length < PAGE) break; continue; }
    const prefBy = new Map((prefs.data as { user_id: string; email_reminders: boolean | null; timezone: string | null; quiet_start: string | null; quiet_end: string | null }[]).map((r) => [r.user_id, r]));
    const subsBy = new Map<string, SubscriptionRow[]>(), compsBy = new Map<string, CompRow[]>();
    for (const r of subs.data as SubscriptionRow[]) subsBy.set(r.user_id, [...(subsBy.get(r.user_id) ?? []), r]);
    for (const r of comps.data as (CompRow & { user_id: string })[]) compsBy.set(r.user_id, [...(compsBy.get(r.user_id) ?? []), r]);
    const charged = new Set((charges.data as { user_id: string }[]).map((r) => r.user_id));
    const carded = new Set((cards.data as { user_id: string }[]).map((r) => r.user_id));

    const due = profiles.filter((p) => {
      const pref = prefBy.get(p.id);
      const userSubs = subsBy.get(p.id) ?? [];
      const ent = entitlementsFrom({ profilePlan: p.plan, role: p.role, createdAt: p.created_at, subs: userSubs, comps: compsBy.get(p.id) ?? [], now });
      if (!betaEndEligible({ createdAt: p.created_at, emailReminders: pref?.email_reminders !== false, hasCard: carded.has(p.id), hasCharge: charged.has(p.id), paidAccess: ent.plan !== "free" })) return false;
      // Cada hora (Pro): no se escribe en horas de silencio; la próxima corrida lo toma. Diario: sale en la corrida.
      if (mode === "hourly") {
        const pr = { ...DEFAULT_PREFS, ...(pref ? stripNulls(pref) : {}), timezone: pref?.timezone || p.timezone || DEFAULT_PREFS.timezone } as Prefs;
        if (inQuietHours(localClock(now, pr.timezone), pr.quiet_start, pr.quiet_end)) return false;
      }
      return true;
    });

    await forEachLimit(due, USER_CONCURRENCY, async (p) => {
      if (late()) { stats.partial = true; return; }
      try {
        const { data: claimed, error: claimErr } = await admin.from("notification_log")
          .upsert({ user_id: p.id, kind, local_day: day, channels: ["email"], pushes: 0 }, { onConflict: "user_id,kind,local_day", ignoreDuplicates: true })
          .select("id");
        if (claimErr) { stats.errors++; return; }
        if (!claimed?.length) return;
        const { data: u } = await admin.auth.admin.getUserById(p.id);
        const to = u.user?.email;
        if (!to) return;
        // El 50 % del primer mes, solo si el servidor se lo daría al guardar la tarjeta hoy (trial-billing.ts: promoFor).
        const paidBefore = (subsBy.get(p.id) ?? []).some((s) => Boolean(s.current_period_start));
        const promo = promoFor(kindFor({ createdAt: p.created_at, now }), paidBefore) !== null;
        const unsubscribe = unsubscribeUrl(p.id, "recordatorios");
        const msg = T.finBeta({ name: p.full_name || "", step, promo, unsubscribe });
        const r = await sendEmail(to, withLoginLinks(msg, p.id), { idempotencyKey: betaEndIdemKey(step, p.id), unsubscribe, tags: { kind } });
        if (r.ok) stats.email++;
        stats.sent[kind] = (stats.sent[kind] ?? 0) + 1;
      } catch (e) { stats.errors++; logError("cron:fin-beta", "user_failed", { kind: errCode(e) }); }
    });
    if (stats.partial || profiles.length < PAGE) break;
  }
}
