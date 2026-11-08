"use client";
// Idioma en los componentes de cliente (#287). El servidor decide el idioma (src/lib/i18n/server.ts) y lo pasa al
// proveedor; sin proveedor todo sale en español, como siempre.
import { createContext, useContext, useMemo } from "react";
import { DEFAULT_LOCALE, defaultUnits, type Locale, type Units } from "./locale";
import { tr, type T } from "./t";

const Ctx = createContext<{ locale: Locale; units: Units }>({ locale: DEFAULT_LOCALE, units: "metric" });

export function LocaleProvider({ locale, units, children }: { locale: Locale; units?: Units; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, units: units ?? defaultUnits(locale) }), [locale, units]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useLocale = () => useContext(Ctx).locale;
export const useUnits = () => useContext(Ctx).units;
export function useT(): T {
  const locale = useLocale();
  return useMemo(() => tr(locale), [locale]);
}
