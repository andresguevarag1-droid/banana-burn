import "server-only";
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SITE_URL } from "@/lib/env";
import { isKnownPushEndpoint, safeNext } from "@/lib/security";

export type PushPayload = { title: string; body: string; url?: string; tag?: string };
export type PushSub = { endpoint: string; p256dh: string; auth: string };

const publicKey = () => process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
export const isPushConfigured = () => Boolean(publicKey() && process.env.VAPID_PRIVATE_KEY);

let configured = false;
function setup() {
  if (configured || !isPushConfigured()) return isPushConfigured();
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || `mailto:hola@bananaburn.app`, publicKey(), process.env.VAPID_PRIVATE_KEY!);
  configured = true;
  return true;
}

/** Envía un push a cada dispositivo. Borra suscripciones vencidas (404/410). Devuelve cuántos llegaron. Sin VAPID: no-op. */
export async function sendPush(admin: SupabaseClient | null, allSubs: PushSub[], payload: PushPayload): Promise<number> {
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
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 * 6, urgency: "normal" });
      delivered++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) dead.push(s.endpoint);
    }
  }));
  if (admin) {
    if (dead.length) await admin.from("push_subscriptions").delete().in("endpoint", dead);
    if (delivered) await admin.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).in("endpoint", subs.map((s) => s.endpoint).filter((e) => !dead.includes(e)));
  }
  return delivered;
}
