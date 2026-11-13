// Contenido que llega armado, no desde un t("...") del código (#309): tareas de los retos ("16 flexiones en total hoy"),
// nombres de recetas y comidas, anuncios. Primero busca la frase exacta en el diccionario; si no está, prueba los patrones
// de las tareas de la siembra. Lo que no reconoce sale tal cual, en español.
import { CHALLENGE_PATTERNS } from "./en/challenges";
import { DEFAULT_LOCALE, type Locale } from "./locale";
import { hasTranslation, translate } from "./t";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const PATTERNS = CHALLENGE_PATTERNS.map(([es, en]) => {
  const names = [...es.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  const re = new RegExp(`^${es.split(/\{\w+\}/).map(esc).join("(.+?)")}$`);
  return { re, names, en };
});

/** El texto en el idioma de la cuenta, o el mismo texto si no hay traducción. */
export function translateContent(locale: Locale, es: string): string {
  if (locale === DEFAULT_LOCALE || !es) return es;
  if (hasTranslation(locale, es)) return translate(locale, es);
  for (const p of PATTERNS) {
    const m = p.re.exec(es);
    if (!m) continue;
    const vars = Object.fromEntries(p.names.map((k, i) => [k, translate(locale, m[i + 1])]));
    return p.en.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");
  }
  return es;
}

/** ¿Hay traducción para este contenido? (lo usan las pruebas del catálogo). */
export const hasContentTranslation = (locale: Locale, es: string) => locale === DEFAULT_LOCALE || translateContent(locale, es) !== es;
