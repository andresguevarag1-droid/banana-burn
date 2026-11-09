"use client";
// #287: las páginas públicas dejan su idioma en la cookie bb_idioma (la URL decide: / es español, /en es inglés). Así
// /entrar y la bienvenida siguen en el idioma de la portada que trajo a la persona. También ajusta <html lang>, que el
// layout raíz deja en es-419 para no volver dinámicas las páginas estáticas.
import { useEffect } from "react";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, htmlLang, type Locale } from "@/lib/i18n/locale";

export function LocaleCookie({ locale }: { locale: Locale }) {
  useEffect(() => {
    try {
      document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
      document.documentElement.lang = htmlLang(locale);
    } catch { /* sin cookies */ }
  }, [locale]);
  return null;
}
