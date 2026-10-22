// Matemática pura de KPIs del panel (sin I/O). Probada en admin-kpis.test.ts.
import { PLANS, type Billing, type PlanId } from "./plans";

export const DAY_MS = 864e5;

/** Fecha ISO (YYYY-MM-DD) en Costa Rica (UTC−6, sin horario de verano) para un timestamp. */
export function crDay(ts: string | number | Date): string {
  if (typeof ts === "string" && /^\d{4}-\d{2}-\d{2}$/.test(ts)) return ts;
  return new Date(new Date(ts).getTime() - 6 * 3600e3).toISOString().slice(0, 10);
}
export function addDays(iso: string, n: number): string {
  return new Date(Date.parse(iso + "T00:00:00Z") + n * DAY_MS).toISOString().slice(0, 10);
}
/** Suma meses calendario a una fecha ISO (31 ene + 1 mes = 28/29 feb). */
export function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}
/** Siguiente renovación según la periodicidad: mensual = +1 mes, anual = +1 año. */
export const nextRenewal = (lastPayment: string, billing: Billing) => addMonths(lastPayment, billing === "anual" ? 12 : 1);
/** Días entre dos fechas ISO (b − a). */
export function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / DAY_MS);
}
/** Lunes de la semana de una fecha ISO. */
export function weekOf(iso: string): string {
  const dow = new Date(iso + "T00:00:00Z").getUTCDay();
  return addDays(iso, -((dow + 6) % 7));
}

/** Porcentaje 0–100 con un decimal; 0 si no hay denominador. */
export function pct(n: number, d: number): number {
  if (!d || !Number.isFinite(n) || !Number.isFinite(d)) return 0;
  return Math.round((n / d) * 1000) / 10;
}

// ─────────── Suscripciones ───────────

/** Fila de public.subscriptions con columnas opcionales (la integración de pagos puede agregar plan/billing/amount/canceled_at). */
export type SubRow = {
  id?: string | number;
  user_id?: string;
  status?: string | null;
  plan?: string | null;
  billing?: string | null;
  price_id?: string | null;
  amount?: number | null;          // USD por periodo, si la integración lo guarda
  current_period_start?: string | null; // último cobro
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
  provider_customer_id?: string | null;
  provider_subscription_id?: string | null;
  canceled_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  provider?: string | null;
};

export const PAYING = new Set(["active", "past_due"]);
export const FAILED = new Set(["past_due", "unpaid", "incomplete", "incomplete_expired", "failed"]);

/** Deduce plan y periodicidad de una suscripción tolerando columnas faltantes. */
export function resolvePlan(s: SubRow, fallbackPlan?: string | null): { plan: PlanId | null; billing: Billing } {
  const hay = `${s.plan ?? ""} ${s.price_id ?? ""}`.toLowerCase();
  const b = `${s.billing ?? ""} ${s.price_id ?? ""}`.toLowerCase();
  const billing: Billing = /anual|annual|year|yr/.test(b) ? "anual" : "mes";
  let plan: PlanId | null = null;
  if (/completo|nutri|full|pro_plus/.test(hay)) plan = "completo";
  else if (/entreno|train|basic/.test(hay)) plan = "entreno";
  else if (fallbackPlan === "completo" || fallbackPlan === "pro") plan = "completo";
  else if (fallbackPlan === "entreno") plan = "entreno";
  return { plan, billing };
}

/** Ingreso mensual normalizado (USD) de una suscripción. */
export function monthlyValue(s: SubRow, fallbackPlan?: string | null): number {
  const { plan, billing } = resolvePlan(s, fallbackPlan);
  if (typeof s.amount === "number" && s.amount > 0) return billing === "anual" ? s.amount / 12 : s.amount;
  if (!plan) return 0;
  const p = PLANS.find((x) => x.id === plan)!;
  return billing === "anual" ? p.price.anual / 12 : p.price.mes;
}

/** MRR estimado: suma de suscripciones activas (no incluye trial ni cortesías). */
export function mrr(subs: SubRow[], planOf: (userId?: string) => string | null | undefined = () => null) {
  let total = 0;
  const byPlan: Record<string, { n: number; mrr: number }> = {};
  for (const s of subs) {
    if (s.status !== "active") continue;
    const v = monthlyValue(s, planOf(s.user_id));
    const { plan, billing } = resolvePlan(s, planOf(s.user_id));
    const k = `${plan ?? "desconocido"}:${billing}`;
    byPlan[k] ??= { n: 0, mrr: 0 };
    byPlan[k].n++;
    byPlan[k].mrr += v;
    total += v;
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  for (const k in byPlan) byPlan[k].mrr = r2(byPlan[k].mrr);
  return { total: r2(total), byPlan };
}

/** Fecha de cancelación: columna canceled_at si existe; si no, updated_at de una fila cancelada. */
export function canceledOn(s: SubRow): string | null {
  if (s.canceled_at) return s.canceled_at;
  if (s.status === "canceled" || s.status === "cancelled") return s.updated_at ?? s.current_period_end ?? null;
  return null;
}

/**
 * Churn de N días = cancelaciones en la ventana / suscriptores pagos al inicio de la ventana.
 * Suscriptor al inicio = creado antes del inicio y no cancelado antes del inicio.
 */
export function churn(subs: SubRow[], now: Date, days = 30) {
  const start = now.getTime() - days * DAY_MS;
  let base = 0, lost = 0;
  for (const s of subs) {
    if (s.status === "trialing") continue;
    const created = s.created_at ? Date.parse(s.created_at) : 0;
    const c = canceledOn(s);
    const canceled = c ? Date.parse(c) : null;
    if (created < start && (canceled === null || canceled >= start)) {
      base++;
      if (canceled !== null && canceled <= now.getTime()) lost++;
    }
  }
  return { base, lost, rate: pct(lost, base) };
}

// ─────────── Actividad y retención ───────────

/** Mapa usuario → conjunto de días (ISO) con cualquier actividad (entreno, pesaje, registro diario o comida). */
export type ActivityMap = Map<string, Set<string>>;

export function activityMap(rows: { user_id: string; day: string }[]): ActivityMap {
  const m: ActivityMap = new Map();
  for (const r of rows) {
    if (!m.has(r.user_id)) m.set(r.user_id, new Set());
    m.get(r.user_id)!.add(r.day.slice(0, 10));
  }
  return m;
}

/** Usuarios activos hoy / últimos 7 días / últimos 30 días (incluye hoy). */
export function activeCounts(act: ActivityMap, today: string) {
  const from7 = addDays(today, -6), from30 = addDays(today, -29);
  let t = 0, d7 = 0, d30 = 0;
  for (const days of act.values()) {
    let a = false, b = false, c = false;
    for (const d of days) {
      if (d > today) continue;
      if (d === today) a = true;
      if (d >= from7) b = true;
      if (d >= from30) c = true;
    }
    t += +a; d7 += +b; d30 += +c;
  }
  return { today: t, d7, d30 };
}

/** Altas en los últimos N días (incluye hoy) a partir de fechas de creación. */
export function signupsWithin(createdAt: string[], today: string, days: number): number {
  const from = addDays(today, -(days - 1));
  return createdAt.filter((c) => { const d = crDay(c); return d >= from && d <= today; }).length;
}

/** Ventanas de retención: D1 = día 1; D7 = semana 2 (días 7–13); D30 = días 30–36. */
export const RETENTION_WINDOWS = { d1: [1, 1], d7: [7, 13], d30: [30, 36] } as const;
export type RetKey = keyof typeof RETENTION_WINDOWS;
export type Cell = { n: number; eligible: number; rate: number | null };
export type CohortRow = { cohort: string; size: number } & Record<RetKey, Cell>;

/**
 * Tabla de cohortes semanales. Una celda solo muestra tasa cuando la ventana ya terminó para TODOS los usuarios
 * de la cohorte (eligible === size); si no, queda en null ("en curso") en vez de mezclar denominadores.
 * Así D1 ≥ D7 ≥ D30 se compara siempre sobre el mismo grupo de personas.
 */
export function cohortRetention(users: { id: string; created_at: string }[], act: ActivityMap, today: string, weeks = 8): CohortRow[] {
  const firstWeek = addDays(weekOf(today), -7 * (weeks - 1));
  const rows = new Map<string, CohortRow>();
  for (let i = 0; i < weeks; i++) {
    const w = addDays(firstWeek, 7 * i);
    rows.set(w, { cohort: w, size: 0, d1: cell(), d7: cell(), d30: cell() });
  }
  for (const u of users) {
    const signup = crDay(u.created_at);
    const row = rows.get(weekOf(signup));
    if (!row) continue;
    row.size++;
    const days = act.get(u.id) ?? new Set<string>();
    for (const k of Object.keys(RETENTION_WINDOWS) as RetKey[]) {
      const [a, b] = RETENTION_WINDOWS[k];
      if (addDays(signup, b) > today) continue;            // ventana aún abierta
      row[k].eligible++;
      for (let d = a; d <= b; d++) if (days.has(addDays(signup, d))) { row[k].n++; break; }
    }
  }
  for (const r of rows.values()) for (const k of Object.keys(RETENTION_WINDOWS) as RetKey[]) r[k].rate = cellRate(r[k].n, r[k].eligible, r.size);
  return [...rows.values()].reverse();
}
const cell = (): Cell => ({ n: 0, eligible: 0, rate: null });
/** Tasa de una celda de cohorte: solo con la cohorte completa (todas sus ventanas cerradas). */
export const cellRate = (n: number, eligible: number, size: number): number | null => (size > 0 && eligible >= size ? pct(Math.min(n, eligible), eligible) : null);

/** Serie diaria con ceros para los últimos N días (incluye hoy). */
export function dailySeries(dates: string[], today: string, days: number): { day: string; n: number }[] {
  const counts = new Map<string, number>();
  for (const d of dates) counts.set(d.slice(0, 10), (counts.get(d.slice(0, 10)) ?? 0) + 1);
  return Array.from({ length: days }, (_, i) => { const day = addDays(today, i - days + 1); return { day, n: counts.get(day) ?? 0 }; });
}

/** Variación porcentual entre dos periodos (null si no hay base). */
export function delta(curr: number, prev: number): number | null {
  if (!prev) return null;
  return Math.round(((curr - prev) / prev) * 100);
}

export { money } from "./admin-format";
