// Parte de instrumentation.ts que solo corre en el runtime de Node (usa la base con service_role).
import { errCode, jsonLog, setErrorSink } from "@/lib/log";
import { cleanRoute } from "./report";
import { recordServerError } from "./server";
import { cronFailed, cronFromRoute } from "./alerts";

/** Cada logError del servidor también se cuenta en /admin/salud (área = "ruta", código = "tipo"). */
export function installServerMonitor() {
  setErrorSink((area, code) => recordServerError(area, code));
}

type Req = { path: string; method: string };
type Ctx = { routerKind: string; routePath: string; routeType: string };

/**
 * Error no atrapado de Next: log JSON + fila en app_errors. Sin mensaje, headers ni cuerpo. Si cortó un cron (cobros,
 * avisos, recordatorios), también el aviso de sistema en Admin > Avisos.
 */
export async function reportRequestError(err: unknown, request: Req, context: Ctx) {
  const e = err as { digest?: unknown };
  const digest = typeof e.digest === "string" ? e.digest.slice(0, 64) : null;
  const route = context.routePath || cleanRoute(request.path);
  const code = errCode(err);
  console.error(jsonLog("error", "next", code, { route, method: request.method, routerKind: context.routerKind, routeType: context.routeType, digest }));
  recordServerError(route, `${context.routeType}:${code}`.slice(0, 40), digest);
  const cron = cronFromRoute(route);
  if (cron) await cronFailed(cron, { excepcion: true, tipo: code });
}
