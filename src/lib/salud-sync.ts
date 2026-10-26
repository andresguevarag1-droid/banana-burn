// Datos de Salud (HealthKit en iPhone, Health Connect en Android) que la app nativa manda al servidor. Puro y probado
// (salud-sync.test.ts): lo usan src/lib/native/salud.ts (arma el envío en el teléfono) y la acción syncHealth (valida y
// decide qué se guarda).
//
// Reglas (docs/app-nativa.md, "Salud"):
//   - Hoy: los pasos y la energía activa llenan el registro del día como si la persona los anotara (mismo XP de
//     registro; cuentan para la racha y los retos).
//   - Días anteriores (hasta 7): solo se completan los pasos de los días que ya tienen registro. Nunca se crea un día
//     pasado: caminar no reescribe la racha hacia atrás.
//   - Los pasos solo suben: si anotaste más a mano (una caminadora sin reloj), se respeta.
//   - Peso: pesajes de los últimos 30 días (una báscula conectada), solo en días sin peso. Lo que anotaste a mano manda.

export const STEP_DAYS = 7;
export const WEIGHT_DAYS = 30;
const MAX_STEPS = 80000; // el mismo tope que el registro a mano (actions/daily.ts)
const MAX_KCAL = 10000; // CHECK de daily_logs.active_kcal (0058)

export type HealthDay = { day: string; steps?: number; activeKcal?: number };
export type HealthWeight = { day: string; kg: number };
export type HealthPayload = { days: HealthDay[]; weights: HealthWeight[] };

/** Fecha ISO (YYYY-MM-DD) válida de verdad: "2026-02-30" no pasa. */
export function isIsoDay(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const count = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.min(max, Math.round(v)) : undefined);

/**
 * Lo que manda el teléfono, validado contra el "hoy" de la persona (su zona horaria en el servidor). Descarta lo que
 * no sea un número razonable o caiga fuera de la ventana; un día repetido se queda con el último.
 */
export function cleanHealth(raw: unknown, today: string): HealthPayload {
  const o = (raw && typeof raw === "object" ? raw : {}) as { days?: unknown; weights?: unknown };
  const days = new Map<string, HealthDay>();
  const stepFloor = addDays(today, -(STEP_DAYS - 1));
  for (const d of Array.isArray(o.days) ? o.days.slice(0, 40) : []) {
    const r = (d && typeof d === "object" ? d : {}) as Record<string, unknown>;
    if (!isIsoDay(r.day) || r.day > today || r.day < stepFloor) continue;
    const steps = count(r.steps, MAX_STEPS), activeKcal = count(r.activeKcal, MAX_KCAL);
    if (steps === undefined && activeKcal === undefined) continue;
    days.set(r.day, { day: r.day, ...(steps !== undefined && { steps }), ...(activeKcal !== undefined && { activeKcal }) });
  }
  const weights = new Map<string, HealthWeight>();
  const weightFloor = addDays(today, -(WEIGHT_DAYS - 1));
  for (const w of Array.isArray(o.weights) ? o.weights.slice(0, 60) : []) {
    const r = (w && typeof w === "object" ? w : {}) as Record<string, unknown>;
    if (!isIsoDay(r.day) || r.day > today || r.day < weightFloor) continue;
    if (typeof r.kg !== "number" || !Number.isFinite(r.kg)) continue;
    const kg = Math.round(r.kg * 10) / 10;
    if (kg < 30 || kg > 300) continue; // CHECK de weights (0001)
    weights.set(r.day, { day: r.day, kg });
  }
  const byDay = <T extends { day: string }>(m: Map<string, T>) => [...m.values()].sort((a, b) => a.day.localeCompare(b.day));
  return { days: byDay(days), weights: byDay(weights) };
}

export type ExistingDay = { day: string; steps: number | null; active_kcal?: number | null };
export type DailyRow = { day: string; steps: number | null; active_kcal?: number | null };

/**
 * Filas de daily_logs que hay que escribir. Todas con las mismas columnas (un upsert en lote rellena con null las que
 * falten). `withKcal` = la columna active_kcal existe (0058 aplicada). `createsToday`: hoy no tenía registro y ahora sí
 * (da el XP de registro, igual que anotarlo a mano).
 */
export function planDailyRows(p: HealthPayload, existing: ExistingDay[], today: string, withKcal: boolean): { rows: DailyRow[]; createsToday: boolean } {
  const had = new Map(existing.map((e) => [e.day, e]));
  const rows: DailyRow[] = [];
  let createsToday = false;
  for (const d of p.days) {
    const ex = had.get(d.day);
    if (!ex) {
      // Solo hoy se crea, y solo con algo que contar (a la medianoche con 0 pasos no hay registro).
      if (d.day !== today || !((d.steps ?? 0) > 0 || (withKcal && (d.activeKcal ?? 0) > 0))) continue;
      createsToday = true;
    }
    // Pasos: el mayor entre lo guardado y Salud. Energía activa: solo viene de Salud, así que manda el último dato.
    const steps = d.steps ? Math.max(ex?.steps ?? 0, d.steps) : (ex?.steps ?? null);
    const kcal = withKcal ? (d.activeKcal ? d.activeKcal : (ex?.active_kcal ?? null)) : undefined;
    if (ex && steps === ex.steps && (!withKcal || kcal === (ex.active_kcal ?? null))) continue; // nada cambió
    rows.push(withKcal ? { day: d.day, steps, active_kcal: kcal } : { day: d.day, steps });
  }
  return { rows, createsToday };
}

/** Pesajes que faltan: solo días sin peso guardado. */
export function planWeights(p: HealthPayload, existingDays: Iterable<string>): HealthWeight[] {
  const had = new Set(existingDays);
  return p.weights.filter((w) => !had.has(w.day));
}

/* ---------- En el teléfono: de lo que devuelve el plugin a días locales ---------- */

/** Día local (YYYY-MM-DD) de un instante, en la zona del teléfono. */
export function localDayOf(iso: string, tz?: string): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
}

/**
 * Totales por día de una consulta agregada por día. Se usa el centro de cada tramo: si un cambio de horario corre
 * el inicio una hora, el tramo sigue cayendo en su día.
 */
export function dailyTotals(samples: { startDate: string; endDate: string; value: number }[], tz?: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of samples) {
    const a = Date.parse(s.startDate), b = Date.parse(s.endDate);
    if (Number.isNaN(a) || Number.isNaN(b) || !Number.isFinite(s.value)) continue;
    const day = localDayOf(new Date((a + b) / 2).toISOString(), tz);
    if (day) out.set(day, (out.get(day) ?? 0) + s.value);
  }
  return out;
}

/** El pesaje más reciente de cada día. */
export function latestWeights(samples: { startDate: string; value: number }[], tz?: string): HealthWeight[] {
  const best = new Map<string, { t: number; kg: number }>();
  for (const s of samples) {
    const t = Date.parse(s.startDate);
    const day = localDayOf(s.startDate, tz);
    if (!day || !Number.isFinite(s.value)) continue;
    const cur = best.get(day);
    if (!cur || t > cur.t) best.set(day, { t, kg: s.value });
  }
  return [...best.entries()].map(([day, { kg }]) => ({ day, kg: Math.round(kg * 10) / 10 })).sort((a, b) => a.day.localeCompare(b.day));
}
