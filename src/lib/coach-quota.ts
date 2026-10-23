// Cupo de preguntas a Coach Banana por plan. Puro (sin datos): lo usan el servidor, la pantalla del coach y los planes.
// La regla que manda vive en la base de datos (0032_coach_cuota.sql: _coach_limits(), _coach_tier(), coach_take_quota()).
// Si cambias un número aquí, cámbialo también en _coach_limits() de 0032 (coach-quota.test.ts lo revisa).
//
// Por qué estos números (Sonnet 5.5: USD 2 por millón de tokens de entrada, 10 por millón de salida, 0,20 la lectura de caché):
//   Una pregunta típica después de 0032 ≈ 1.250 tokens de reglas en caché + 500 de datos del atleta + hasta 1.800 de
//   historial + la pregunta, y ≈ 300 de respuesta (tope 600). Costo típico ≈ USD 0,007; peor caso ≈ USD 0,011.
//   Entreno: 150 al mes en el peor caso ≈ USD 1,70 (17 % de 9,99). Entreno + Nutrición: 300 ≈ USD 3,40 (23 % de 14,99).
//   El tope diario reparte el mes (nadie gasta el cupo de 30 días en una tarde) y el mensual es el techo de costo.

export type CoachTier = "none" | "prueba" | "entreno" | "completo" | "staff";
export type CoachLimit = { day: number | null; month: number | null };

/** Fuente única de los límites (null = sin límite). `prueba` = prueba de 7 días, beta y testers. */
export const COACH_LIMITS: Record<Exclude<CoachTier, "none">, CoachLimit> = {
  prueba: { day: 10, month: 150 },
  entreno: { day: 10, month: 150 },
  completo: { day: 20, month: 300 },
  // Staff: sin límite para probar, pero cada pregunta se cuenta igual (queda en coach_usage).
  staff: { day: null, month: null },
};

/** Desde cuántas preguntas restantes el aviso se vuelve visible. */
export const COACH_LOW_AT = 3;

/** Respuesta del modelo: ~120 palabras por regla del prompt; el tope da aire para cuando piden detalle. */
export const COACH_MAX_TOKENS = 600;

export type CoachQuota = {
  tier: CoachTier;
  dayUsed: number;
  monthUsed: number;
  dayLimit: number | null;
  monthLimit: number | null;
  /** Preguntas que quedan hoy (lo menor entre el día y el mes). null = sin límite. */
  left: number | null;
  /** Qué tope se alcanzó (si se alcanzó). */
  reason: "day" | "month" | "locked" | null;
  /** Cuándo vuelve a haber preguntas (ISO). */
  resetsAt: string | null;
};

export function limitsFor(tier: CoachTier): CoachLimit {
  return tier === "none" ? { day: 0, month: 0 } : COACH_LIMITS[tier];
}

/** Medianoche de Costa Rica (UTC-6, sin horario de verano) de mañana, en ISO. Es el corte de todo "hoy" de la app (cr_today()). */
export function nextCrMidnight(now = new Date()): string {
  const cr = new Date(now.getTime() - 6 * 3600_000);
  return new Date(Date.UTC(cr.getUTCFullYear(), cr.getUTCMonth(), cr.getUTCDate() + 1, 6)).toISOString();
}
/** Inicio del mes siguiente en Costa Rica, en ISO. */
export function nextCrMonth(now = new Date()): string {
  const cr = new Date(now.getTime() - 6 * 3600_000);
  return new Date(Date.UTC(cr.getUTCFullYear(), cr.getUTCMonth() + 1, 1, 6)).toISOString();
}

/** Estado del cupo a partir de lo usado (lo mismo que calcula la base). */
export function quotaFrom(tier: CoachTier, dayUsed: number, monthUsed: number, now = new Date()): CoachQuota {
  const { day, month } = limitsFor(tier);
  const dLeft = day === null ? null : Math.max(0, day - dayUsed);
  const mLeft = month === null ? null : Math.max(0, month - monthUsed);
  const left = dLeft === null ? mLeft : mLeft === null ? dLeft : Math.min(dLeft, mLeft);
  const reason: CoachQuota["reason"] = tier === "none" ? "locked" : mLeft === 0 ? "month" : dLeft === 0 ? "day" : null;
  const resetsAt = reason === "month" ? nextCrMonth(now) : reason === "day" ? nextCrMidnight(now) : left !== null ? nextCrMidnight(now) : null;
  return { tier, dayUsed, monthUsed, dayLimit: day, monthLimit: month, left, reason, resetsAt };
}

const TIERS = new Set<CoachTier>(["none", "prueba", "entreno", "completo", "staff"]);
const int = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? Math.max(0, Math.floor(x)) : 0);

/** Lee el jsonb de coach_take_quota() / coach_quota_status(). Algo inesperado: null (el llamador decide). */
export function parseQuota(raw: unknown): (CoachQuota & { ok: boolean; ticket: string | null }) | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const tier = typeof r.tier === "string" && TIERS.has(r.tier as CoachTier) ? (r.tier as CoachTier) : null;
  if (!tier) return null;
  const q = quotaFrom(tier, int(r.day_used), int(r.month_used), typeof r.now === "string" && Number.isFinite(Date.parse(r.now)) ? new Date(r.now) : new Date());
  const ticket = typeof r.ticket === "string" && /^[0-9a-f-]{36}$/i.test(r.ticket) ? r.ticket : null;
  return { ...q, ok: r.ok === true, ticket };
}

/** Nivel de cupo según los derechos de la app (modo demo y respaldo sin 0032). Igual que _coach_tier() de la base. */
export function tierFromAccess(x: { app: boolean; nutrition: boolean; access: string; plan: string }): CoachTier {
  if (!x.app) return "none";
  if (x.access === "staff") return "staff";
  if (x.access === "trial") return "prueba";
  if (x.plan === "completo") return "completo";
  if (x.plan === "entreno") return "entreno";
  return "prueba";
}

const n419 = (n: number) => n.toLocaleString("es-419");

/** Frase del plan (precios, landing, llms.txt): solo números reales de COACH_LIMITS. */
export function coachPlanFeat(plan: "entreno" | "completo"): string {
  const l = COACH_LIMITS[plan];
  const cap = `hasta ${n419(l.day!)} preguntas al día y ${n419(l.month!)} al mes`;
  return plan === "entreno" ? `Coach Banana para tus dudas de entreno: ${cap}` : `Coach Banana también para tu comida: ${cap}`;
}

/** Texto del contador para la pantalla del coach. `tone`: quiet (normal), low (≤ COACH_LOW_AT), out (agotado). */
export function quotaLine(q: Pick<CoachQuota, "left" | "reason">): { text: string; tone: "quiet" | "low" | "out" } | null {
  if (q.left === null) return null;
  if (q.left <= 0) return { text: q.reason === "month" ? "Usaste todas tus preguntas de este mes" : "Usaste todas tus preguntas de hoy", tone: "out" };
  const text = q.left === 1 ? "Te queda 1 pregunta hoy" : `Te quedan ${n419(q.left)} preguntas hoy`;
  return { text, tone: q.left <= COACH_LOW_AT ? "low" : "quiet" };
}

/** Cuándo se renueva, en la hora del navegador: "a medianoche", "mañana a la 1:00 a. m.", "hoy a las 11:00 p. m." o "el 1 de noviembre". */
export function resetLabel(resetsAt: string, reason: "day" | "month" | null, now = new Date(), timeZone?: string): string {
  const at = new Date(resetsAt);
  if (reason === "month") return `el ${at.toLocaleDateString("es-419", { day: "numeric", month: "long", timeZone })}`;
  const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone });
  const tomorrow = new Date(now.getTime() + 864e5);
  const when = day(at) === day(now) ? "hoy" : day(at) === day(tomorrow) ? "mañana" : `el ${at.toLocaleDateString("es-419", { weekday: "long", timeZone })}`;
  // Medianoche de esta noche: "a medianoche" se entiende mejor que "mañana a las 12:00 a. m.".
  if (when === "mañana" && at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone }) === "00:00") return "a medianoche";
  const time = at.toLocaleTimeString("es-419", { hour: "numeric", minute: "2-digit", timeZone });
  return `${when} a ${/^1:/.test(time) ? "la" : "las"} ${time}`;
}

/** Cuerpo JSON del 429 del coach. */
export type CoachLimitBody = { error: "cuota"; reason: "day" | "month"; tier: CoachTier; left: 0; dayLimit: number | null; monthLimit: number | null; resetsAt: string | null };

/** Modo demo: estados simulados para revisar la pantalla (?cuota=bajo | agotado | mes). */
export function demoQuota(sim: string | undefined, tier: CoachTier = "completo", now = new Date()): CoachQuota {
  const { day, month } = limitsFor(tier);
  if (sim === "agotado") return quotaFrom(tier, day ?? 0, Math.min(month ?? 0, day ?? 0), now);
  if (sim === "mes") return quotaFrom(tier, 0, month ?? 0, now);
  if (sim === "bajo") return quotaFrom(tier, Math.max(0, (day ?? 0) - 2), (day ?? 0) - 2, now);
  return quotaFrom(tier, 0, 0, now);
}
