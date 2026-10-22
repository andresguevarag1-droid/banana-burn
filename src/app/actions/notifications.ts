"use server";
import { createClient, getViewer } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { DEFAULT_PREFS, isHHMM, isValidTimeZone, type Prefs } from "@/lib/notify";
import { isPushConfigured, sendPush, type PushSub } from "@/lib/push";

export type InAppNotification = { id: number; kind: string; title: string; body: string | null; url: string | null; read_at: string | null; created_at: string };

const PREF_KEYS = ["email_reminders", "push_reminders", "reminder_time", "timezone", "weekly_summary", "marketing", "quiet_start", "quiet_end"] as const;

export async function getNotificationPrefs(): Promise<{ prefs: Prefs; demo: boolean; pushConfigured: boolean; vapidPublicKey: string }> {
  const v = await getViewer();
  const base = { pushConfigured: isPushConfigured(), vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || "" };
  if (!v || v.demo) return { prefs: DEFAULT_PREFS, demo: true, ...base };
  const sb = await createClient();
  const { data } = await sb.from("notification_prefs").select(PREF_KEYS.join(",")).eq("user_id", v.id).maybeSingle();
  return { prefs: { ...DEFAULT_PREFS, ...((data as Partial<Prefs> | null) ?? {}) }, demo: false, ...base };
}

export async function saveNotificationPrefs(input: Partial<Prefs>): Promise<{ ok: boolean; demo?: boolean; error?: string }> {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Inicia sesión." };
  const row: Record<string, unknown> = {};
  for (const k of ["email_reminders", "push_reminders", "weekly_summary", "marketing"] as const) if (typeof input[k] === "boolean") row[k] = input[k];
  if (input.reminder_time !== undefined) { if (!isHHMM(input.reminder_time)) return { ok: false, error: "Hora inválida." }; row.reminder_time = input.reminder_time; }
  if (input.timezone !== undefined) { if (typeof input.timezone !== "string" || !isValidTimeZone(input.timezone)) return { ok: false, error: "Zona horaria inválida." }; row.timezone = input.timezone; }
  for (const k of ["quiet_start", "quiet_end"] as const) {
    if (input[k] === undefined) continue;
    if (input[k] !== null && !isHHMM(input[k])) return { ok: false, error: "Horas de silencio inválidas." };
    row[k] = input[k];
  }
  if (v.demo) return { ok: true, demo: true };
  const sb = await createClient();
  const { error } = await sb.from("notification_prefs").upsert({ user_id: v.id, ...row }, { onConflict: "user_id" });
  return error ? { ok: false, error: "No se pudo guardar." } : { ok: true };
}

/** Botón "Probar aviso": manda un push a tus dispositivos y deja un aviso en la campanita. */
export async function sendTestNotification(): Promise<{ ok: boolean; demo?: boolean; push: number; devices: number; error?: string }> {
  const v = await getViewer();
  if (!v) return { ok: false, push: 0, devices: 0, error: "Inicia sesión." };
  if (v.demo) return { ok: true, demo: true, push: 0, devices: 0 };
  const sb = await createClient();
  const title = "¡Así se ven tus avisos! 🍌";
  const body = "Te avisaremos qué te toca entrenar y cuándo tu racha necesita un empujón.";
  await sb.from("notifications").insert({ user_id: v.id, kind: "test", title, body, url: "/app" });
  const { data: subs } = await sb.from("push_subscriptions").select("endpoint,p256dh,auth").eq("user_id", v.id);
  const list = (subs ?? []) as PushSub[];
  const push = await sendPush(adminClient(), list, { title, body, url: "/app", tag: "test" });
  return { ok: true, push, devices: list.length };
}

const DEMO_ITEMS = (): InAppNotification[] => {
  const t = Date.now();
  return [
    { id: 2, kind: "recordatorio", title: "Hoy te toca Empuje A 💪", body: "Unos 55 min y listo. Tus cargas ya están calculadas.", url: "/app/entreno", read_at: null, created_at: new Date(t - 2 * 3600e3).toISOString() },
    { id: 1, kind: "semanal", title: "Tu semana en Banana Burn 📊", body: "5 entrenos · −0.6 kg. Mira lo que viene esta semana.", url: "/app/progreso", read_at: new Date(t - 20 * 3600e3).toISOString(), created_at: new Date(t - 26 * 3600e3).toISOString() },
  ];
};

export async function listNotifications(): Promise<{ items: InAppNotification[]; unread: number; demo?: boolean }> {
  const v = await getViewer();
  if (!v) return { items: [], unread: 0 };
  if (v.demo) { const items = DEMO_ITEMS(); return { items, unread: items.filter((i) => !i.read_at).length, demo: true }; }
  const sb = await createClient();
  const [{ data }, { count }] = await Promise.all([
    sb.from("notifications").select("id,kind,title,body,url,read_at,created_at").eq("user_id", v.id).order("created_at", { ascending: false }).limit(20),
    sb.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", v.id).is("read_at", null),
  ]);
  return { items: (data ?? []) as InAppNotification[], unread: count ?? 0 };
}

/** Marca como leídos los ids dados, o todos si no se pasan. */
export async function markNotificationsRead(ids?: number[]): Promise<{ ok: boolean }> {
  const v = await getViewer();
  if (!v) return { ok: false };
  if (v.demo) return { ok: true };
  const sb = await createClient();
  let q = sb.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", v.id).is("read_at", null);
  if (ids?.length) q = q.in("id", ids.filter((n) => Number.isInteger(n)).slice(0, 100));
  const { error } = await q;
  return { ok: !error };
}
