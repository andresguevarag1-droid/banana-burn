import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { SITE_URL } from "@/lib/env";
import type { EmailMessage } from "./send";

/**
 * Enlaces de un toque para los correos de la app.
 *
 * Casi todos se registran desde el navegador de Instagram o Facebook: la sesión queda ahí. El correo se abre en otro
 * navegador (Gmail, Safari, Chrome) sin sesión, y el botón "Empezar entreno" chocaba con la pantalla de entrar.
 * Este enlace va firmado (HMAC-SHA256), vence en 72 h y sirve una sola vez (public.email_login_uses, 0060).
 * Al abrirlo se ve un botón (no entra solo): los antivirus del correo que abren los enlaces no lo gastan.
 */

export const LOGIN_LINK_TTL_MS = 72 * 3600 * 1000;
const PREFIX = "login-link:v1:";

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const mac = (payload: string, secret: string) => createHmac("sha256", secret).update(PREFIX + payload).digest();

/** Mismo secreto que los enlaces de baja, con otro prefijo (no se puede usar una firma de baja como enlace de entrada). */
export function loginLinkSecret(): string | null {
  return process.env.EMAIL_UNSUB_SECRET || null;
}

export type LoginToken = { userId: string; nonce: string; issuedAt: number };

export function signLoginToken(userId: string, secret: string, now = Date.now(), nonce = b64url(randomBytes(16))): string {
  const payload = b64url(JSON.stringify({ u: userId, n: nonce, t: Math.floor(now / 1000) }));
  return `${payload}.${b64url(mac(payload, secret))}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Verifica firma (tiempo constante) y vigencia. No gasta el enlace: eso lo hace quien inicia la sesión. */
export function verifyLoginToken(token: string | null | undefined, secret: string | null | undefined, now = Date.now()): LoginToken | null {
  if (!token || !secret || token.length > 400) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = mac(payload, secret);
  let given: Buffer;
  try { given = Buffer.from(sig, "base64url"); } catch { return null; }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const o = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { u?: unknown; n?: unknown; t?: unknown };
    if (typeof o.u !== "string" || !UUID.test(o.u) || typeof o.n !== "string" || o.n.length < 16 || o.n.length > 64 || typeof o.t !== "number") return null;
    const issuedAt = o.t * 1000;
    if (issuedAt > now + 5 * 60_000 || now - issuedAt > LOGIN_LINK_TTL_MS) return null;
    return { userId: o.u, nonce: o.n, issuedAt };
  } catch { return null; }
}

/** El enlace que lleva a `next` (ruta de la app) iniciando la sesión. */
export function loginUrl(token: string, next: string, site = SITE_URL): string {
  return `${site}/auth/correo?t=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`;
}

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Cambia los enlaces a la app (SITE_URL/app...) de un correo por enlaces de un toque, todos con el mismo token
 * (el primero que se use inicia la sesión; los demás, ya con sesión, entran directo o piden entrar).
 * Sin secreto o sin usuario, el correo queda igual. Los enlaces de baja (/api/email/...) no se tocan.
 */
export function withLoginLinks(msg: EmailMessage, userId: string | null | undefined, opts: { secret?: string | null; site?: string; now?: number } = {}): EmailMessage {
  const secret = opts.secret === undefined ? loginLinkSecret() : opts.secret;
  const site = opts.site ?? SITE_URL;
  if (!userId || !UUID.test(userId) || !secret) return msg;
  const token = signLoginToken(userId, secret, opts.now);
  // href="https://sitio/app/..." (en HTML el & va escapado) y la misma URL suelta en el texto plano.
  const html = msg.html.replace(new RegExp(`href="${escRe(site)}(/app(?:[/?#][^"]*)?)"`, "g"), (_m, path: string) => {
    const next = path.replace(/&amp;/g, "&");
    return `href="${loginUrl(token, next, site).replace(/&/g, "&amp;")}"`;
  });
  const text = msg.text.replace(new RegExp(`${escRe(site)}(/app(?:[/?#][^\\s)]*)?)`, "g"), (_m, path: string) => loginUrl(token, path, site));
  return { ...msg, html, text };
}
