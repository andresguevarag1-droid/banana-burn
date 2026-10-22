import { createHmac, timingSafeEqual } from "node:crypto";

/** Qué se da de baja con el enlace. "recordatorios" cubre recordatorio, racha y reactivación. */
export type UnsubScope = "recordatorios" | "semanal" | "marketing" | "todo";
export const UNSUB_SCOPES: UnsubScope[] = ["recordatorios", "semanal", "marketing", "todo"];

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const mac = (data: string, secret: string) => createHmac("sha256", secret).update(data).digest();

export function unsubSecret(): string | null {
  return process.env.EMAIL_UNSUB_SECRET || null;
}

/** Token firmado (HMAC-SHA256) `payload.firma`, ambos en base64url. Sin expiración: una baja debe funcionar siempre. */
export function signUnsubToken(userId: string, scope: UnsubScope, secret: string): string {
  const payload = b64url(JSON.stringify({ u: userId, s: scope, v: 1 }));
  return `${payload}.${b64url(mac(payload, secret))}`;
}

export function verifyUnsubToken(token: string | null | undefined, secret: string | null | undefined): { userId: string; scope: UnsubScope } | null {
  if (!token || !secret || token.length > 512) return null;
  const [payload, sig, extra] = token.split(".");
  if (!payload || !sig || extra !== undefined) return null;
  const expected = mac(payload, secret);
  let given: Buffer;
  try { given = Buffer.from(sig, "base64url"); } catch { return null; }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { u?: unknown; s?: unknown };
    if (typeof data.u !== "string" || !/^[0-9a-f-]{36}$/i.test(data.u)) return null;
    if (!UNSUB_SCOPES.includes(data.s as UnsubScope)) return null;
    return { userId: data.u, scope: data.s as UnsubScope };
  } catch { return null; }
}
