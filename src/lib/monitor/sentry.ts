// Opciones de Sentry para el navegador, el servidor y el edge (instrumentation*.ts). Sin datos personales:
// sendDefaultPii apagado y, antes de mandar cada evento, se borran usuario, cabeceras, cookies, cuerpo, query string y
// extras, y los mensajes y URLs pasan por la misma limpieza que app_errors (report.ts). Sin trazas ni Session Replay:
// solo errores con su stack (legible gracias a los mapas de fuente que se suben en el build y nunca se publican).
// Sin DSN (local, CI, pruebas) Sentry queda apagado.
import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";
import { cleanRoute, scrubMessage } from "./report";

/** URL sin query, hash ni datos en la ruta: "https://www.bananaburn.app/c/ABC123?x=1" -> "www.bananaburn.app/c/:id". */
export function scrubUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !raw) return undefined;
  try {
    const u = new URL(raw);
    return `${u.host}${cleanRoute(u.pathname)}`;
  } catch {
    return cleanRoute(raw);
  }
}

const KEEP_CRUMB_DATA = new Set(["method", "status_code", "url", "from", "to"]);

/** Breadcrumb sin datos: mensaje limpio y solo método, estado y URLs limpias. */
export function scrubBreadcrumb(b: Breadcrumb): Breadcrumb | null {
  const out: Breadcrumb = { ...b };
  if (out.message) out.message = scrubMessage(out.message, 200);
  if (out.data) {
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(out.data)) {
      if (!KEEP_CRUMB_DATA.has(k)) continue;
      data[k] = k === "url" || k === "from" || k === "to" ? scrubUrl(v) : v;
    }
    out.data = data;
  }
  return out;
}

/** Evento sin datos personales. Se aplica en beforeSend (navegador, servidor y edge). */
export function scrubEvent<E extends ErrorEvent>(e: E): E {
  e.user = undefined;
  e.extra = undefined;
  e.server_name = undefined;
  if (e.request) e.request = { method: e.request.method, url: scrubUrl(e.request.url) };
  if (e.message) e.message = scrubMessage(e.message, 500);
  if (e.transaction) e.transaction = scrubMessage(e.transaction, 200);
  if (e.logentry?.message) e.logentry = { message: scrubMessage(e.logentry.message, 500) };
  for (const v of e.exception?.values ?? []) {
    if (v.value) v.value = scrubMessage(v.value, 500);
    for (const f of v.stacktrace?.frames ?? []) f.vars = undefined;
  }
  if (e.breadcrumbs) e.breadcrumbs = e.breadcrumbs.map(scrubBreadcrumb).filter((b): b is Breadcrumb => b !== null);
  if (e.tags) for (const k of Object.keys(e.tags)) if (/url|user|email/i.test(k)) delete e.tags[k];
  return e;
}

/** Entorno de Vercel (production, preview, development) o "local". */
const environment = (env: string | undefined) => (env === "production" || env === "preview" || env === "development" ? env : "local");

/** Opciones comunes. `dsn` vacío = Sentry apagado. */
export function sentryOptions(dsn: string | undefined, vercelEnv: string | undefined) {
  const d = dsn?.trim() || undefined;
  return {
    dsn: d,
    enabled: Boolean(d),
    environment: environment(vercelEnv),
    sendDefaultPii: false,
    maxBreadcrumbs: 30,
    // Solo errores: sin trazas (las URLs de las trazas traen ids) y sin Session Replay.
    tracesSampleRate: 0,
    beforeSend: (e: ErrorEvent) => scrubEvent(e),
    beforeSendTransaction: () => null,
    beforeBreadcrumb: (b: Breadcrumb) => scrubBreadcrumb(b),
  };
}
