// Monitoreo del lado del servidor: guarda errores en app_errors (0041), registra la última corrida del cron y manda un
// aviso al dueño si los errores se disparan. Todo es no-op sin SUPABASE_SERVICE_ROLE_KEY (o sin la migración 0041).
import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { keyPart } from "@/lib/security/db-rate-limit";
import { errCode, jsonLog } from "@/lib/log";
import { commitSha } from "@/lib/version";
import type { ErrorReport } from "./report";
import { byRoute, type ErrorRow } from "./summary";

type Db = NonNullable<ReturnType<typeof adminClient>>;
const MISSING = new Set(["PGRST202", "PGRST205", "42883", "42P01"]);

/** Freno por instancia para errores del servidor: un bucle de fallas no hace miles de llamadas a la base. */
const bucket = { n: 0, reset: 0 };
export function serverBudget(now = Date.now(), max = 20, windowMs = 60_000): boolean {
  if (bucket.reset <= now) { bucket.n = 0; bucket.reset = now + windowMs; }
  if (bucket.n >= max) return false;
  bucket.n++;
  return true;
}

/** Guarda un reporte ya limpio. `clientKey` = algo del cliente (IP) que se convierte en hash para el límite de la base. */
export async function storeReport(r: ErrorReport, clientKey: string | null, db: Db | null = adminClient()): Promise<"stored" | "dropped" | "skipped"> {
  if (!db) return "skipped";
  try {
    const { data, error } = await db.rpc("app_error_report", {
      p_source: r.source, p_kind: r.kind, p_route: r.route, p_message: r.message, p_digest: r.digest,
      p_release: r.release, p_browser: r.browser, p_key: clientKey ? keyPart(clientKey) : null,
    });
    if (error) {
      // console directo (no logError): si guardar un error falla, no se intenta guardar ese otro error.
      if (!MISSING.has(error.code ?? "")) console.warn(jsonLog("warn", "monitor", "store_failed", { kind: error.code ?? "error" }));
      return "skipped";
    }
    return data === true ? "stored" : "dropped";
  } catch (e) {
    console.warn(jsonLog("warn", "monitor", "store_failed", { kind: errCode(e) }));
    return "skipped";
  }
}

/** Error del servidor (logError o onRequestError): solo área/ruta y código, nunca el mensaje crudo. */
export function recordServerError(route: string, kind: string, digest?: string | null) {
  if (!serverBudget()) return;
  const r: ErrorReport = { source: "server", kind: kind.slice(0, 40) || "error", route: route.slice(0, 120) || "/", message: "", digest: digest ?? null, release: commitSha(), browser: null };
  void storeReport(r, null);
}

/** Última corrida de una tarea (para /admin/salud). */
export async function beat(name: string, ok: boolean, ms: number, detail: Record<string, number | string | boolean | null> = {}, db: Db | null = adminClient()) {
  if (!db) return;
  const { error } = await db.from("ops_heartbeats").upsert({ name, ok, ms: Math.max(0, Math.round(ms)), detail, last_at: new Date().toISOString() }, { onConflict: "name" });
  if (error && !MISSING.has(error.code ?? "")) console.warn(jsonLog("warn", "monitor", "beat_failed", { kind: error.code ?? "error" }));
}

/** Umbral de errores en 24 h para mandar el aviso. OPS_ALERT_THRESHOLD lo cambia (mínimo 5). */
export const alertThreshold = (env: Record<string, string | undefined> = process.env) => {
  const n = Number(env.OPS_ALERT_THRESHOLD);
  return Number.isFinite(n) && n >= 5 ? Math.round(n) : 50;
};

/**
 * Mantenimiento diario (lo llama el cron): borra errores de más de 30 días y, si en 24 h hubo más errores que el
 * umbral, manda un correo al dueño (una vez por día, Idempotency-Key). Sin Resend o sin service_role: no hace nada.
 */
export async function runMonitorMaintenance(now = new Date(), db: Db | null = adminClient()) {
  if (!db) return { purged: 0, errors24h: null as number | null, alert: false };
  let purged = 0;
  const p = await db.rpc("app_errors_purge", { p_days: 30 });
  if (!p.error && typeof p.data === "number") purged = p.data;
  // El resumen del panel exige sesión de admin; aquí se lee la tabla con service_role.
  const since = new Date(now.getTime() - 24 * 3600_000).toISOString();
  const { data, error } = await db.from("app_errors").select("source,kind,route,message,hits,last_at").gte("last_at", since).limit(2000);
  if (error) return { purged, errors24h: null, alert: false };
  const rows = (data ?? []) as ErrorRow[];
  const total = rows.reduce((a, r) => a + Number(r.hits || 0), 0);
  let alert = false;
  if (total >= alertThreshold()) {
    const { sendEmail } = await import("@/lib/email/send");
    const { opsAlertEmail } = await import("./alert-email");
    const to = process.env.OPS_ALERT_EMAIL || process.env.FEEDBACK_EMAIL || "hola@bananaburn.app";
    const r = await sendEmail(to, opsAlertEmail(total, byRoute(rows).slice(0, 8), commitSha()), { idempotencyKey: `ops-alerta:${now.toISOString().slice(0, 10)}`, tags: { tipo: "ops_alerta" } });
    alert = r.ok;
  }
  return { purged, errors24h: total, alert };
}
