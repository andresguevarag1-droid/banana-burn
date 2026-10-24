// Limpieza diaria de tablas que crecen sin fin (0040: purge_housekeeping). La llama el cron; nunca lanza. SOLO SERVIDOR.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/log";

const MISSING = new Set(["PGRST202", "42883"]);

/** Borra por lotes ventanas de rate_limits, tickets del coach, registro de avisos y avisos viejos. null = no corrió. */
export async function purgeHousekeeping(opts: { db?: Pick<SupabaseClient, "rpc"> | null; limit?: number } = {}): Promise<Record<string, number> | null> {
  const db = opts.db === undefined ? adminClient() : opts.db;
  if (!db) return null;
  try {
    const { data, error } = await db.rpc("purge_housekeeping", { p_limit: opts.limit ?? 20_000 });
    if (error) {
      if (!MISSING.has(error.code ?? "")) logError("cron:limpieza", "purge_failed", { code: error.code ?? null });
      return null;
    }
    return data && typeof data === "object" ? (data as Record<string, number>) : null;
  } catch {
    return null;
  }
}
