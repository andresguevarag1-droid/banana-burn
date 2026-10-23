"use server";
import { createClient, getViewer } from "@/lib/supabase/server";
import { GUIDE_VERSION, isTipKey } from "@/lib/guide";

type Result = { ok: boolean; demo?: boolean };

/** La persona vio (o saltó) la guía. Solo marca su propia cuenta (RPC con auth.uid(), 0031). */
export async function markGuideSeen(version: number = GUIDE_VERSION): Promise<Result> {
  const v = await getViewer();
  if (!v) return { ok: false };
  if (!Number.isInteger(version) || version < 1 || version > GUIDE_VERSION) return { ok: false };
  if (v.demo) return { ok: true, demo: true };
  const { error } = await (await createClient()).rpc("guide_mark_seen", { p_version: version });
  return { ok: !error };
}

/** Cerró un consejo de la primera vez. */
export async function markTipSeen(key: string): Promise<Result> {
  const v = await getViewer();
  if (!v || !isTipKey(key)) return { ok: false };
  if (v.demo) return { ok: true, demo: true };
  const { error } = await (await createClient()).rpc("guide_tip_seen", { p_key: key });
  return { ok: !error };
}
