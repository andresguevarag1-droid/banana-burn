"use client";
// Pone el tema en <html> mientras la app lo pide (los diálogos y avisos en portales cuelgan de <body>) y cambia el color
// de la barra del navegador. Al salir (sin programa de Platanita) todo vuelve a como estaba.
import { useLayoutEffect } from "react";
import { THEME_COLOR, type AppTheme } from "@/lib/app-theme";

export function ThemeRoot({ theme }: { theme: AppTheme | null }) {
  useLayoutEffect(() => {
    if (!theme) return;
    const root = document.documentElement;
    const prevTheme = root.dataset.theme;
    root.dataset.theme = theme;
    const metas = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];
    const prev = metas.map((m) => m.content);
    metas.forEach((m) => { m.content = THEME_COLOR[theme]; });
    return () => {
      if (prevTheme) root.dataset.theme = prevTheme; else delete root.dataset.theme;
      metas.forEach((m, i) => { m.content = prev[i]; });
    };
  }, [theme]);
  return null;
}
