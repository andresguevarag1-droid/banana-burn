// Nombres que cambian con el idioma y no son frases: días, meses, países y planes (#287).
import { DAY_NAMES, type ExerciseId } from "@/lib/engine/data";
import { DEFAULT_LOCALE, type Locale } from "./locale";
import { translate } from "./t";
import { EXERCISES } from "./en/workout";

const EN_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const EN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ES_MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Día de la semana (0 = domingo), igual que DAY_NAMES en español. */
export const dayName = (dow: number, locale: Locale) => (locale === DEFAULT_LOCALE ? DAY_NAMES[dow] : EN_DAYS[dow]);
export const monthNames = (locale: Locale) => (locale === DEFAULT_LOCALE ? ES_MONTHS : EN_MONTHS);

/** País por su código; en inglés, el nombre de Intl ("Costa Rica", "United States"). */
export function countryName(code: string, es: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE) return es;
  if (code === "OT") return "Other country";
  try {
    return new Intl.DisplayNames(["en-US"], { type: "region" }).of(code) ?? es;
  } catch {
    return es;
  }
}

/** Nombre del plan para mostrar: "Entreno" es "Training" en inglés. El id y los precios no cambian. */
export const planName = (es: string, locale: Locale) => translate(locale, es);

/** Nombre de una rutina del motor: los fijos van por diccionario; "Exprés 10 min" se arma con sus minutos. */
export function routineName(name: string, locale: Locale): string {
  const m = /^Exprés (\d+) min$/.exec(name);
  return m ? translate(locale, "Exprés {m} min", { m: m[1] }) : translate(locale, name);
}

/**
 * Nombre de un ejercicio en el idioma de la persona (#295). Primero por su id (el slug del motor, src/lib/i18n/en/workout.ts);
 * los ejercicios de programas y retos que no están en el motor buscan su nombre en español en el diccionario.
 */
export function exerciseName(id: string | null | undefined, es: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE) return es;
  return (id && id in EXERCISES ? EXERCISES[id as ExerciseId] : null) ?? translate(locale, es);
}
