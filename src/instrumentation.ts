// Ganchos de Next al iniciar el servidor y ante errores no atrapados (route handlers, server actions, páginas).
// Sin terceros: una línea JSON en el log de Vercel y, si hay service_role, una fila en app_errors (0041).
// Nunca el mensaje del error ni datos de la petición (headers, cookies, cuerpo): solo código, ruta y digest.
// Este archivo también se compila para el runtime edge (middleware): lo de Node se importa SOLO dentro de
// `if (process.env.NEXT_RUNTIME === "nodejs")`, que Next reemplaza al compilar y elimina del bundle edge.
import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { installServerMonitor } = await import("./lib/monitor/node");
    installServerMonitor();
  }
}

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { reportRequestError } = await import("./lib/monitor/node");
    reportRequestError(err, request, context);
  } else {
    // Edge: solo la línea del log, con lo mínimo.
    const e = err as { name?: unknown; digest?: unknown };
    console.error(JSON.stringify({ level: "error", area: "next", code: typeof e.name === "string" ? e.name.slice(0, 40) : "error", routeType: context.routeType, route: context.routePath, digest: typeof e.digest === "string" ? e.digest.slice(0, 64) : null }));
  }
};
