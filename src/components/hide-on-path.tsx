"use client";
import { usePathname } from "next/navigation";

/** Oculta lo de adentro en una ruta exacta (p. ej. el aviso de la prueba en Hoy, donde ya está el banner de la tarjeta). */
export function HideOnPath({ path, children }: { path: string; children: React.ReactNode }) {
  return usePathname() === path ? null : <>{children}</>;
}
