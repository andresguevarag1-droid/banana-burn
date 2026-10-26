// Límites de frecuencia con nombre para todas las entradas que se pueden abusar (rutas /api, server actions, panel).
// Un solo lugar con los números: cada regla dice su ventana, su máximo y el mensaje que ve la persona.
//
// Cómo cuenta:
//   1. Primero un freno en memoria por instancia (gratis): un bot que golpea la misma instancia se corta sin tocar la base.
//   2. Después el límite compartido en Postgres (rate_hit de 0023, service_role): vale para todas las instancias de Vercel.
//      Solo en reglas "db"; las "mem" son acciones baratas e idempotentes (un clic en agua, marcar visto) donde una
//      escritura extra en la base por clic costaría más de lo que protege.
// Si la base falla, deja pasar (queda el freno en memoria y los topes de cada tabla en la base: 0012/0014).
import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { memoryRateLimit } from "@/lib/security";
import { dbRateLimitAll, keyPart } from "@/lib/security/db-rate-limit";

type Window = { sec: number; max: number };
export type Rule = { windows: Window[]; db: boolean; msg: string };

const MIN = 60, HOUR = 3600, DAY = 86400;
const SLOW = "Vas muy rápido. Espera unos minutos e intenta de nuevo.";

/** Reglas por nombre. Holgadas: una persona normal no las toca; un script o un doble clic sostenido sí. */
export const RULES = {
  // ── Coach IA (además del cupo por plan de 0032 y del tope diario global de 0040)
  "coach:chat": { windows: [{ sec: MIN, max: 6 }, { sec: HOUR, max: 60 }], db: true, msg: "Estás mandando mensajes muy seguido. Espera un momento y vuelve a preguntar." },
  "coach:feedback": { windows: [{ sec: HOUR, max: 30 }], db: true, msg: SLOW },
  // ── Cuenta
  "cuenta:exportar": { windows: [{ sec: HOUR, max: 6 }, { sec: DAY, max: 20 }], db: true, msg: "Ya descargaste tus datos varias veces. Intenta en una hora." },
  "cuenta:borrar": { windows: [{ sec: HOUR, max: 5 }], db: true, msg: "Demasiados intentos. Espera una hora e intenta de nuevo." },
  "cuenta:correo": { windows: [{ sec: HOUR, max: 5 }, { sec: DAY, max: 10 }], db: true, msg: "Pediste varios cambios de correo seguidos. Intenta en una hora." },
  "cuenta:enlace-clave": { windows: [{ sec: HOUR, max: 3 }, { sec: DAY, max: 10 }], db: true, msg: "Ya te mandamos varios enlaces. Revisa tu correo (también spam) o intenta en una hora." },
  "cuenta:clave": { windows: [{ sec: HOUR, max: 10 }], db: true, msg: "Demasiados intentos. Espera una hora e intenta de nuevo." },
  "cuenta:perfil": { windows: [{ sec: 10 * MIN, max: 60 }], db: false, msg: SLOW },
  // ── Pagos (checkout, retos y tarjeta ya tienen sus propios límites en la ruta)
  "pagos:prueba": { windows: [{ sec: HOUR, max: 10 }], db: true, msg: "Demasiados intentos. Espera unos minutos e intenta de nuevo." },
  "pagos:cancelar": { windows: [{ sec: HOUR, max: 10 }], db: true, msg: "Demasiados intentos. Espera unos minutos e intenta de nuevo." },
  // ── Público sin sesión (por red, con hash): solicitudes de reunión de condominios (0052)
  "condominios:solicitud": { windows: [{ sec: 10 * MIN, max: 3 }, { sec: DAY, max: 10 }], db: true, msg: "Ya recibimos tu solicitud. Si necesitas algo más, escríbenos a hola@bananaburn.app." },
  // ── Avisos
  "push:suscribir": { windows: [{ sec: HOUR, max: 20 }], db: true, msg: SLOW },
  // ── Comunidad (publicar y comentar ya tienen tope por tabla en 0012; aquí lo que se puede alternar sin fin)
  "comunidad:like": { windows: [{ sec: 10 * MIN, max: 150 }], db: true, msg: SLOW },
  "comunidad:seguir": { windows: [{ sec: 10 * MIN, max: 60 }], db: true, msg: SLOW },
  "comunidad:escribir": { windows: [{ sec: 10 * MIN, max: 40 }], db: true, msg: SLOW },
  "comunidad:perfil": { windows: [{ sec: HOUR, max: 20 }], db: true, msg: "Cambiaste tu perfil muchas veces seguidas. Intenta en una hora." },
  "comunidad:leer": { windows: [{ sec: MIN, max: 120 }], db: false, msg: SLOW },
  // ── Registro diario
  "comidas": { windows: [{ sec: HOUR, max: 300 }], db: true, msg: SLOW },
  "entreno:guardar": { windows: [{ sec: HOUR, max: 30 }], db: true, msg: "Guardaste muchos entrenos seguidos. Espera un momento." },
  "correr:objetivo": { windows: [{ sec: HOUR, max: 30 }], db: true, msg: "Cambiaste tu carrera muchas veces seguidas. Espera un momento." },
  "carreras:guardar": { windows: [{ sec: HOUR, max: 20 }, { sec: DAY, max: 60 }], db: true, msg: "Guardaste muchas carreras seguidas. Espera un momento." },
  "progreso": { windows: [{ sec: HOUR, max: 120 }], db: true, msg: SLOW },
  "registro": { windows: [{ sec: 10 * MIN, max: 300 }], db: false, msg: SLOW },
  "retos": { windows: [{ sec: HOUR, max: 60 }], db: true, msg: SLOW },
  "programas": { windows: [{ sec: HOUR, max: 30 }], db: true, msg: SLOW },
  // ── Panel (staff): una cuenta de staff comprometida no puede hacer daño masivo en minutos
  "admin": { windows: [{ sec: 10 * MIN, max: 300 }], db: true, msg: "Demasiadas acciones seguidas en el panel. Espera unos minutos." },
  "admin:masivo": { windows: [{ sec: HOUR, max: 20 }], db: true, msg: "Demasiadas acciones masivas seguidas. Espera una hora." },
  "admin:borrar-cuenta": { windows: [{ sec: HOUR, max: 20 }], db: true, msg: "Demasiados borrados seguidos. Espera una hora." },
} satisfies Record<string, Rule>;

export type RuleName = keyof typeof RULES;
export type LimitResult = { ok: true } | { ok: false; error: string; retryAfter: number };

/** Segundos hasta que se abre la ventana fija más lejana que se pasó (misma cuenta que rate_hit: floor(epoch / ventana)). */
export function retryAfterFor(windows: Window[], nowMs = Date.now()): number {
  const s = Math.floor(nowMs / 1000);
  return Math.max(1, ...windows.map((w) => w.sec - (s % w.sec)));
}

/**
 * Cuenta un intento para `name` y `subject` (id de usuario, o ip:<hash>). `subject` nunca queda legible en la base.
 * `db` opcional para pruebas (por defecto el cliente service_role; null = solo memoria).
 */
export async function hitLimit(name: RuleName, subject: string, opts: { db?: Parameters<typeof dbRateLimitAll>[0]; now?: number } = {}): Promise<LimitResult> {
  const rule: Rule = RULES[name];
  const who = keyPart(subject);
  const now = opts.now ?? Date.now();
  const fail = (): LimitResult => ({ ok: false, error: rule.msg, retryAfter: retryAfterFor(rule.windows, now) });
  for (const w of rule.windows) if (!memoryRateLimit(`rl:${name}:${w.sec}:${who}`, w.max, w.sec * 1000, now)) return fail();
  if (!rule.db) return { ok: true };
  const db = opts.db === undefined ? adminClient() : opts.db;
  const ok = await dbRateLimitAll(db, rule.windows.map((w) => ({ key: `${name}:${w.sec}:${who}`, windowSec: w.sec, max: w.max })));
  return ok ? { ok: true } : fail();
}

/** Igual que hitLimit, para server actions: null = puede seguir; si no, el mensaje para la persona. */
export async function limitError(name: RuleName, subject: string): Promise<string | null> {
  const r = await hitLimit(name, subject);
  return r.ok ? null : r.error;
}

/** 429 para route handlers: JSON con el mensaje y Retry-After. */
export function tooMany(r: Extract<LimitResult, { ok: false }>, body?: Record<string, unknown>): Response {
  return Response.json({ ok: false, error: r.error, retryAfter: r.retryAfter, ...body }, { status: 429, headers: { "Retry-After": String(r.retryAfter), "Cache-Control": "no-store" } });
}

/** 429 en texto plano (rutas que responden texto, como el coach o la descarga de datos). */
export function tooManyText(r: Extract<LimitResult, { ok: false }>): Response {
  return new Response(r.error, { status: 429, headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": String(r.retryAfter), "Cache-Control": "no-store" } });
}
