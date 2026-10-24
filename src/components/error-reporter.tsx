"use client";
// Escucha errores sueltos del navegador (window.onerror y promesas sin catch) y los manda, limpios y muestreados, a
// /api/errores. No dibuja nada. Va en el layout raíz: cubre marketing, app y panel.
import { useEffect } from "react";
import { installReporter } from "@/lib/monitor/client";

export function ErrorReporter({ release }: { release: string }) {
  useEffect(() => {
    const report = installReporter(release || null);
    const onError = (ev: ErrorEvent) => {
      // Scripts de otros dominios llegan como "Script error." sin detalle: no sirven (isNoise los descarta).
      report("client", ev.error ?? { name: "Error", message: ev.message });
    };
    const onRejection = (ev: PromiseRejectionEvent) => {
      const r = ev.reason as { name?: unknown; message?: unknown } | undefined;
      report("client", r && typeof r === "object" ? r : { name: "unhandledrejection", message: String(r ?? "") });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onRejection); };
  }, [release]);
  return null;
}
