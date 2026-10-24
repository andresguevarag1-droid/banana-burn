// Regalos de meses (comp_grants con source 'regalo' o 'referido'). Reglas puras, sin acceso a datos.
// La base de datos es la fuente de verdad (0025_regalos_referidos.sql: _access_covered_until y _gift_grant); esto es el
// espejo para pantallas, demo y pruebas.
//   - Un regalo respeta su plan: Entreno o Entreno + Nutrición. Las cortesías de siempre (source 'cortesia') valen como completo.
//   - Se apila: empieza cuando termina el acceso igual o mejor que ya tiene la persona (prueba o beta vigente,
//     cortesías y regalos vigentes o programados, suscripción pagada vigente). Nunca reemplaza ni recorta nada.
import { betaGraceFor, type PlanId } from "@/lib/plans";

export type GiftSource = "cortesia" | "regalo" | "referido";

/** Opciones rápidas del panel. También se puede escribir otro número entre 1 y GIFT_MAX_MONTHS. */
export const GIFT_MONTH_PRESETS = [1, 3, 6, 12] as const;
export const GIFT_MAX_MONTHS = 24;
export const GIFT_MESSAGE_MAX = 280;
/** Máximo de personas en un regalo en lote (mismo tope que admin_gift_months_bulk). */
export const GIFT_BULK_MAX = 200;

export const planLabel = (p: string | null | undefined) => (p === "completo" ? "Entreno + Nutrición" : "Entreno");
export const monthsLabel = (n: number) => `${n.toLocaleString("es-419")} ${n === 1 ? "mes" : "meses"}`;

/** "Te regalaron 3 meses de Entreno + Nutrición" o, si es por referidos, "Ganaste 1 mes de Entreno". */
export function giftTitle(g: { months: number; plan: string; source: GiftSource | string }) {
  return `${g.source === "referido" ? "Ganaste" : "Te regalaron"} ${monthsLabel(g.months)} de ${planLabel(g.plan)}`;
}

const rank = (p: string | null | undefined) => (p === "completo" ? 2 : p === "entreno" ? 1 : 0);

/** ¿Una fila de comp_grants da nutrición? Las cortesías siempre (política del dueño); regalos y recompensas, según su plan. */
export function compGivesNutrition(c: { plan: string; source?: string | null }) {
  return !c.source || c.source === "cortesia" || c.plan === "completo";
}
/** Plan efectivo de una fila de comp_grants. */
export const compPlan = (c: { plan: string; source?: string | null }): PlanId => (compGivesNutrition(c) ? "completo" : "entreno");

/** Suma meses como Postgres (`+ interval 'n months'`): si el día no existe en el mes destino, queda el último día del mes. */
export function addMonths(from: Date | string, n: number): Date {
  const d = new Date(from);
  const day = d.getUTCDate();
  const t = new Date(d);
  t.setUTCDate(1);
  t.setUTCMonth(t.getUTCMonth() + n);
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(day, last));
  return t;
}

const DAY = 864e5;
const TRIAL_MS = 7 * DAY;

export type CoverComp = { plan: string; source?: string | null; starts_at: string; expires_at: string; revoked_at: string | null };
export type CoverSub = { plan: string | null; status: string; current_period_end: string | null; cancel_at_period_end?: boolean | null };

/** Espejo de public._access_covered_until(): hasta cuándo ya tiene acceso igual o mejor que `plan` (nunca antes de `now`). */
export function coveredUntil(i: { now: Date; plan: PlanId; createdAt?: string | null; betaEndsAt?: string | null; comps?: CoverComp[]; subs?: CoverSub[] }): Date {
  const now = i.now.getTime();
  const ends: number[] = [now];
  const created = i.createdAt ? Date.parse(i.createdAt) : NaN;
  if (Number.isFinite(created)) {
    const own = created + TRIAL_MS;
    const beta = i.betaEndsAt ? Date.parse(i.betaEndsAt) : NaN;
    // Cuentas de la beta (0045): gratis hasta 7 días después del lanzamiento.
    const grace = Number.isFinite(beta) && created < beta ? Date.parse(betaGraceFor(i.betaEndsAt!)) : NaN;
    ends.push(Number.isFinite(grace) && grace > now ? Math.max(own, grace) : own);
  }
  for (const c of i.comps ?? []) {
    const end = Date.parse(c.expires_at);
    if (c.revoked_at || !(end > now)) continue;
    if (i.plan === "entreno" || compGivesNutrition(c)) ends.push(end);
  }
  for (const s of i.subs ?? []) {
    const end = s.current_period_end ? Date.parse(s.current_period_end) : NaN;
    if (!(end > now)) continue;
    const live = ["active", "trialing", "past_due"].includes(s.status) || (s.status === "canceled" && !!s.cancel_at_period_end);
    if (live && (i.plan === "entreno" || s.plan === "completo")) ends.push(end);
  }
  return new Date(Math.max(...ends));
}

/** Ventana de un regalo nuevo: empieza al terminar lo que ya cubre y dura `months` meses. */
export function giftWindow(i: Parameters<typeof coveredUntil>[0] & { months: number }) {
  const start = coveredUntil(i);
  return { startsAt: start.toISOString(), expiresAt: addMonths(start, i.months).toISOString() };
}

export type GiftStatus = "activo" | "programado" | "terminado" | "revocado";
export function giftStatus(g: { starts_at: string; expires_at: string; revoked_at: string | null }, now = new Date()): GiftStatus {
  if (g.revoked_at) return "revocado";
  const t = now.getTime();
  if (Date.parse(g.starts_at) > t) return "programado";
  return Date.parse(g.expires_at) > t ? "activo" : "terminado";
}
export const GIFT_STATUS_LABEL: Record<GiftStatus, string> = { activo: "Activo", programado: "Programado", terminado: "Terminado", revocado: "Revocado" };

/**
 * Fin del acceso continuo que dan cortesías y regalos desde hoy: el vigente de mayor rango y, si hay regalos que empiezan
 * justo cuando termina (apilados), hasta el último de la cadena. Sin nada vigente: undefined.
 */
export function compChainEnd(comps: CoverComp[], now = new Date()): string | undefined {
  const t = now.getTime();
  const valid = comps.filter((c) => !c.revoked_at && Date.parse(c.expires_at) > t);
  const live = valid.filter((c) => Date.parse(c.starts_at) <= t);
  if (!live.length) return undefined;
  let end = Math.max(...live.map((c) => Date.parse(c.expires_at)));
  // Encadena regalos programados que empiezan antes (o en el mismo minuto) de que termine lo vigente.
  for (let changed = true; changed;) {
    changed = false;
    for (const c of valid) {
      const s = Date.parse(c.starts_at), e = Date.parse(c.expires_at);
      if (s <= end + 60_000 && e > end) { end = e; changed = true; }
    }
  }
  return new Date(end).toISOString();
}

/** El regalo vigente con mejor plan (y, a igual plan, el que termina más tarde). */
export function bestLiveComp<T extends CoverComp>(comps: T[], now = new Date()): T | undefined {
  const t = now.getTime();
  return comps
    .filter((c) => !c.revoked_at && Date.parse(c.starts_at) <= t && Date.parse(c.expires_at) > t)
    .sort((a, b) => rank(compPlan(b)) - rank(compPlan(a)) || b.expires_at.localeCompare(a.expires_at))[0];
}

/** Lo que el cliente recibe de un regalo: sin motivo interno, sin quién lo dio, sin ids de otras tablas. */
export type GiftView = { id: number; source: "regalo" | "referido"; plan: PlanId; months: number; message: string | null; startsAt: string; expiresAt: string; status: GiftStatus; title: string };

export function toGiftView(r: { id: number; source: string; plan: string; months: number | null; message: string | null; starts_at: string; expires_at: string; revoked_at: string | null }, now = new Date()): GiftView {
  const months = r.months ?? Math.max(1, Math.round((Date.parse(r.expires_at) - Date.parse(r.starts_at)) / (30.44 * DAY)));
  const plan: PlanId = r.plan === "completo" ? "completo" : "entreno";
  const source = r.source === "referido" ? "referido" : "regalo";
  return { id: r.id, source, plan, months, message: r.message, startsAt: r.starts_at, expiresAt: r.expires_at, status: giftStatus(r, now), title: giftTitle({ months, plan, source }) };
}
