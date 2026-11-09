// Idiomas de Banana Burn (#287). El español latino (es-419) es el predeterminado y el texto fuente de la app; el inglés
// de Estados Unidos (en-US) es una traducción encima (src/lib/i18n/en). Sin dependencias: sirve en el middleware, en el
// servidor y en el navegador.

export const LOCALES = ["es-419", "en-US"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es-419";

/** Cookie con el idioma elegido por la URL (/en) o por el selector del pie de la portada. Un año. */
export const LOCALE_COOKIE = "bb_idioma";
export const LOCALE_COOKIE_MAX_AGE = 365 * 24 * 3600;

export const isLocale = (x: unknown): x is Locale => x === "es-419" || x === "en-US";

/** Valor de `<html lang>` y de Open Graph. */
export const htmlLang = (l: Locale) => (l === "en-US" ? "en-US" : "es-419");

/** Prefijo de las páginas públicas en inglés: /en, /en/pricing. El español vive en la raíz. */
export const EN_PREFIX = "/en";

/** El idioma que dice la URL: solo /en y lo que cuelga de /en. Cualquier otra ruta no decide. */
export function localeFromPath(path: string | null | undefined): Locale | null {
  if (!path) return null;
  return path === EN_PREFIX || path.startsWith(`${EN_PREFIX}/`) ? "en-US" : null;
}

/**
 * Idioma según Accept-Language, con cuidado: muchas personas de Latinoamérica (y casi todos los hispanohablantes de
 * Estados Unidos, el público de los anuncios de hoy) tienen el teléfono en inglés. Por eso el inglés solo gana si es
 * la primera preferencia y el español no aparece en ninguna parte de la cabecera. Sin cabecera o sin coincidencia: null.
 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const langs = header
    .split(",")
    .map((part, i) => {
      const [tag, ...params] = part.trim().toLowerCase().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const weight = q ? Number(q.slice(2)) : 1;
      return { tag: tag.trim(), q: Number.isFinite(weight) ? weight : 0, i };
    })
    .filter((x) => x.tag && x.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i);
  if (!langs.length) return null;
  const base = (t: string) => t.split("-")[0];
  if (langs.some((x) => base(x.tag) === "es")) return "es-419";
  return base(langs[0].tag) === "en" ? "en-US" : null;
}

export type LocaleInputs = {
  /** profiles.locale: lo que la persona eligió (bienvenida o Perfil). Manda sobre todo. */
  profile?: string | null;
  /** Ruta de la página (/en, /en/pricing). */
  path?: string | null;
  /** Cookie bb_idioma: la última URL pública o el selector del pie. Cuenta como la URL de una visita anterior. */
  cookie?: string | null;
  acceptLanguage?: string | null;
};

/** Orden del #287: perfil, luego la URL (y la cookie que dejó), luego Accept-Language. Si nada decide, español. */
export function resolveLocale({ profile, path, cookie, acceptLanguage }: LocaleInputs): Locale {
  if (isLocale(profile)) return profile;
  const fromPath = localeFromPath(path);
  if (fromPath) return fromPath;
  if (isLocale(cookie)) return cookie;
  return localeFromAcceptLanguage(acceptLanguage) ?? DEFAULT_LOCALE;
}

/** Sistema de unidades (profiles.units). Los datos siempre se guardan en kg y cm; esto solo cambia cómo se muestran. */
export type Units = "metric" | "imperial";
export const isUnits = (x: unknown): x is Units => x === "metric" || x === "imperial";
/** Lo que la bienvenida propone por defecto: libras y pies en inglés de EE. UU., kilos y centímetros en español. */
export const defaultUnits = (l: Locale): Units => (l === "en-US" ? "imperial" : "metric");
