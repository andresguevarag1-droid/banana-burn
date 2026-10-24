"use client";
// Escucha errores sueltos del navegador (window.onerror y promesas sin catch) y los manda, limpios y muestreados, a
// /api/errores. No dibuja nada. Va en el layout raíz: cubre marketing, app y panel.
import { useEffect } from "react";
import { installReporter } from "@/lib/monitor/client";

/** Archivo donde nació el error (primer script del stack o ev.filename). Sin query: scrubMessage lo deja en host + ruta. */
export function errorOrigin(stack: unknown, filename?: unknown): string | null {
  const f = typeof filename === "string" && /^https?:\/\//.test(filename) ? filename : null;
  const m = typeof stack === "string" ? stack.match(/https?:\/\/[^\s)"']+/) : null;
  const u = f ?? m?.[0] ?? null;
  return u ? u.replace(/[?#].*$/, "").replace(/:\d+(:\d+)?$/, "") : null;
}

/** Nombre y mensaje del error, con su origen al final para distinguir el código propio de scripts externos (p. ej. el píxel). */
function withOrigin(err: { name?: unknown; message?: unknown; stack?: unknown } | null | undefined, fallback: string, filename?: unknown) {
  const name = typeof err?.name === "string" ? err.name : "Error";
  const message = typeof err?.message === "string" ? err.message : fallback;
  const where = errorOrigin(err?.stack, filename);
  return { name, message: where ? `${message} (en ${where})` : message, digest: (err as { digest?: unknown } | undefined)?.digest };
}

export function ErrorReporter({ release }: { release: string }) {
  useEffect(() => {
    const report = installReporter(release || null);
    const onError = (ev: ErrorEvent) => {
      // Scripts de otros dominios llegan como "Script error." sin detalle: no sirven (isNoise los descarta).
      report("client", withOrigin(ev.error as Error | undefined, ev.message, ev.filename));
    };
    const onRejection = (ev: PromiseRejectionEvent) => {
      const r = ev.reason as { name?: unknown; message?: unknown; stack?: unknown } | undefined;
      report("client", r && typeof r === "object" ? withOrigin(r, "") : { name: "unhandledrejection", message: String(r ?? "") });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onRejection); };
  }, [release]);
  return null;
}
