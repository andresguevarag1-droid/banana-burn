import "server-only";
import { SITE_URL } from "@/lib/env";
import { errCode, logError } from "@/lib/log";
import { signUnsubToken, unsubSecret, type UnsubScope } from "./token";

const DEFAULT_FROM = "Banana Burn <hola@bananaburn.app>";
/**
 * Remitente. Solo se acepta EMAIL_FROM si es del dominio verificado en Resend (bananaburn.app): con otro dominio Resend
 * rechaza cada envío con 403. Pasó en producción: EMAIL_FROM tenía el valor de ejemplo (hola@tudominio.com) y no salía
 * ningún correo (nov 2026).
 */
export function emailFrom(v = process.env.EMAIL_FROM): string {
  const at = /@([a-z0-9.-]+)>?\s*$/i.exec(v?.trim() ?? "");
  return at && at[1].toLowerCase() === "bananaburn.app" ? v!.trim() : DEFAULT_FROM;
}
export const EMAIL_FROM = emailFrom();
export const isEmailConfigured = () => Boolean(process.env.RESEND_API_KEY);

export type EmailMessage = { subject: string; html: string; text: string };
export type SendResult = { ok: boolean; id?: string; skipped?: boolean; error?: string };

/** Enlace de baja firmado. Sin EMAIL_UNSUB_SECRET manda a la sección de avisos del perfil. */
export function unsubscribeUrl(userId: string | undefined, scope: UnsubScope): string {
  const secret = unsubSecret();
  if (!userId || !secret) return `${SITE_URL}/app/perfil#notificaciones`;
  return `${SITE_URL}/api/email/baja?token=${encodeURIComponent(signUnsubToken(userId, scope, secret))}`;
}

/**
 * Envía con la API REST de Resend. Sin RESEND_API_KEY no hace nada (modo demo) y devuelve skipped.
 * `idempotencyKey` evita duplicados si la misma tarea se reintenta (Resend la recuerda 24 h).
 */
export async function sendEmail(to: string, msg: EmailMessage, opts: { idempotencyKey?: string; unsubscribe?: string; tags?: Record<string, string> } = {}): Promise<SendResult> {
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { ok: false, error: "correo inválido" };
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV !== "production") console.info(`[email:demo] -> ${to}: ${msg.subject}`);
    return { ok: false, skipped: true };
  }
  const headers: Record<string, string> = {};
  if (opts.unsubscribe) {
    headers["List-Unsubscribe"] = `<${opts.unsubscribe}>`;
    if (opts.unsubscribe.includes("/api/email/baja")) headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  try {
    const post = () => fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(opts.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey.slice(0, 256) } : {}),
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        headers,
        tags: Object.entries(opts.tags ?? {}).map(([name, value]) => ({ name, value: value.replace(/[^a-zA-Z0-9_-]/g, "_") })),
      }),
      // Sin tiempo límite, un Resend lento dejaría colgado el cron o la acción que manda el correo.
      // Solo se reintenta un 429 (abajo); lo demás lo reintenta la próxima corrida con la misma Idempotency-Key.
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    let res = await post();
    // Resend limita los envíos por segundo: ante 429 se espera y se reintenta una vez (la Idempotency-Key evita duplicados).
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 1100)); res = await post(); }
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) { logError("email", `resend_${res.status}`); return { ok: false, error: `HTTP ${res.status}` }; }
    return { ok: true, id: data.id };
  } catch (e) {
    logError("email", errCode(e) === "TimeoutError" ? "resend_timeout" : "resend_network", { kind: errCode(e) });
    return { ok: false, error: "error de red" };
  }
}
