// Avisos de sistema al dueño (Admin > Avisos, 0059 + 0063): un cron que falla o errores por encima del umbral.
// Van a la misma bandeja (admin_events) que los pagos y registros, con una clave por día: nunca más de un aviso por
// cron y día, aunque Vercel reintente. Nunca lanza: avisar no puede romper el cron que falló.
import "server-only";
import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { crDayRange, enqueueAdminEvent, kickAdminDispatch } from "@/lib/admin-avisos-server";
import { errCode, jsonLog } from "@/lib/log";

export type CronName = "cobros" | "avisos" | "recordatorios";
type Detail = Record<string, number | string | boolean | null>;
type Opts = { db?: SupabaseClient | null; now?: Date; kick?: boolean };

/** Nombre del cron a partir de la ruta (/api/cron/cobros → "cobros"), o null si no es un cron que avisa. */
export function cronFromRoute(route: string | null | undefined): CronName | null {
  const m = /^\/api\/cron\/(cobros|avisos|recordatorios)(?:\/|$)/.exec(route ?? "");
  return m ? (m[1] as CronName) : null;
}

/** Solo conteos y banderas: los textos se recortan y no se aceptan llaves con datos de personas. */
function cleanDetail(d: Detail): Detail {
  const out: Detail = {};
  for (const [k, v] of Object.entries(d).slice(0, 8)) {
    if (/email|correo|name|nombre|token|user/i.test(k)) continue;
    out[k] = typeof v === "string" ? v.slice(0, 40) : v;
  }
  return out;
}

/**
 * Un cron terminó mal (ok false) o se cortó con un error. Manda el evento a Sentry (si hay DSN) y deja el aviso de
 * sistema para el dueño, una vez por cron y día de Costa Rica.
 */
export async function cronFailed(name: CronName, detail: Detail = {}, opts: Opts = {}): Promise<void> {
  const now = opts.now ?? new Date();
  const clean = cleanDetail(detail);
  try {
    Sentry.captureMessage(`Cron fallido: ${name}`, { level: "error", tags: { cron: name }, contexts: { cron: clean } });
    await Sentry.flush(2_000);
  } catch { /* sin Sentry igual se avisa */ }
  try {
    await enqueueAdminEvent(opts.db ?? null, { key: `sistema:cron:${name}:${crDayRange(now).label}`, kind: "sistema", userId: null, data: { motivo: "cron", cron: name, ...clean } });
    if (opts.kick !== false) await kickAdminDispatch();
  } catch (e) {
    console.warn(jsonLog("warn", "monitor", "cron_alert_failed", { cron: name, kind: errCode(e) }));
  }
}

/** Errores de 24 h por encima del umbral (OPS_ALERT_THRESHOLD): un aviso de sistema por día. */
export async function errorRateAlert(total: number, umbral: number, opts: Opts = {}): Promise<void> {
  const now = opts.now ?? new Date();
  try {
    await enqueueAdminEvent(opts.db ?? null, { key: `sistema:errores:${crDayRange(now).label}`, kind: "sistema", userId: null, data: { motivo: "errores", total, umbral } });
    if (opts.kick !== false) await kickAdminDispatch();
  } catch (e) {
    console.warn(jsonLog("warn", "monitor", "rate_alert_failed", { kind: errCode(e) }));
  }
}
