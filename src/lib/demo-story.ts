// Una sola historia para el modo demo, para que todas las pantallas cuenten lo mismo:
// Andrés empezó hace 3 semanas en 94,9 kg, hoy pesa 93,1 kg, entrena según su plan de 6 días
// y lleva 11 días de racha (falló un día hace 12 días).
import { DEFAULT_WEEK, TPL } from "@/lib/engine/data";

export const DEMO_DAYS = 21;
export const DEMO_START_KG = 94.9;
export const DEMO_NOW_KG = 93.1;
export const DEMO_MISSED = 12; // días atrás

const addDays = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const dowOf = (iso: string) => new Date(iso + "T12:00:00").getDay();

export const demoStartDate = (today: string) => addDays(today, -DEMO_DAYS);

/** Entrenos hechos (más reciente primero), siguiendo la semana por defecto. */
export function demoWorkouts(today: string) {
  const out: { d: string; tpl: string; tplId: string }[] = [];
  for (let i = 1; i <= DEMO_DAYS; i++) {
    if (i === DEMO_MISSED) continue;
    const d = addDays(today, -i), id = DEFAULT_WEEK[dowOf(d)];
    if (id) out.push({ d, tpl: TPL[id].n, tplId: id });
  }
  return out;
}

/** Días con actividad (entreno o registro) para la racha. */
export function demoActiveDays(today: string) {
  const s = new Set<string>();
  for (let i = 1; i < DEMO_MISSED; i++) s.add(addDays(today, -i));
  for (let i = DEMO_MISSED + 1; i <= DEMO_DAYS; i++) s.add(addDays(today, -i));
  return s;
}

/** XP coherente con lo anterior: ~140 por entreno + 10 por pesaje + 3 récords. */
export function demoXp(today: string) {
  return demoWorkouts(today).length * 140 + 14 * 10 + 3 * 50;
}
