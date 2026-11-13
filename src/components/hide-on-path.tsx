"use client";
import { usePathname } from "next/navigation";

/** "¿Entrenamos ahora?" al terminar la bienvenida (#315): sin avisos ni cinta del programa antes del botón de empezar. */
export const FIRST_WORKOUT_PATH = "/app/primer-entreno";

/** Oculta lo de adentro en una ruta exacta (p. ej. el aviso de la prueba en Hoy, donde ya está el banner de la tarjeta). */
export function HideOnPath({ path, children }: { path: string; children: React.ReactNode }) {
  return usePathname() === path ? null : <>{children}</>;
}
