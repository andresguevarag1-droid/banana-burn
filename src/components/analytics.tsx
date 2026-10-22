"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { FunnelEvent, FunnelProps } from "@/app/api/track/event";

/**
 * Analítica ligera del embudo, sin terceros: un beacon a /api/track (que hoy solo registra en el log del servidor).
 * Nunca rompe la página: si el navegador no tiene sendBeacon o falla, no pasa nada.
 */
export function track(name: FunnelEvent, props: FunnelProps = {}) {
  try {
    if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") return;
    const body = JSON.stringify({ name, props: { path: location.pathname, ...props } });
    navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
  } catch { /* sin analítica */ }
}

/**
 * Escucha los clics en cualquier elemento con `data-cta` (ya existen en la landing, precios, registro y pagos)
 * y, opcionalmente, registra una vista de la página. Un solo listener por página: no agrega JS por botón.
 */
export function FunnelTracker({ view, props, perPath = false }: { view?: FunnelEvent; props?: FunnelProps; perPath?: boolean }) {
  const path = usePathname();
  // `perPath`: en un layout que no se desmonta (la landing), la vista se registra en cada cambio de ruta.
  const key = perPath ? path : "";
  useEffect(() => {
    if (view) track(view, props);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Varios FunnelTracker en la misma pantalla comparten un solo listener: cada clic cuenta una vez.
    if (mounted++ === 0) document.addEventListener("click", onCtaClick, { capture: true, passive: true });
    return () => { if (--mounted === 0) document.removeEventListener("click", onCtaClick, { capture: true }); };
  }, []);
  return null;
}

let mounted = 0;
function onCtaClick(e: MouseEvent) {
  const el = (e.target as Element | null)?.closest?.("[data-cta]");
  const cta = el?.getAttribute("data-cta");
  if (cta) track("cta_click", { cta });
}
