// Nombres que cambian con el idioma y no son frases: días, meses, países y planes (#287).
import { DAY_NAMES } from "@/lib/engine/data";
import { DEFAULT_LOCALE, type Locale } from "./locale";
import { translate } from "./t";
import { EXERCISE_NAMES } from "./en/workout";

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
 * Nombre de un ejercicio para mostrar (#300). Los del motor van por slug (EXERCISE_NAMES); los de la biblioteca
 * ("ds:0001") traen su nombre original en inglés (`en`). El slug nunca cambia: solo el nombre en pantalla.
 */
export function exerciseName(id: string, es: string, locale: Locale, en?: string | null): string {
  if (locale === DEFAULT_LOCALE) return es;
  const named = (EXERCISE_NAMES as Record<string, string>)[id];
  if (named) return named;
  if (en) return en[0].toUpperCase() + en.slice(1);
  return translate(locale, es);
}
