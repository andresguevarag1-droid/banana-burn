"use server";
import { dashboard, getAthlete } from "@/lib/athlete";
import { createClient, getViewer } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { DEFAULT_PREFS, cronModeFrom, isHHMM, isValidTimeZone, type Prefs } from "@/lib/notify";
import { isEmailConfigured } from "@/lib/email/send";
import { isPushConfigured, sendPush, type PushSub } from "@/lib/push";

export type InAppNotification = { id: number; kind: string; title: string; body: string | null; url: string | null; read_at: string | null; created_at: string };

const PREF_KEYS = ["email_reminders", "push_reminders", "reminder_time", "timezone", "weekly_summary", "marketing", "quiet_start", "quiet_end"] as const;

export type NotificationPrefsData = {
  prefs: Prefs; demo: boolean; pushConfigured: boolean; vapidPublicKey: string;
  /** "hourly" = el cron corre cada hora (hora del recordatorio, racha 8 p. m. y silencio funcionan); "daily" = una vez al día. */
  cronMode: "hourly" | "daily";
  /** Hay proveedor de correo (RESEND_API_KEY): si no, no se ofrecen avisos por correo. */
  emailConfigured: boolean;
};

export async function getNotificationPrefs(): Promise<NotificationPrefsData> {
  const v = await getViewer();
  const base = { pushConfigured: isPushConfigured(), vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || "", cronMode: cronModeFrom(process.env.NOTIFY_CRON_MODE), emailConfigured: isEmailConfigured() };
  if (!v || v.demo) return { prefs: DEFAULT_PREFS, demo: true, ...base };
  const sb = await createClient();
  const { data, error } = await sb.from("notification_prefs").select(PREF_KEYS.join(",")).eq("user_id", v.id).maybeSingle();
  if (error) throw new Error("No pudimos cargar tus avisos.");
  return { prefs: { ...DEFAULT_PREFS, ...(data as Partial<Prefs> | null) }, demo: false, ...base };
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
  return error ? { ok: false, error: "No pudimos guardar tus avisos. Intenta de nuevo." } : { ok: true };
}

/** Espera mínima entre avisos de prueba (también hay tope de 10 por hora en la BD). */
const TEST_COOLDOWN_S = 60;

/** Botón "Probar aviso": manda un push a tus dispositivos y deja un aviso en la campanita. Máximo 1 por minuto. */
export async function sendTestNotification(): Promise<{ ok: boolean; demo?: boolean; push: number; devices: number; error?: string; retryIn?: number }> {
  const v = await getViewer();
  if (!v) return { ok: false, push: 0, devices: 0, error: "Inicia sesión." };
  if (v.demo) return { ok: true, demo: true, push: 0, devices: 0, retryIn: TEST_COOLDOWN_S };
  const sb = await createClient();
  const { data: last } = await sb.from("notifications").select("created_at").eq("user_id", v.id).eq("kind", "test").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const wait = last ? Math.ceil(TEST_COOLDOWN_S - (Date.now() - Date.parse(last.created_at as string)) / 1000) : 0;
  if (wait > 0) return { ok: false, push: 0, devices: 0, error: `Espera ${wait} s para probar de nuevo.`, retryIn: wait };
  const title = "Así se ven tus avisos de Banana Burn";
  const body = "Te avisaremos qué te toca entrenar y cuándo tu racha necesita un empujón.";
  const ins = await sb.from("notifications").insert({ user_id: v.id, kind: "test", title, body, url: "/app" });
  if (ins.error) return { ok: false, push: 0, devices: 0, error: /Demasiadas/.test(ins.error.message) ? "Ya probaste varias veces. Intenta en una hora." : "No pudimos enviar el aviso de prueba. Intenta de nuevo.", retryIn: TEST_COOLDOWN_S };
  const { data: subs } = await sb.from("push_subscriptions").select("endpoint,p256dh,auth").eq("user_id", v.id);
  const list = (subs ?? []) as PushSub[];
  const push = await sendPush(adminClient(), list, { title, body, url: "/app", tag: "test" });
  return { ok: true, push, devices: list.length, retryIn: TEST_COOLDOWN_S };
}

const DEMO_ITEMS = async (): Promise<InAppNotification[]> => {
  const t = Date.now();
  const v = await getViewer();
  const d = dashboard(await getAthlete(v!));
  const today = d.plan.tpl ? { title: `Hoy te toca ${d.plan.name}`, body: `Unos ${d.plan.mins ?? 45} min y listo. Tus cargas ya están calculadas.` } : { title: "Hoy toca descanso activo", body: "Camina y estira. Mañana volvemos con todo." };
  return [
    { id: 2, kind: "recordatorio", ...today, url: d.plan.tpl ? "/app/entreno" : "/app", read_at: null, created_at: new Date(t - 2 * 3600e3).toISOString() },
    { id: 1, kind: "semanal", title: "Tu semana en Banana Burn", body: "5 entrenos y −0.6 kg. Mira lo que viene esta semana.", url: "/app/progreso", read_at: new Date(t - 20 * 3600e3).toISOString(), created_at: new Date(t - 26 * 3600e3).toISOString() },
    { id: 3, kind: "perfil_nivel", title: "Tu perfil subió a Cosecha", body: "Tu perfil ahora se ve como Cosecha en la comunidad. Mira lo que desbloqueaste.", url: "/app/perfil#poder", read_at: new Date(t - 8 * 3600e3).toISOString(), created_at: new Date(t - 12 * 24 * 3600e3).toISOString() },
  ];
};

export async function listNotifications(): Promise<{ items: InAppNotification[]; unread: number; demo?: boolean }> {
  const v = await getViewer();
  if (!v) return { items: [], unread: 0 };
  if (v.demo) { const items = await DEMO_ITEMS(); return { items, unread: items.filter((i) => !i.read_at).length, demo: true }; }
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
