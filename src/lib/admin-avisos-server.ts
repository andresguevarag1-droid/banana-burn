// Despachador de avisos al dueño (0059). Lee la bandeja admin_events con service_role y manda push, aviso en la app y
// correo según las preferencias de cada superadmin. Nunca lanza: un aviso fallido no puede romper un registro ni un cobro.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/supabase/admin";
import { errCode, logError } from "@/lib/log";
import { hasDevices, loadDevices, sendPush } from "@/lib/push";
import { sendEmail } from "@/lib/email/send";
import { avisoAdmin } from "@/lib/email/templates";
import { alertText, channelsFor, firstName, normalizePrefs, summarize, summaryText, type AdminEvent, type AlertKind, type Person, type Prefs } from "@/lib/admin-avisos";

type Admin = { id: string; prefs: Prefs };

/** Deja un hecho en la bandeja (idempotente por clave). Para el servidor; las tablas usan sus disparadores. */
export async function enqueueAdminEvent(db: SupabaseClient | null, e: { key: string; kind: AlertKind | "sistema"; userId: string | null; amountMinor?: number | null; currency?: string | null; data?: Record<string, unknown> }): Promise<void> {
  const sb = db ?? adminClient();
  if (!sb) return;
  try {
    await sb.rpc("admin_event_enqueue", { p_key: e.key, p_kind: e.kind, p_user: e.userId, p_amount: e.amountMinor ?? null, p_currency: e.currency ?? null, p_data: e.data ?? {} });
  } catch (err) {
    logError("avisos", "enqueue_failed", { kind: errCode(err) });
  }
}

/** Despierta al despachador sin hacer esperar a quien produjo el hecho (después de responder, si se puede). */
export async function kickAdminDispatch(): Promise<void> {
  try {
    const { after } = await import("next/server");
    after(() => dispatchAdminEvents().then(() => undefined, () => undefined));
  } catch {
    // Fuera de una petición (pruebas, scripts): en el momento.
    await dispatchAdminEvents().catch(() => undefined);
  }
}

async function loadAdmins(db: SupabaseClient): Promise<Admin[]> {
  const { data } = await db.from("profiles").select("id").eq("role", "superadmin").limit(20);
  const ids = (data ?? []).map((r) => r.id as string);
  if (!ids.length) return [];
  const { data: prefs } = await db.from("admin_notify_prefs").select("user_id,push,email,email_mode,in_app,daily_summary,kinds").in("user_id", ids);
  const byId = new Map((prefs ?? []).map((p) => [p.user_id as string, p]));
  return ids.map((id) => ({ id, prefs: normalizePrefs(byId.get(id) as Partial<Prefs> | undefined) }));
}

async function loadPeople(db: SupabaseClient, ids: string[]): Promise<Map<string, Person>> {
  const out = new Map<string, Person>();
  if (!ids.length) return out;
  const { data } = await db.from("profiles").select("id,full_name,country").in("id", ids);
  for (const r of data ?? []) out.set(r.id as string, { firstName: firstName(r.full_name as string | null), country: (r.country as string | null) ?? null });
  return out;
}

const emailCache = new Map<string, string>();
async function adminEmail(db: SupabaseClient, id: string): Promise<string | null> {
  if (emailCache.has(id)) return emailCache.get(id)!;
  const { data } = await db.auth.admin.getUserById(id);
  const e = data.user?.email ?? null;
  if (e) emailCache.set(id, e);
  return e;
}

export type DispatchResult = { events: number; push: number; inApp: number; email: number };

/**
 * Reclama los avisos pendientes (cada uno una sola vez, aunque corran dos despachadores) y los manda.
 * Los avisos de más de 2 días sin mandar se dan por perdidos: un push viejo ya no sirve.
 */
export async function dispatchAdminEvents(opts: { db?: SupabaseClient | null; limit?: number } = {}): Promise<DispatchResult> {
  const res: DispatchResult = { events: 0, push: 0, inApp: 0, email: 0 };
  const db = opts.db ?? adminClient();
  if (!db) return res;
  try {
    const since = new Date(Date.now() - 2 * 86400_000).toISOString();
    const stale = new Date(Date.now() - 5 * 60_000).toISOString();
    const { data: pending } = await db.from("admin_events").select("id").is("dispatched_at", null).gte("created_at", since)
      .or(`claimed_at.is.null,claimed_at.lt.${stale}`).order("created_at", { ascending: true }).limit(opts.limit ?? 40);
    const ids = (pending ?? []).map((r) => r.id as number);
    if (!ids.length) return res;
    const now = new Date().toISOString();
    const { data: claimed } = await db.from("admin_events").update({ claimed_at: now }).in("id", ids).is("dispatched_at", null)
      .or(`claimed_at.is.null,claimed_at.lt.${stale}`).select("id,event_key,kind,user_id,amount_minor,currency,data,created_at");
    const events = (claimed ?? []) as AdminEvent[];
    if (!events.length) return res;
    const admins = await loadAdmins(db);
    const people = await loadPeople(db, [...new Set(events.map((e) => e.user_id).filter((x): x is string => !!x))]);
    const devices = await loadDevices(db, admins.filter((a) => a.prefs.push).map((a) => a.id));
    for (const e of events) {
      res.events++;
      const t = alertText(e, e.user_id ? people.get(e.user_id) ?? null : null);
      let pushes = 0, emailed = false, err: string | null = null;
      for (const a of admins) {
        const ch = channelsFor(e.kind, a.prefs);
        try {
          const d = devices.get(a.id);
          if (ch.push && hasDevices(d)) { const n = await sendPush(db, d!, { title: t.title, body: t.body, url: t.url, tag: `aviso-${e.id}` }); pushes += n; res.push += n; }
          if (ch.inApp) {
            const { error } = await db.from("notifications").insert({ user_id: a.id, kind: "aviso_admin", title: t.title.slice(0, 120), body: t.body.slice(0, 300), url: t.url });
            if (!error) res.inApp++;
          }
          if (ch.email) {
            const to = await adminEmail(db, a.id);
            if (to) {
              const r = await sendEmail(to, avisoAdmin({ title: t.title, body: t.body, url: t.url }), { idempotencyKey: `aviso/${e.event_key}/${a.id}`, tags: { kind: "aviso_admin" } });
              if (r.ok) { emailed = true; res.email++; }
            }
          }
        } catch (x) {
          err = errCode(x);
        }
      }
      await db.from("admin_events").update({ dispatched_at: new Date().toISOString(), push_sent: pushes, email_sent: emailed, error: err }).eq("id", e.id);
    }
  } catch (x) {
    logError("avisos", "dispatch_failed", { kind: errCode(x) });
  }
  return res;
}

/** Día de Costa Rica (UTC-6, sin horario de verano) que termina en `now`: de medianoche a medianoche. */
export function crDayRange(now = new Date()): { start: string; end: string; label: string } {
  const cr = new Date(now.getTime() - 6 * 3600_000);
  const y = cr.getUTCFullYear(), m = cr.getUTCMonth(), d = cr.getUTCDate();
  const start = new Date(Date.UTC(y, m, d, 6));
  const end = new Date(start.getTime() + 86400_000);
  return { start: start.toISOString(), end: end.toISOString(), label: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` };
}

/** Primeros entrenos del rango: personas cuyo primer entreno terminado cae en el día. */
async function firstWorkouts(db: SupabaseClient, start: string, end: string): Promise<number> {
  const { data } = await db.from("workouts").select("user_id").gte("finished_at", start).lt("finished_at", end).limit(2000);
  const ids = [...new Set((data ?? []).map((r) => r.user_id as string))];
  if (!ids.length) return 0;
  const { data: before } = await db.from("workouts").select("user_id").in("user_id", ids).lt("finished_at", start).limit(5000);
  const old = new Set((before ?? []).map((r) => r.user_id as string));
  return ids.filter((id) => !old.has(id)).length;
}

/**
 * Resumen del día (20:00 de Costa Rica, cron diario). Push y aviso en la app a quien lo tenga encendido; correo a quien
 * eligió correo (en modo resumen o instante). Idempotente por día y persona.
 */
export async function sendDailySummary(now = new Date(), dbIn?: SupabaseClient | null): Promise<{ sent: number; skipped?: string }> {
  const db = dbIn ?? adminClient();
  if (!db) return { sent: 0, skipped: "sin base" };
  // El cron corre a las 02:00 UTC (20:00 en Costa Rica): el día que se resume es el que acaba de pasar en Costa Rica.
  const { start, end, label } = crDayRange(new Date(now.getTime() - 60_000));
  const [{ data: evs }, first] = await Promise.all([
    db.from("admin_events").select("kind,amount_minor,currency").gte("created_at", start).lt("created_at", end).limit(5000),
    firstWorkouts(db, start, end).catch(() => 0),
  ]);
  const s = summarize((evs ?? []) as Pick<AdminEvent, "kind" | "amount_minor" | "currency">[], first);
  const t = summaryText(s);
  const admins = (await loadAdmins(db)).filter((a) => a.prefs.daily_summary);
  const devices = await loadDevices(db, admins.filter((a) => a.prefs.push).map((a) => a.id));
  let sent = 0;
  for (const a of admins) {
    const key = `resumen:${label}:${a.id}`;
    // Una vez por día y persona, aunque el cron se repita.
    const { data: once } = await db.from("notification_log").upsert({ user_id: a.id, kind: "aviso_admin_resumen", local_day: label, channels: ["push"] }, { onConflict: "user_id,kind,local_day", ignoreDuplicates: true }).select("id");
    if (!once?.length) continue;
    const d = devices.get(a.id);
    if (a.prefs.push && hasDevices(d)) await sendPush(db, d!, { title: t.title, body: t.body, url: "/admin", tag: `resumen-${label}` }).catch(() => 0);
    if (a.prefs.in_app) await db.from("notifications").insert({ user_id: a.id, kind: "aviso_admin", title: t.title.slice(0, 120), body: t.body.slice(0, 300), url: "/admin" });
    if (a.prefs.email) {
      const to = await adminEmail(db, a.id);
      if (to) await sendEmail(to, avisoAdmin({ title: t.title, body: t.body, url: "/admin", eyebrow: "Resumen del día" }), { idempotencyKey: key, tags: { kind: "aviso_admin_resumen" } });
    }
    sent++;
  }
  return { sent };
}
