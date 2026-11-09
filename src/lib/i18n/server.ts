import "server-only";
// Idioma de la petición en el servidor (#287): perfil, URL, cookie de la URL y Accept-Language (locale.ts).
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { getViewer, createClient } from "@/lib/supabase/server";
import { LOCALE_COOKIE, defaultUnits, isUnits, resolveLocale, type Locale, type Units } from "./locale";
import { tr } from "./t";

export type Prefs = { locale: Locale; units: Units };

/** Cookie de unidades en modo demo (sin perfil donde guardarlas). */
export const UNITS_COOKIE = "bb_unidades";

/** profiles.locale y profiles.units (0070). Si la migración no corrió o falla la lectura: null, nunca un error. */
const profilePrefs = cache(async (id: string): Promise<{ locale: string | null; units: string | null } | null> => {
  try {
    const sb = await createClient();
    const { data, error } = await sb.from("profiles").select("locale, units").eq("id", id).maybeSingle();
    return error ? null : ((data as { locale: string | null; units: string | null } | null) ?? null);
  } catch {
    return null;
  }
});

/**
 * Idioma y unidades de quien mira. `path` solo hace falta en páginas públicas con prefijo (/en). Con sesión manda lo
 * que guardó en su perfil; en modo demo, la cookie (el selector la escribe igual).
 */
export const getPrefs = cache(async (path?: string): Promise<Prefs> => {
  const [jar, h] = await Promise.all([cookies(), headers()]);
  const v = await getViewer().catch(() => null);
  const p = v && !v.demo ? await profilePrefs(v.id) : null;
  const locale = resolveLocale({ profile: p?.locale, path, cookie: jar.get(LOCALE_COOKIE)?.value, acceptLanguage: h.get("accept-language") });
  const demoUnits = v?.demo ? jar.get(UNITS_COOKIE)?.value : null;
  const units = isUnits(p?.units) ? p.units : isUnits(demoUnits) ? demoUnits : defaultUnits(locale);
  return { locale, units };
});

export const getLocale = async (path?: string) => (await getPrefs(path)).locale;
export const getT = async (path?: string) => tr(await getLocale(path));
