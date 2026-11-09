// Idioma y unidades del reproductor (#300). Las funciones puras del entreno reciben un `Lang` opcional: sin él salen
// en español y en kg, exactamente como antes. Los pesos siempre se guardan en kg; aquí solo se muestran o se leen en lb.
import { DEFAULT_LOCALE, type Locale, type Units } from "@/lib/i18n/locale";
import { loadKg, loadShown, weightUnit } from "@/lib/i18n/format";
import { tr, type T } from "@/lib/i18n/t";
import { exerciseName } from "@/lib/i18n/names";

export type Lang = { t: T; units: Units; locale: Locale };
export const ES_LANG: Lang = { t: tr(DEFAULT_LOCALE), units: "metric", locale: DEFAULT_LOCALE };
export const langOf = (locale: Locale, units: Units): Lang => ({ t: tr(locale), units, locale });
export const isEs = (L: Lang) => L.locale === DEFAULT_LOCALE;

const n2 = (n: number) => n.toLocaleString("es-419", { maximumFractionDigits: 2 });
const num = (s: string | number | null | undefined) => Number(String(s ?? "").replace(",", ".")) || 0;

/** "kg" o "lb". */
export const wUnit = (L: Lang) => weightUnit(L.units);
/** Solo el número de un peso guardado en kg: "20" o "45" (lb, redondeado a 2.5). */
export const wNum = (kg: number, L: Lang) => n2(loadShown(kg, L.units));
/** Peso con su unidad: "20 kg" o "45 lb". */
export const wFmt = (kg: number, L: Lang) => `${wNum(kg, L)} ${wUnit(L)}`;
/** Volumen total: "1.2 t" / "850 kg" en kg; en lb, libras con miles ("2,645 lb"). */
export function volFmt(kg: number, L: Lang) {
  if (L.units === "metric") return kg >= 1000 ? `${n2(Math.round(kg / 100) / 10)} t` : `${n2(kg)} kg`;
  return `${Math.round(kg * 2.2046226218).toLocaleString("en-US")} lb`;
}

/** Lo que muestra el campo de peso de una serie (la fila guarda kg como texto). */
export const fieldShown = (kg: string, L: Lang) => (L.units === "metric" || kg.trim() === "" ? kg : n2(loadShown(num(kg), L.units)));
/** Lo que la persona escribe en el campo de peso, a kg (texto) para la fila. */
export const fieldKg = (v: string, L: Lang) => (L.units === "metric" || v.trim() === "" ? v : String(loadKg(num(v), L.units)));
/** Un peso del plan llevado al disco más cercano de la unidad de la persona (45 lb, no 44.09 lb). En kg no cambia. */
export const snapKg = (kg: number, L: Lang) => (L.units === "metric" ? kg : loadKg(loadShown(kg, L.units), L.units));

/** Paso de + y − del peso en la unidad que se ve: en lb, 5 con barra (2.5 por lado) y 2.5 con mancuernas o máquina. */
export function stepKg(curKg: number, d: number, o: { barbell: boolean; kgStep: number }, L: Lang, min = 0) {
  if (L.units === "metric") return Math.max(min, Math.round((curKg + d * o.kgStep) * 100) / 100);
  const shown = loadShown(curKg, L.units) + d * (o.barbell ? 5 : 2.5);
  return Math.max(min, loadKg(Math.max(0, shown), L.units));
}

/** Discos por lado en lb para una barra de 45 lb. Null si no se arma justo. */
export function lbPlatesPerSide(kg: number): number[] | null {
  let side = (loadShown(kg, "imperial") - 45) / 2;
  if (side < 0) return null;
  const out: number[] = [];
  for (const p of [45, 35, 25, 10, 5, 2.5]) while (side >= p - 1e-9) { out.push(p); side -= p; }
  return side > 0.01 ? null : out;
}

/** Nombre del ejercicio en el idioma de la persona (por slug; la biblioteca trae su nombre en inglés). */
export const exName = (e: { id: string; name: string; en?: string | null }, L: Lang) => exerciseName(e.id, e.name, L.locale, e.en);
