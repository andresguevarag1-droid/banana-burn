"use client";
import { useMemo } from "react";
import { useLocale, useUnits } from "@/lib/i18n/client";
import { langOf, type Lang } from "./lang";

/** Idioma y unidades de quien entrena, desde el LocaleProvider de la app. Sin proveedor: español y kg. */
export function useLang(): Lang {
  const locale = useLocale(), units = useUnits();
  return useMemo(() => langOf(locale, units), [locale, units]);
}
