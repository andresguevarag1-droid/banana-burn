import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/** Qué se da de baja con el enlace. "recordatorios" cubre recordatorio, racha y reactivación. */
export type UnsubScope = "recordatorios" | "semanal" | "marketing" | "todo";
export const UNSUB_SCOPES: UnsubScope[] = ["recordatorios", "semanal", "marketing", "todo"];

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const mac = (data: string, secret: string) => createHmac("sha256", secret).update(data).digest();

export function unsubSecret(): string | null {
  return process.env.EMAIL_UNSUB_SECRET || null;
}

/** Darse de baja funciona con enlaces de hasta ~13 meses (correos viejos); volver a suscribirse exige un enlace reciente. */
export const UNSUB_MAX_AGE_MS = 400 * 864e5;
export const RESUB_MAX_AGE_MS = 30 * 864e5;

/** Token firmado (HMAC-SHA256) `payload.firma`, ambos en base64url, con fecha de emisión `t` (segundos). */
export function signUnsubToken(userId: string, scope: UnsubScope, secret: string, now = Date.now()): string {
  const payload = b64url(JSON.stringify({ u: userId, s: scope, v: 2, t: Math.floor(now / 1000) }));
  return `${payload}.${b64url(mac(payload, secret))}`;
}

/**
 * Verifica firma (tiempo constante) y vigencia. `maxAgeMs` limita la antigüedad; los tokens v1 (sin fecha, emitidos antes
 * de 0012) solo valen cuando no se pide antigüedad máxima estricta (`requireIssuedAt` false), es decir, para darse de baja.
 */
export function verifyUnsubToken(
  token: string | null | undefined, secret: string | null | undefined,
  opts: { maxAgeMs?: number; requireIssuedAt?: boolean; now?: number } = {},
): { userId: string; scope: UnsubScope; issuedAt: number | null } | null {
  if (!token || !secret || token.length > 512) return null;
  const [payload, sig, extra] = token.split(".");
  if (!payload || !sig || extra !== undefined) return null;
  const expected = mac(payload, secret);
  let given: Buffer;
  try { given = Buffer.from(sig, "base64url"); } catch { return null; }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { u?: unknown; s?: unknown; t?: unknown };
    if (typeof data.u !== "string" || !/^[0-9a-f-]{36}$/i.test(data.u)) return null;
    if (!UNSUB_SCOPES.includes(data.s as UnsubScope)) return null;
    const issuedAt = typeof data.t === "number" && Number.isFinite(data.t) ? data.t * 1000 : null;
    const now = opts.now ?? Date.now();
    if (issuedAt === null && opts.requireIssuedAt) return null;
    if (issuedAt !== null && issuedAt > now + 5 * 60_000) return null; // emitido "en el futuro"
    if (issuedAt !== null && opts.maxAgeMs !== undefined && now - issuedAt > opts.maxAgeMs) return null;
    return { userId: data.u, scope: data.s as UnsubScope, issuedAt };
  } catch { return null; }
}
