"use client";
import { useEffect } from "react";
import { cleanRoute } from "@/lib/monitor/report";

type Va = (...args: unknown[]) => void;
type VaEvent = { type: string; url: string };
declare global { interface Window { va?: Va; vaq?: unknown[][] } }

/** URL que mide Vercel: sin query ni hash, y los ids o códigos de la ruta como ":id" (lib/monitor/report.ts). */
export function analyticsUrl(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.origin}${cleanRoute(u.pathname)}`;
  } catch {
    return cleanRoute(raw);
  }
}

/**
 * Vercel Web Analytics sin el paquete npm: el script lo sirve Vercel desde nuestro dominio (/_vercel/insights), así que
 * la CSP actual alcanza. Se carga después de hidratar (como el píxel de Meta) y cada visita pasa por analyticsUrl antes
 * de salir. El layout solo lo pone en builds de Vercel (en local el script no existe).
 */
export function WebAnalytics() {
  useEffect(() => {
    if (window.va) return;
    window.va = (...args: unknown[]) => { (window.vaq = window.vaq || []).push(args); };
    window.va("beforeSend", (e: VaEvent) => ({ ...e, url: analyticsUrl(e.url) }));
    const s = document.createElement("script");
    s.defer = true;
    s.src = "/_vercel/insights/script.js";
    document.head.appendChild(s);
  }, []);
  return null;
}
