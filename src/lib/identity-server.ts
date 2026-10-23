// Verificación de identidad en el servidor: purga diaria de fotos (minimización de datos, máximo 30 días).
import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { errCode, logError } from "@/lib/log";

const BUCKET = "identidad";

/**
 * Cron diario: vence las verificaciones sin revisar en 30 días (con aviso) y borra de Storage las fotos de lo ya
 * decidido que aún no se borró (si el borrado inmediato al decidir falló). Idempotente. Nunca registra rutas ni datos.
 */
export async function purgeIdentityFiles(opts: { deadline?: number; limit?: number } = {}): Promise<{ purged: number; errors: number; skipped?: string }> {
  const db = adminClient();
  if (!db) return { purged: 0, errors: 0, skipped: "sin service_role" };
  const { data, error } = await db.rpc("identity_purge_due", { p_limit: opts.limit ?? 200 });
  if (error) return ["PGRST202", "42883"].includes(error.code ?? "") ? { purged: 0, errors: 0, skipped: "sin 0030" } : (logError("cron:identidad", "due_failed", { code: errCode(error) }), { purged: 0, errors: 1 });
  const out = { purged: 0, errors: 0 };
  for (const r of (data ?? []) as { user_id: string; front_path: string | null; selfie_path: string | null }[]) {
    if (opts.deadline != null && Date.now() > opts.deadline) break;
    const paths = [r.front_path, r.selfie_path].filter((p): p is string => !!p);
    try {
      if (paths.length) { const { error: rm } = await db.storage.from(BUCKET).remove(paths); if (rm) throw rm; }
      const { error: mk } = await db.rpc("identity_files_purged", { p_user: r.user_id });
      if (mk) throw mk;
      out.purged++;
    } catch (e) { out.errors++; logError("cron:identidad", "purge_failed", { kind: errCode(e) }); }
  }
  return out;
}
