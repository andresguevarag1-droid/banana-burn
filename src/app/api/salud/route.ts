import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/env";
import { integrationsFrom, missingFor } from "@/lib/health";
import { checkDeps } from "@/lib/health-deps";
import { isOnvoConfigured, isOnvoOneTimeReady } from "@/lib/onvo";
import { bearerOk, clientIp, memoryRateLimit } from "@/lib/security";
import { getViewer, STAFF } from "@/lib/supabase/server";
import { pingSupabase } from "@/lib/health-ping";
import { buildInfo } from "@/lib/version";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

/** Última respuesta de la base por instancia (10 s): golpear /api/salud no se multiplica en llamadas a Supabase. */
let lastPing: { at: number; p: ReturnType<typeof pingSupabase> } | null = null;
function pingCached() {
  if (!lastPing || Date.now() - lastPing.at > 10_000) lastPing = { at: Date.now(), p: pingSupabase() };
  return lastPing.p;
}

/** Lo mismo para Resend, ONVO y Tilopay (60 s): las visitas anónimas nunca multiplican llamadas a los proveedores. */
let lastDeps: { at: number; p: ReturnType<typeof checkDeps> } | null = null;
function depsCached() {
  if (!lastDeps || Date.now() - lastDeps.at > 60_000) lastDeps = { at: Date.now(), p: checkDeps() };
  return lastDeps.p;
}

/**
 * Salud de la app: base de datos, Resend, ONVO y Tilopay. `ok` es falso (503) si la base no responde o si una
 * integración configurada está caída o rechaza la llave; las que no están configuradas no cuentan.
 * Público: solo `{ ok }` (sin detalles), con respuestas guardadas unos segundos. Con sesión de staff o
 * `Authorization: Bearer CRON_SECRET` (monitores externos): el estado de cada dependencia en el momento, qué
 * integraciones están configuradas (booleanos), versión y hora. Nunca valores de llaves ni respuestas de proveedores.
 * `?probar=error` (solo staff) lanza un error a propósito para revisar Sentry.
 */
export async function GET(req: Request) {
  const monitor = bearerOk(req.headers.get("authorization"), process.env.CRON_SECRET);
  if (!monitor && !memoryRateLimit(`salud:${clientIp(req)}`, 30, 60_000)) return NextResponse.json({ ok: false, error: "Demasiadas consultas." }, { status: 429, headers: { ...noStore, "Retry-After": "60" } });
  const v = monitor ? null : await getViewer().catch(() => null);
  const staff = monitor || (!!v && !v.demo && STAFF.includes(v.role));
  // Error forzado para revisar Sentry (botón en /admin/salud). Solo staff: el público no puede generar errores.
  if (staff && new URL(req.url).searchParams.get("probar") === "error") throw new Error("Prueba de Sentry en el servidor");
  const [db, deps] = await Promise.all([staff ? pingSupabase() : pingCached(), staff ? checkDeps() : depsCached()]);
  const depsOk = Object.values(deps).every((d) => d.state !== "down");
  const ok = isDemoMode || (db.ok && depsOk);
  const status = ok ? 200 : 503;
  if (!staff) return NextResponse.json({ ok }, { status, headers: noStore });
  const integrations = integrationsFrom(process.env, { full: isOnvoConfigured(), oneTime: isOnvoOneTimeReady() });
  return NextResponse.json({
    ok, demo: isDemoMode, supabaseUp: db.ok, supabaseMs: db.ms, supabaseVia: db.via,
    checks: { db: { state: db.ok ? "up" : "down", ms: db.ms }, ...deps },
    integrations, missing: missingFor(integrations),
    version: buildInfo().commit, builtAt: buildInfo().builtAt, at: new Date().toISOString(),
  }, { status, headers: noStore });
}
