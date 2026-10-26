"use client";
// Estado de instalación en el navegador: dónde está abierta, si hay botón nativo (Android) y si ya es app instalada.
import { useEffect, useState } from "react";
import { detectInstallEnv, type InstallEnv } from "@/lib/install-env";
import { isNativeApp } from "@/lib/platform";

export type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

// Chrome dispara beforeinstallprompt una sola vez y muy temprano: lo guardamos fuera de React para que cualquier
// componente que se monte después (la tarjeta de Hoy, la página Instalar) pueda usarlo.
let deferred: BIP | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as BIP; listeners.forEach((l) => l()); });
  // El service worker (push y página sin conexión) también en la landing: así Chrome ofrece instalar desde ahí.
  // En la app nativa no: sus avisos y su pantalla sin conexión son nativos.
  const sw = () => { try { if ("serviceWorker" in navigator && !isNativeApp()) navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {}); } catch { /* */ } };
  if (document.readyState === "complete") sw(); else window.addEventListener("load", sw, { once: true });
  window.addEventListener("appinstalled", () => { deferred = null; try { localStorage.setItem("bb.appInstalled", String(Date.now())); } catch { /* */ } listeners.forEach((l) => l()); });
}

/** ¿Abierta como app instalada? La LinkApp en la pantalla de inicio o la app nativa de las tiendas. */
export function isStandaloneNow() {
  if (isNativeApp()) return true;
  try { return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true; } catch { return false; }
}

export function useInstall() {
  const [env, setEnv] = useState<InstallEnv | null>(null);
  const [canPrompt, setCanPrompt] = useState(false);
  useEffect(() => {
    const read = () => {
      setEnv(detectInstallEnv(navigator.userAgent, { standalone: isStandaloneNow(), maxTouchPoints: navigator.maxTouchPoints }));
      setCanPrompt(!!deferred);
    };
    read();
    listeners.add(read);
    return () => { listeners.delete(read); };
  }, []);
  /** Abre el diálogo nativo de instalar (solo Android/Chrome/Edge). true si la persona aceptó. */
  const prompt = async () => {
    const d = deferred;
    if (!d) return false;
    await d.prompt();
    const r = await d.userChoice.catch(() => ({ outcome: "dismissed" as const }));
    deferred = null; setCanPrompt(false);
    return r.outcome === "accepted";
  };
  return { env, canPrompt, prompt };
}
