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
/** Carga en libras redondeada a 2.5 lb (Hoy, #299): 60 kg → 132.5. */
export const roundLb = (kg: number) => Math.round(kgToLb(kg) / 2.5) * 2.5;
export const weightUnit = (units: Units) => (units === "imperial" ? "lb" : "kg");

/** Redondeo de discos y mancuernas en EE. UU.: a 2.5 lb. */
export const snapLb = (lb: number) => Math.round(lb / 2.5) * 2.5;
/** Peso guardado en kg tal como se muestra en el entreno: igual en kg; en libras, redondeado a 2.5 lb. */
export const loadShown = (kg: number, units: Units) => (units === "imperial" ? snapLb(kgToLb(kg)) : kg);
/** Lo que la persona escribe en su unidad, a kg para guardar. Las libras se redondean a 2.5 lb (3 decimales en kg). */
export const loadKg = (v: number, units: Units) => (units === "imperial" ? Math.round(lbToKg(snapLb(v)) * 1000) / 1000 : v);

/** Estatura guardada en cm: "175 cm" o "5 ft 9 in". */
export function fmtHeight(cm: number, units: Units, locale: Locale) {
  if (units === "metric") return `${fmtNumber(cm, locale, 0)} cm`;
  const { ft, in: inches } = cmToFtIn(cm);
  return `${ft} ft ${inches} in`;
}

/** Fecha corta del idioma: "8 nov" / "Nov 8". */
export const fmtDate = (d: Date | string, locale: Locale, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  new Date(d).toLocaleDateString(locale, opts);
