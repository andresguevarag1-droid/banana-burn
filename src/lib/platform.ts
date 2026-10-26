// Plataforma en el navegador: la web, la app de iPhone o la de Android. ÚNICO lugar donde se pregunta; el resto del
// código usa estas funciones (en el servidor: platform-server.ts).
//
// Usa el mismo `Capacitor.isNativePlatform()` / `Capacitor.getPlatform()` de @capacitor/core, pero desde el global que
// la app nativa inyecta antes de cualquier script de la página (window.Capacitor). Así la web no descarga Capacitor:
// en un navegador no existe y todo responde "web". El código nativo (src/lib/native/*) importa @capacitor/core y los
// plugins con import() dinámico, solo dentro de la app.
import { nativeAgentFrom, type AppPlatform, type NativePlatform } from "./platform-ua";

export type { AppPlatform, NativePlatform } from "./platform-ua";

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  isPluginAvailable?: (name: string) => boolean;
};

const bridge = (): CapacitorGlobal | null =>
  typeof window === "undefined" ? null : ((window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor ?? null);

/** Plataforma real según el puente nativo; si el puente todavía no está, según el user agent de la app. */
export function appPlatform(): AppPlatform {
  const cap = bridge();
  if (cap?.isNativePlatform?.()) {
    const p = cap.getPlatform?.();
    if (p === "ios" || p === "android") return p;
  }
  if (typeof navigator === "undefined") return "web";
  return nativeAgentFrom(navigator.userAgent)?.platform ?? "web";
}

/** ¿Estamos dentro de la app nativa (iOS o Android)? En la web siempre false. */
export const isNativeApp = (): boolean => appPlatform() !== "web";

/** Plataforma nativa o null en la web. */
export const nativePlatform = (): NativePlatform | null => {
  const p = appPlatform();
  return p === "web" ? null : p;
};

/**
 * ¿La app instalada trae este plugin? Una app vieja puede cargar una web nueva: antes de usar un plugin, se pregunta.
 * En la web siempre false.
 */
export const hasNativePlugin = (name: string): boolean => Boolean(bridge()?.isNativePlatform?.() && bridge()?.isPluginAvailable?.(name));
