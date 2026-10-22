import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

export { safeNext } from "./redirect";

/** Comparación en tiempo constante (también oculta la longitud: compara hashes SHA-256). */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** `Authorization: Bearer <secret>` en tiempo constante. Sin secreto configurado: siempre false. */
export function bearerOk(header: string | null, secret: string | null | undefined): boolean {
  if (!secret) return false;
  return safeEqual(header ?? "", `Bearer ${secret}`);
}

/**
 * Defensa CSRF para route handlers que cambian estado: si el navegador manda Origin (o Sec-Fetch-Site),
 * debe ser el mismo sitio. Las server actions de Next ya hacen este chequeo por su cuenta.
 */
export function isSameOrigin(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = req.headers.get("origin");
  if (!origin) return true; // clientes sin Origin (no navegadores): la cookie SameSite=Lax y la sesión siguen aplicando
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Servicios de Web Push reales. Cualquier otro endpoint se rechaza (evita SSRF desde el cron). Igual que el CHECK de 0012. */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^web\.push\.apple\.com$/, /^[a-z0-9-]+\.notify\.windows\.com$/, /^[a-z0-9-]+\.push\.apple\.com$/];
export function isKnownPushEndpoint(e: unknown): e is string {
  if (typeof e !== "string" || e.length > 1024) return false;
  try {
    const u = new URL(e);
    return u.protocol === "https:" && !u.username && !u.password && (u.port === "" || u.port === "443") && PUSH_HOSTS.some((r) => r.test(u.hostname));
  } catch {
    return false;
  }
}

/**
 * Límite en memoria por clave (best-effort, por instancia). Solo para rutas SIN base de datos (modo demo / sin llave);
 * con Supabase los límites viven en Postgres (0012_seguridad.sql).
 */
const buckets = new Map<string, { n: number; reset: number }>();
export function memoryRateLimit(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  if (buckets.size > 5000) for (const [k, b] of buckets) if (b.reset <= now) buckets.delete(k);
  const b = buckets.get(key);
  if (!b || b.reset <= now) { buckets.set(key, { n: 1, reset: now + windowMs }); return true; }
  if (b.n >= max) return false;
  b.n++;
  return true;
}

export function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: unknown): s is string => typeof s === "string" && UUID.test(s);
