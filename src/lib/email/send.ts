import "server-only";
import { SITE_URL } from "@/lib/env";
import { signUnsubToken, unsubSecret, type UnsubScope } from "./token";

export const EMAIL_FROM = process.env.EMAIL_FROM || "Banana Burn <hola@bananaburn.app>";
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
    const res = await fetch("https://api.resend.com/emails", {
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
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) return { ok: false, error: data.message ?? `HTTP ${res.status}` };
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "error de red" };
  }
}
