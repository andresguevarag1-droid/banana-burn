// Envío de errores desde el navegador a /api/errores. Muestreado, con tope por página y sin repetir el mismo error.
// No manda nada del usuario: tipo, mensaje limpio, ruta sin ids, digest y versión (ver report.ts).
import { cleanRoute, fingerprint, isNoise, scrubMessage, type ReportSource } from "./report";

export const ENDPOINT = "/api/errores";
/** Máximo de reportes por carga de página (un bucle de errores no inunda al servidor). */
export const MAX_PER_PAGE = 5;
/** Muestreo: los errores de pantalla (boundary) siempre; los sueltos del navegador, la mitad. */
export const SAMPLE: Record<Exclude<ReportSource, "server">, number> = { boundary: 1, client: 0.5 };

export type Transport = (url: string, body: string) => void;

/** sendBeacon (sobrevive al cierre de la pestaña) o fetch keepalive. */
export const beaconTransport: Transport = (url, body) => {
  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon?.(url, new Blob([body], { type: "application/json" }))) return;
    void fetch(url, { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" }, credentials: "same-origin" }).catch(() => {});
  } catch { /* reportar un error nunca debe causar otro */ }
};

export function createReporter(opts: { release: string | null; transport?: Transport; random?: () => number; path?: () => string }) {
  const seen = new Set<string>();
  let sent = 0;
  const transport = opts.transport ?? beaconTransport;
  const random = opts.random ?? Math.random;
  const path = opts.path ?? (() => (typeof location === "undefined" ? "/" : location.pathname));

  /** Devuelve true si se mandó. */
  return function report(source: Exclude<ReportSource, "server">, err: unknown): boolean {
    const e = (err && typeof err === "object" ? err : { message: String(err ?? "") }) as { name?: unknown; message?: unknown; digest?: unknown };
    const kind = typeof e.name === "string" && /^[A-Za-z][A-Za-z0-9_.:-]{0,39}$/.test(e.name) ? e.name : "Error";
    const message = scrubMessage(typeof e.message === "string" ? e.message : "");
    const digest = typeof e.digest === "string" ? e.digest.slice(0, 64) : null;
    if ((!message && !digest) || isNoise(message, kind)) return false;
    const route = cleanRoute(path());
    const fp = fingerprint({ source, kind, route, message });
    if (seen.has(fp) || sent >= MAX_PER_PAGE) return false;
    seen.add(fp);
    if (random() >= SAMPLE[source]) return false;
    sent++;
    try { transport(ENDPOINT, JSON.stringify({ source, kind, message, route, digest, release: opts.release || null })); } catch { return false; }
    return true;
  };
}

// Instancia única de la página (la crea ErrorReporter; los error boundaries la usan con reportBoundaryError).
let current: ReturnType<typeof createReporter> | null = null;
export function installReporter(release: string | null) {
  if (!current) current = createReporter({ release });
  return current;
}
export function reportBoundaryError(err: unknown) {
  try { (current ?? installReporter(null))("boundary", err); } catch { /* nunca rompe la pantalla de error */ }
}
