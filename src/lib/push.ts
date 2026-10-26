import "server-only";
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SITE_URL } from "@/lib/env";
import { errCode, logError } from "@/lib/log";
import { isKnownPushEndpoint, safeNext } from "@/lib/security";
import { sendNative, type NativeToken } from "@/lib/push-native";

export type PushPayload = { title: string; body: string; url?: string; tag?: string };
export type PushSub = { endpoint: string; p256dh: string; auth: string };
export type { NativeToken } from "@/lib/push-native";
/** Dispositivos de una persona: navegadores con Web Push y teléfonos con la app nativa (0057). */
export type Devices = { web: PushSub[]; native: NativeToken[] };
export const hasDevices = (d: Devices | undefined) => Boolean(d && (d.web.length || d.native.length));

const publicKey = () => process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
export const isPushConfigured = () => Boolean(publicKey() && process.env.VAPID_PRIVATE_KEY);

let configured = false;
let broken = false;
function setup() {
  if (configured) return true;
  if (broken || !isPushConfigured()) return false;
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || `mailto:hola@bananaburn.app`, publicKey(), process.env.VAPID_PRIVATE_KEY!);
  } catch (e) {
    // Llaves VAPID mal copiadas: los avisos push se apagan (in-app y correo siguen) en vez de romper el cron.
    broken = true;
    logError("push", "vapid_invalid", { kind: errCode(e) });
    return false;
  }
  configured = true;
  return true;
}

/**
 * Envía un push a cada dispositivo: navegadores (Web Push) y, si vienen, teléfonos con la app (FCM y APNs, push-native.ts).
 * Borra suscripciones y tokens vencidos. Devuelve cuántos llegaron. Sin llaves de un canal, ese canal es no-op.
 */
export async function sendPush(admin: SupabaseClient | null, target: PushSub[] | Devices, payload: PushPayload): Promise<number> {
  const d: Devices = Array.isArray(target) ? { web: target, native: [] } : target;
  const [web, native] = await Promise.all([sendWeb(admin, d.web, payload), sendToApps(admin, d.native, payload)]);
  return web + native;
}

async function sendToApps(admin: SupabaseClient | null, tokens: NativeToken[], payload: PushPayload): Promise<number> {
  if (!tokens.length) return 0;
  const r = await sendNative(tokens, { title: payload.title.slice(0, 120), body: payload.body.slice(0, 240), url: safeNext(payload.url, "/app"), tag: (payload.tag ?? "bb").slice(0, 64) });
  if (admin) {
    if (r.dead.length) await admin.from("native_push_tokens").delete().in("token", r.dead);
    if (r.delivered.length) await admin.from("native_push_tokens").update({ last_used_at: new Date().toISOString() }).in("token", r.delivered);
  }
  return r.delivered.length;
}

/**
 * Dispositivos de varias personas en dos lecturas (service_role). Si la tabla de la app nativa aún no existe (0057 sin
 * aplicar), se sigue solo con Web Push.
 */
export async function loadDevices(admin: SupabaseClient, userIds: string[]): Promise<Map<string, Devices>> {
  const out = new Map<string, Devices>();
  if (!userIds.length) return out;
  const [web, native] = await Promise.all([
    admin.from("push_subscriptions").select("user_id,endpoint,p256dh,auth").in("user_id", userIds),
    admin.from("native_push_tokens").select("user_id,token,platform").in("user_id", userIds),
  ]);
  const of = (id: string) => { let d = out.get(id); if (!d) { d = { web: [], native: [] }; out.set(id, d); } return d; };
  for (const s of (web.data ?? []) as (PushSub & { user_id: string })[]) of(s.user_id).web.push({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth });
  for (const t of (native.error ? [] : native.data ?? []) as (NativeToken & { user_id: string })[]) of(t.user_id).native.push({ token: t.token, platform: t.platform });
  return out;
}

/** Push a una persona (todos sus dispositivos). Devuelve cuántos llegaron. */
export async function pushToUser(admin: SupabaseClient, userId: string, payload: PushPayload): Promise<number> {
  const d = (await loadDevices(admin, [userId])).get(userId);
  return hasDevices(d) ? sendPush(admin, d!, payload) : 0;
}

async function sendWeb(admin: SupabaseClient | null, allSubs: PushSub[], payload: PushPayload): Promise<number> {
  // Filas viejas (antes del CHECK de 0012) podrían tener endpoints arbitrarios: nunca hacemos POST fuera de los servicios de push.
  const subs = allSubs.filter((s) => isKnownPushEndpoint(s.endpoint));
  if (!subs.length || !setup()) return 0;
  const body = JSON.stringify({
    title: payload.title.slice(0, 120),
    body: payload.body.slice(0, 240),
    url: safeNext(payload.url, "/app"),
    tag: payload.tag ?? "bb",
    icon: `${SITE_URL}/icons/icon-192.png`,
  });
  let delivered = 0;
  const dead: string[] = [];
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 * 6, urgency: "normal", timeout: 8_000 });
      delivered++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) dead.push(s.endpoint);
      else logError("push", "send_failed", { kind: errCode(e) });
    }
  }));
  if (admin) {
    if (dead.length) await admin.from("push_subscriptions").delete().in("endpoint", dead);
    if (delivered) await admin.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).in("endpoint", subs.map((s) => s.endpoint).filter((e) => !dead.includes(e)));
  }
  return delivered;
}
