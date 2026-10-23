"use server";
import { createClient, getViewer } from "@/lib/supabase/server";
import { isNewer, isReleaseId } from "@/lib/novedades";

type Result = { ok: boolean; demo?: boolean };

/**
 * La persona vio "Lo nuevo en Banana Burn" (o abrió Novedades) hasta esta versión. Solo marca su propia cuenta
 * (RPC con auth.uid(), 0036). Nunca vuelve atrás: si ya vio una más nueva, no cambia nada.
 */
export async function markNewsSeen(id: string): Promise<Result> {
  const v = await getViewer();
  if (!v || !isReleaseId(id)) return { ok: false };
  if (v.demo) return { ok: true, demo: true };
  const sb = await createClient();
  const { data, error: readErr } = await sb.from("profiles").select("news_seen").eq("id", v.id).maybeSingle();
  if (readErr) return { ok: false };
  if (!isNewer(id, (data?.news_seen as string | null) ?? null)) return { ok: true };
  const { error } = await sb.rpc("news_mark_seen", { p_id: id });
  return { ok: !error };
}
