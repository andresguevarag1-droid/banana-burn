import { NextResponse } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isDemoMode, isSupabaseConfigured } from "@/lib/env";
import { integrationsFrom, missingFor } from "@/lib/health";
import { isOnvoConfigured, isOnvoOneTimeReady } from "@/lib/onvo";
import { bearerOk, clientIp, memoryRateLimit } from "@/lib/security";
import { getViewer, STAFF } from "@/lib/supabase/server";
import { errCode, logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

/** Última respuesta de Supabase por instancia (10 s): golpear /api/salud no se multiplica en llamadas a Supabase. */
let lastPing: { at: number; p: Promise<{ ok: boolean; ms: number | null }> } | null = null;
function pingCached() {
  if (!lastPing || Date.now() - lastPing.at > 10_000) lastPing = { at: Date.now(), p: pingSupabase() };
  return lastPing.p;
}

/** ¿Responde Supabase? Pregunta al endpoint de salud de Auth (no toca datos ni la RLS), con tiempo límite corto. */
async function pingSupabase(): Promise<{ ok: boolean; ms: number | null }> {
  if (!isSupabaseConfigured) return { ok: false, ms: null };
  const t0 = Date.now();
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/health`, { headers: { apikey: SUPABASE_ANON_KEY }, cache: "no-store", signal: AbortSignal.timeout(3_000) });
    return { ok: r.ok, ms: Date.now() - t0 };
  } catch (e) {
    logError("salud", "supabase_unreachable", { kind: errCode(e) });
    return { ok: false, ms: null };
  }
}

/**
 * Salud de la app. Público: solo `{ ok }` (sin detalles). Con sesión de staff o `Authorization: Bearer CRON_SECRET`
 * (monitores externos): qué integraciones están configuradas (booleanos) y si Supabase responde.
 */
export async function GET(req: Request) {
  const monitor0 = bearerOk(req.headers.get("authorization"), process.env.CRON_SECRET);
  if (!monitor0 && !memoryRateLimit(`salud:${clientIp(req)}`, 30, 60_000)) return NextResponse.json({ ok: false, error: "Demasiadas consultas." }, { status: 429, headers: { ...noStore, "Retry-After": "60" } });
  const db = await (monitor0 ? pingSupabase() : pingCached());
  const ok = isDemoMode || db.ok;
  const monitor = monitor0;
  const v = monitor ? null : await getViewer().catch(() => null);
  const staff = monitor || (!!v && !v.demo && STAFF.includes(v.role));
  if (!staff) return NextResponse.json({ ok }, { status: ok ? 200 : 503, headers: noStore });
  const integrations = integrationsFrom(process.env, { full: isOnvoConfigured(), oneTime: isOnvoOneTimeReady() });
  return NextResponse.json({
    ok, demo: isDemoMode, supabaseUp: db.ok, supabaseMs: db.ms, integrations, missing: missingFor(integrations),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null, at: new Date().toISOString(),
  }, { status: ok ? 200 : 503, headers: noStore });
}
