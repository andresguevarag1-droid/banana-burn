import "server-only";
// Métrica de LinkApp para el admin: cuántas personas abrieron la app instalada (0046) y cuántas tienen avisos activos
// (push_subscriptions). Solo service_role. Nunca rompe la página: sin datos devuelve null.
import { adminClient } from "@/lib/supabase/admin";

export type InstallStats = { users: number; installed: number; installed7: number; push: number };

export async function getInstallStats(): Promise<InstallStats | null> {
  const db = adminClient();
  if (!db) return null;
  try {
    const week = new Date(Date.now() - 7 * 864e5).toISOString();
    const [u, i, i7, p] = await Promise.all([
      db.from("profiles").select("id", { count: "exact", head: true }),
      db.from("profiles").select("id", { count: "exact", head: true }).not("app_installed_at", "is", null),
      db.from("profiles").select("id", { count: "exact", head: true }).gte("app_installed_at", week),
      db.from("push_subscriptions").select("user_id").limit(10000),
    ]);
    if (u.error || i.error) return null;
    const push = new Set(((p.data as { user_id: string }[] | null) ?? []).map((r) => r.user_id)).size;
    return { users: u.count ?? 0, installed: i.count ?? 0, installed7: i7.count ?? 0, push };
  } catch { return null; }
}
