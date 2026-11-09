// Formatos por idioma (#287). es-419 y en-US escriben igual los números (1,200 y 9.99) y los precios ($9.99, USD), así
// que el español no cambia; lo que sí cambia en inglés de EE. UU. son las unidades (lb y ft/in) y las fechas.
import type { Locale, Units } from "./locale";

export const LB_PER_KG = 2.2046226218;
export const CM_PER_IN = 2.54;

/** Número con el formato del idioma: 1,200 / 93.1. `max` y `min` son los decimales. */
export const fmtNumber = (n: number, locale: Locale, max = 1, min = 0) =>
  n.toLocaleString(locale, { minimumFractionDigits: min, maximumFractionDigits: max });

/** Precio en USD: $9.99, $59.99, $1,040.00. Los precios nunca cambian con el idioma. */
export const fmtMoney = (n: number, locale: Locale) => `$${fmtNumber(n, locale, 2, 2)}`;

export const kgToLb = (kg: number) => kg * LB_PER_KG;
export const lbToKg = (lb: number) => lb / LB_PER_KG;

/** Pulgadas totales a pies y pulgadas: 69 → { ft: 5, in: 9 }. Redondea a la pulgada. */
export function cmToFtIn(cm: number): { ft: number; in: number } {
  const total = Math.round(cm / CM_PER_IN);
  return { ft: Math.floor(total / 12), in: total % 12 };
}
export const ftInToCm = (ft: number, inches: number) => Math.round((ft * 12 + inches) * CM_PER_IN * 10) / 10;

/** Peso guardado en kg, mostrado en la unidad de la persona: "93.1 kg" o "205.3 lb". */
export function fmtWeight(kg: number, units: Units, locale: Locale, decimals = 1) {
  return units === "imperial" ? `${fmtNumber(kgToLb(kg), locale, decimals)} lb` : `${fmtNumber(kg, locale, decimals)} kg`;
}

/** Peso de una serie (kg del plan) en la unidad de la persona. En libras se redondea a la libra: así son las pesas en EE. UU. */
export const loadIn = (kg: number, units: Units) => (units === "imperial" ? Math.round(kgToLb(kg)) : kg);
export const weightUnit = (units: Units) => (units === "imperial" ? "lb" : "kg");

/** El disco más chico en un gimnasio de EE. UU.: las cargas del entreno en libras van de 2.5 en 2.5 (#295). */
export const LB_PLATE = 2.5;
/** Carga del plan (kg) en libras para el entreno: 20 kg → 45 lb, 22.5 kg → 50 lb. */
export const kgToPlateLb = (kg: number) => Math.round(kgToLb(kg) / LB_PLATE) * LB_PLATE;
/** Lo que escribe la persona en libras, a kg para guardar (con dos decimales): 45 lb → 20.41 kg. Vuelve a 45 lb al mostrarlo. */
export const lbInputToKg = (lb: number) => Math.round(lbToKg(lb) * 100) / 100;
/** Carga del entreno en la unidad de la persona: kg tal cual o libras de 2.5 en 2.5. */
export const workoutLoad = (kg: number, units: Units) => (units === "imperial" ? kgToPlateLb(kg) : kg);
/** Lo que escribió la persona (en su unidad) a kg para guardar. */
export const workoutLoadToKg = (v: number, units: Units) => (units === "imperial" ? lbInputToKg(v) : v);

/** Estatura guardada en cm: "175 cm" o "5 ft 9 in". */
export function fmtHeight(cm: number, units: Units, locale: Locale) {
  if (units === "metric") return `${fmtNumber(cm, locale, 0)} cm`;
  const { ft, in: inches } = cmToFtIn(cm);
  return `${ft} ft ${inches} in`;
}

/** Fecha corta del idioma: "8 nov" / "Nov 8". */
export const fmtDate = (d: Date | string, locale: Locale, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  new Date(d).toLocaleDateString(locale, opts);
