// Una sola historia para el modo demo, para que todas las pantallas cuenten lo mismo:
// Andrés empezó hace 21 días (3 semanas) en 94,9 kg, hoy pesa 93,1 kg, entrena según su plan de 6 días
// y lleva 11 días de racha (falló un día hace 12 días). Pesajes, logros, XP, gráficas y la semana del
// bloque salen de aquí; ninguna pantalla debe inventar sus propios números.
import { DEFAULT_WEEK, TPL } from "@/lib/engine/data";

export const DEMO_DAYS = 21;
export const DEMO_START_KG = 94.9;
export const DEMO_NOW_KG = 93.1;
export const DEMO_MISSED = 12; // días atrás
export const DEMO_PRS = 3;

const addDays = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const dowOf = (iso: string) => new Date(iso + "T12:00:00").getDay();
const mondayOf = (iso: string) => addDays(iso, -((dowOf(iso) + 6) % 7));

/**
 * Inicio del bloque de entrenamiento. El bloque cuenta semanas de lunes a domingo; para que "3 semanas"
 * se lea como "Semana 3 de 6" cualquier día de la semana, el bloque arranca el lunes de hace dos semanas.
 */
export const demoStartDate = (today: string) => addDays(mondayOf(today), -14);

/**
 * Pesajes desde el día 1 (hace 21 días, 94,9 kg) hasta ayer (93,1 kg), del más viejo al más nuevo.
 * No se pesa todos los días, y hoy todavía no se ha pesado (Hoy le pregunta "¿Ya te pesaste?").
 */
export function demoWeights(today: string) {
  const out: { d: string; v: number }[] = [];
  for (let i = DEMO_DAYS; i >= 1; i--) {
    if (i % 3 === 1 && i > 6) continue;
    const noise = i === 1 || i === DEMO_DAYS ? 0 : Math.sin(i * 1.7) * 0.25 + Math.cos(i * 0.9) * 0.1;
    out.push({ d: addDays(today, -i), v: Math.round((DEMO_NOW_KG + ((i - 1) * (DEMO_START_KG - DEMO_NOW_KG)) / (DEMO_DAYS - 1) + noise) * 10) / 10 });
  }
  return out;
}

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

/** Pesajes registrados (los mismos puntos de la gráfica de Progreso). */
export const demoWeighIns = (today: string) => demoWeights(today).length;

/** XP coherente con lo anterior: 140 por entreno, 10 por pesaje y 50 por récord. */
export function demoXp(today: string) {
  return demoWorkouts(today).length * 140 + demoWeighIns(today) * 10 + DEMO_PRS * 50;
}
