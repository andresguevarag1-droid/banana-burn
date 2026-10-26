import "server-only";
import { sign as cryptoSign } from "node:crypto";
import http2 from "node:http2";
import { clean } from "@/lib/env";
import { errCode, logError } from "@/lib/log";

// Avisos push de la app nativa (0057): Android por Firebase Cloud Messaging (API HTTP v1) e iPhone por APNs (HTTP/2),
// cada uno con su JWT firmado aquí con node:crypto (sin dependencias). Sin variables de entorno no se manda nada.
// Lo usa sendPush (push.ts) junto con Web Push, así todos los avisos que ya existen llegan también a la app.
//
// Variables (solo servidor, .env.example):
//   FCM_SERVICE_ACCOUNT_JSON  cuenta de servicio de Firebase (JSON o el JSON en base64)
//   APNS_KEY_ID, APNS_TEAM_ID (o APPLE_TEAM_ID), APNS_PRIVATE_KEY (.p8), APNS_ENV (production | sandbox | auto)

export type NativeToken = { token: string; platform: "ios" | "android" };
export type NativePayload = { title: string; body: string; url: string; tag: string };
export type NativeResult = { delivered: string[]; dead: string[] };

const APP_ID = "app.bananaburn";

/* ---------- Configuración ---------- */

type ServiceAccount = { project_id: string; client_email: string; private_key: string };

export function serviceAccountFrom(raw: string | undefined): ServiceAccount | null {
  const v = clean(raw);
  if (!v) return null;
  const parse = (s: string) => { try { return JSON.parse(s) as Partial<ServiceAccount>; } catch { return null; } };
  const j = parse(v) ?? parse(Buffer.from(v, "base64").toString("utf8"));
  if (!j?.project_id || !j.client_email || !j.private_key?.includes("PRIVATE KEY")) return null;
  return { project_id: j.project_id, client_email: j.client_email, private_key: j.private_key.replace(/\\n/g, "\n") };
}

type ApnsConfig = { keyId: string; teamId: string; key: string; mode: "production" | "sandbox" | "auto" };

export function apnsConfigFrom(env: Record<string, string | undefined>): ApnsConfig | null {
  const keyId = clean(env.APNS_KEY_ID), teamId = clean(env.APNS_TEAM_ID) || clean(env.APPLE_TEAM_ID);
  const key = clean(env.APNS_PRIVATE_KEY).replace(/\\n/g, "\n");
  if (!/^[A-Z0-9]{10}$/.test(keyId) || !/^[A-Z0-9]{10}$/.test(teamId) || !key.includes("PRIVATE KEY")) return null;
  const m = clean(env.APNS_ENV).toLowerCase();
  return { keyId, teamId, key, mode: m === "sandbox" || m === "auto" ? m : "production" };
}

export const isNativePushConfigured = () => Boolean(serviceAccountFrom(process.env.FCM_SERVICE_ACCOUNT_JSON) || apnsConfigFrom(process.env));

/* ---------- Mensajes (puros, probados en push-native.test.ts) ---------- */

/** FCM v1. Canal "avisos" (lo crea la app al registrarse) y la llama como ícono. `data` lleva la ruta que abre el toque. */
export function fcmMessage(token: string, p: NativePayload) {
  return {
    message: {
      token,
      notification: { title: p.title, body: p.body },
      data: { url: p.url, tag: p.tag },
      android: { priority: "HIGH", ttl: "21600s", collapse_key: p.tag, notification: { channel_id: "avisos", icon: "ic_stat_bananaburn", color: "#F2A100", tag: p.tag } },
    },
  };
}

/** APNs: alerta con sonido; `thread-id` agrupa por tipo y `url` es la ruta que abre el toque. */
export function apnsBody(p: NativePayload) {
  return { aps: { alert: { title: p.title, body: p.body }, sound: "default", "thread-id": p.tag }, url: p.url };
}

/** ¿El token ya no sirve (app desinstalada, token cambiado)? Se borra para no volver a intentarlo. */
export function fcmTokenDead(status: number, body: string): boolean {
  return status === 404 || (status === 400 && /INVALID_ARGUMENT|registration token|UNREGISTERED/i.test(body));
}
export function apnsTokenDead(status: number, reason: string): boolean {
  return status === 410 || (status === 400 && /BadDeviceToken|DeviceTokenNotForTopic/.test(reason));
}

/* ---------- JWT ---------- */

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");
export function jwt(header: object, claims: object, key: string, alg: "RS256" | "ES256") {
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const sig = alg === "RS256"
    ? cryptoSign("sha256", Buffer.from(input), key)
    : cryptoSign("sha256", Buffer.from(input), { key, dsaEncoding: "ieee-p1363" });
  return `${input}.${b64url(sig)}`;
}

/* ---------- Android: FCM HTTP v1 ---------- */

let fcmToken: { value: string; exp: number } | null = null;
async function fcmAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (fcmToken && fcmToken.exp - 300 > now) return fcmToken.value;
  const assertion = jwt({ alg: "RS256", typ: "JWT" }, {
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  }, sa.private_key, "RS256");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }), signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw Object.assign(new Error("fcm_auth"), { code: `fcm_auth_${res.status}` });
  const j = (await res.json()) as { access_token: string; expires_in: number };
  fcmToken = { value: j.access_token, exp: now + (j.expires_in || 3600) };
  return fcmToken.value;
}

async function sendAndroid(tokens: string[], p: NativePayload, out: NativeResult) {
  const sa = serviceAccountFrom(process.env.FCM_SERVICE_ACCOUNT_JSON);
  if (!sa || !tokens.length) return;
  const access = await fcmAccessToken(sa);
  const url = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(sa.project_id)}/messages:send`;
  await Promise.all(tokens.map(async (t) => {
    try {
      const res = await fetch(url, {
        method: "POST", headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
        body: JSON.stringify(fcmMessage(t, p)), signal: AbortSignal.timeout(8_000),
      });
      if (res.ok) out.delivered.push(t);
      else if (fcmTokenDead(res.status, await res.text().catch(() => ""))) out.dead.push(t);
      else logError("push", "fcm_failed", { kind: `http_${res.status}` });
    } catch (e) {
      logError("push", "fcm_failed", { kind: errCode(e) });
    }
  }));
}

/* ---------- iPhone: APNs por HTTP/2 ---------- */

let apnsJwt: { value: string; at: number } | null = null;
function apnsAuth(c: ApnsConfig) {
  const now = Math.floor(Date.now() / 1000);
  // Apple pide renovarlo entre 20 y 60 minutos.
  if (!apnsJwt || now - apnsJwt.at > 40 * 60) apnsJwt = { value: jwt({ alg: "ES256", kid: c.keyId }, { iss: c.teamId, iat: now }, c.key, "ES256"), at: now };
  return apnsJwt.value;
}

const APNS_HOST = { production: "https://api.push.apple.com", sandbox: "https://api.sandbox.push.apple.com" } as const;

function apnsRequest(session: http2.ClientHttp2Session, token: string, auth: string, p: NativePayload): Promise<{ status: number; reason: string }> {
  return new Promise((resolve) => {
    const req = session.request({
      ":method": "POST", ":path": `/3/device/${token}`, authorization: `bearer ${auth}`,
      "apns-topic": APP_ID, "apns-push-type": "alert", "apns-priority": "10",
      "apns-expiration": String(Math.floor(Date.now() / 1000) + 6 * 3600), "apns-collapse-id": p.tag.slice(0, 64),
    });
    let status = 0, data = "";
    const timer = setTimeout(() => { req.close(); resolve({ status: 0, reason: "timeout" }); }, 8_000);
    req.on("response", (h) => { status = Number(h[":status"] ?? 0); });
    req.setEncoding("utf8");
    req.on("data", (c: string) => { data += c; });
    req.on("end", () => { clearTimeout(timer); let reason = ""; try { reason = (JSON.parse(data) as { reason?: string }).reason ?? ""; } catch { /* sin cuerpo: 200 */ } resolve({ status, reason }); });
    req.on("error", () => { clearTimeout(timer); resolve({ status: 0, reason: "error" }); });
    req.end(JSON.stringify(apnsBody(p)));
  });
}

async function sendIos(tokens: string[], p: NativePayload, out: NativeResult) {
  const c = apnsConfigFrom(process.env);
  if (!c || !tokens.length) return;
  const auth = apnsAuth(c);
  const sessions = new Map<string, http2.ClientHttp2Session>();
  const session = (host: string) => {
    let s = sessions.get(host);
    if (!s) { s = http2.connect(host); s.on("error", () => {}); sessions.set(host, s); }
    return s;
  };
  try {
    await Promise.all(tokens.map(async (t) => {
      // "auto": producción primero; si el token es de una build de desarrollo (Xcode), Apple responde BadDeviceToken y se
      // intenta en sandbox. Así sirve el mismo servidor para TestFlight, la tienda y las pruebas.
      const first = c.mode === "sandbox" ? "sandbox" : "production";
      let r = await apnsRequest(session(APNS_HOST[first]), t, auth, p);
      if (c.mode === "auto" && r.status === 400 && r.reason === "BadDeviceToken") r = await apnsRequest(session(APNS_HOST.sandbox), t, auth, p);
      if (r.status === 200) out.delivered.push(t);
      else if (apnsTokenDead(r.status, r.reason)) out.dead.push(t);
      else logError("push", "apns_failed", { kind: r.reason || `http_${r.status}` });
    }));
  } finally {
    for (const s of sessions.values()) s.close();
  }
}

/** Manda el aviso a cada teléfono. Devuelve los tokens que llegaron y los que hay que borrar. Nunca lanza. */
export async function sendNative(tokens: NativeToken[], p: NativePayload): Promise<NativeResult> {
  const out: NativeResult = { delivered: [], dead: [] };
  const android = tokens.filter((t) => t.platform === "android").map((t) => t.token);
  const ios = tokens.filter((t) => t.platform === "ios").map((t) => t.token);
  await Promise.all([
    sendAndroid(android, p, out).catch((e) => logError("push", "fcm_failed", { kind: errCode(e) })),
    sendIos(ios, p, out).catch((e) => logError("push", "apns_failed", { kind: errCode(e) })),
  ]);
  return out;
}
