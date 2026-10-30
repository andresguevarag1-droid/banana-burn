// Ganchos de Next al iniciar el servidor y ante errores no atrapados (route handlers, server actions, páginas).
// Una línea JSON en el log de Vercel y, si hay service_role, una fila en app_errors (0041): nunca el mensaje del error
// ni datos de la petición (headers, cookies, cuerpo), solo código, ruta y digest. Y, si hay SENTRY_DSN, el evento en
// Sentry con su stack, ya limpio de datos personales (lib/monitor/sentry.ts).
// Este archivo también se compila para el runtime edge (middleware): lo de Node se importa SOLO dentro de
// `if (process.env.NEXT_RUNTIME === "nodejs")`, que Next reemplaza al compilar y elimina del bundle edge.
import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";
import { sentryOptions } from "./lib/monitor/sentry";

export async function register() {
  Sentry.init(sentryOptions(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN, process.env.VERCEL_ENV));
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { installServerMonitor } = await import("./lib/monitor/node");
    installServerMonitor();
    // NEXT_PUBLIC_BETA_ENDS_AT es solo para pruebas locales: la base tiene la fecha fija (_beta_ends_at, 0025) y en
    // producción la app y la base dirían cosas distintas sobre el acceso y los cobros.
    const { BETA_DATE_OVERRIDDEN, BETA_ENDS_AT } = await import("./lib/plans");
    if (BETA_DATE_OVERRIDDEN && process.env.VERCEL_ENV === "production") {
      console.warn(JSON.stringify({ level: "warn", area: "config", code: "beta_date_override", msg: "NEXT_PUBLIC_BETA_ENDS_AT está puesta en producción: la app usa otra fecha que la base. Quítala.", value: BETA_ENDS_AT }));
    }
    // Tilopay: la vuelta se firma con TILOPAY_STATE_SECRET; sin ella se usa la contraseña de la API (un secreto para dos cosas).
    if (process.env.TILOPAY_API_PASSWORD && !process.env.TILOPAY_STATE_SECRET) {
      console.warn(JSON.stringify({ level: "warn", area: "config", code: "tilopay_state_secret", msg: "Falta TILOPAY_STATE_SECRET: la vuelta de Tilopay se firma con la contraseña de la API." }));
    }
  }
}

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  Sentry.captureRequestError(err, request, context);
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { reportRequestError } = await import("./lib/monitor/node");
    reportRequestError(err, request, context);
  } else {
    // Edge: solo la línea del log, con lo mínimo.
    const e = err as { name?: unknown; digest?: unknown };
    console.error(JSON.stringify({ level: "error", area: "next", code: typeof e.name === "string" ? e.name.slice(0, 40) : "error", routeType: context.routeType, route: context.routePath, digest: typeof e.digest === "string" ? e.digest.slice(0, 64) : null }));
  }
};
