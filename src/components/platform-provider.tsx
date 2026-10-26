"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import { appPlatform, type AppPlatform } from "@/lib/platform";

// Plataforma para componentes de cliente, igual en el servidor y en el navegador (sin desajustes al hidratar).
// El layout que ya es dinámico la lee del servidor (requestPlatform) y la pone aquí; fuera de un PlatformProvider se
// detecta en el navegador después de hidratar (en el servidor y en el primer render vale "web").

const Ctx = createContext<AppPlatform | null>(null);

export function PlatformProvider({ value, children }: { value: AppPlatform; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const noop = () => () => {};

export function useAppPlatform(): AppPlatform {
  const fromServer = useContext(Ctx);
  const detected = useSyncExternalStore(noop, appPlatform, () => "web" as AppPlatform);
  // Si el servidor dijo "web" pero el puente nativo existe (user agent recortado por algún proxy), manda el puente.
  return fromServer && fromServer !== "web" ? fromServer : detected;
}

export const useIsNativeApp = () => useAppPlatform() !== "web";
