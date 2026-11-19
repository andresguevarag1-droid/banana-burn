"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { FunnelEvent, FunnelProps } from "@/app/api/track/event";
import { newEventId, startTrialParams, toMetaEvent, type StartTrial } from "@/lib/meta-pixel";
import { fbq } from "@/components/meta-pixel";

/**
 * Analítica ligera del embudo: un beacon a /api/track (log del servidor y, si hay token, API de Conversiones de Meta)
 * y el mismo evento al Meta Pixel cuando corresponde (ver src/lib/meta-pixel.ts).
 * Nunca rompe la página: si el navegador no tiene sendBeacon o falla, no pasa nada.
 */
export function track(name: FunnelEvent, props: FunnelProps = {}) {
  // Meta Pixel: mismo event_id que el beacon, para que Meta deduplique con la API de Conversiones del servidor.
  const meta = toMetaEvent(name, props);
  // Un event_id que ya trae el evento (la compra, que el servidor también manda) se respeta; si no, uno nuevo.
  const eid = meta ? (typeof props.event_id === "string" && props.event_id ? props.event_id : newEventId()) : "";
  if (meta) fbq(meta.custom ? "trackCustom" : "track", meta.name, meta.params, { eventID: eid });
  try {
    if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") return;
    const body = JSON.stringify({ name, props: { path: location.pathname, ...props, ...(eid ? { event_id: eid } : {}) } });
    navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
  } catch { /* sin analítica */ }
}

/**
 * Como track, pero una sola vez por pestaña para los eventos de ONCE_PER_ACCOUNT (registro terminado): recargar o volver a
 * la pantalla no repite el evento ni el CompleteRegistration del píxel. El servidor rechaza además el segundo de la cuenta.
 */
export function trackOnce(name: FunnelEvent, props: FunnelProps = {}) {
  const k = `bb_once_${name}`;
  try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, "1"); } catch { /* sin almacenamiento: queda el freno del servidor */ }
  track(name, props);
}

/**
 * StartTrial del píxel (#331): la tarjeta quedó guardada y empezó la prueba. Lo arma el servidor (startTrialEvent), que ya lo
 * mandó por la API de Conversiones con el mismo event_id, así que aquí no va beacon. Pasa por la cola de fbq si el píxel
 * todavía no cargó, y una sola vez por prueba en este navegador (recargar Mi plan no lo repite).
 */
export function trackStartTrial(st: StartTrial | null | undefined) {
  if (!st?.eventId) return;
  const k = `bb_st_${st.eventId}`;
  try { if (localStorage.getItem(k)) return; localStorage.setItem(k, "1"); } catch { /* sin almacenamiento: Meta deduplica por event_id */ }
  fbq("track", "StartTrial", startTrialParams(st), { eventID: st.eventId });
}

/** Manda trackStartTrial al mostrarse (Mi plan, a la vuelta de Tilopay con ?inicio=). */
export function StartTrialPixel(st: StartTrial) {
  useEffect(() => { trackStartTrial(st); }, [st.eventId]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
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
