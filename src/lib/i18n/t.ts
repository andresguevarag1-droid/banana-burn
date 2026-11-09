// Traducción al estilo gettext (#287): el texto en español ES la clave. Así el español queda escrito tal cual en cada
// componente (es-419 es el diccionario fuente y no cambia) y el inglés vive en src/lib/i18n/en. Si una frase todavía
// no tiene traducción, sale en español: nada se rompe ni queda una clave a la vista.
import { EN } from "./en";
import { DEFAULT_LOCALE, type Locale } from "./locale";

export type Vars = Record<string, string | number>;
export type T = (es: string, vars?: Vars) => string;

const fill = (s: string, vars?: Vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s);

/** Las claves se comparan sin espacios duros: el código usa "50\u00a0%" y el diccionario puede escribir "50 %". */
const key = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");
const normalized = (d: Record<string, string>) => Object.fromEntries(Object.entries(d).map(([k, v]) => [key(k), v]));

/** Diccionario de un idioma: es-419 es la identidad (el texto fuente); en-US, la traducción. */
export const DICTIONARIES: Record<Locale, Readonly<Record<string, string>>> = { "es-419": {}, "en-US": normalized(EN) };

export function translate(locale: Locale, es: string, vars?: Vars): string {
  return fill(locale === DEFAULT_LOCALE ? es : (DICTIONARIES[locale][key(es)] ?? es), vars);
}

/** `const t = tr(locale)` y luego `t("Entrenar ahora")` o `t("Hola, {name}", { name })`. */
export const tr = (locale: Locale): T => (es, vars) => translate(locale, es, vars);

/** ¿Hay traducción para esta frase? (lo usan las pruebas para que el camino de conversión no quede a medias). */
export const hasTranslation = (locale: Locale, es: string) => locale === DEFAULT_LOCALE || key(es) in DICTIONARIES[locale];
