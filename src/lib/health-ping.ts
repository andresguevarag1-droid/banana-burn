// Ping de la base para /api/salud y /admin/salud. Solo servidor.
import "server-only";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/env";
import { errCode, logError } from "@/lib/log";

/**
 * ¿Responde la base? Ida y vuelta mínima a Postgres por PostgREST (health_ping de 0041: `select true`, sin leer
 * tablas), con tiempo límite corto. Sin 0041 (404) cae al endpoint de salud de Auth.
 */
export async function pingSupabase(): Promise<{ ok: boolean; ms: number | null; via: "db" | "auth" | null }> {
  if (!isSupabaseConfigured) return { ok: false, ms: null, via: null };
  const t0 = Date.now();
  const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" };
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/health_ping`, { method: "POST", headers, body: "{}", cache: "no-store", signal: AbortSignal.timeout(3_000) });
    if (r.status !== 404) return { ok: r.ok, ms: Date.now() - t0, via: "db" };
    const a = await fetch(`${SUPABASE_URL}/auth/v1/health`, { headers: { apikey: SUPABASE_ANON_KEY }, cache: "no-store", signal: AbortSignal.timeout(3_000) });
    return { ok: a.ok, ms: Date.now() - t0, via: "auth" };
  } catch (e) {
    logError("salud", "supabase_unreachable", { kind: errCode(e) });
    return { ok: false, ms: null, via: null };
  }
}
