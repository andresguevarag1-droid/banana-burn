"use server";
import { createClient, getViewer } from "@/lib/supabase/server";

/** La persona cerró la ventana de regalo: no se vuelve a mostrar (gifts_mark_seen, 0025: solo sus filas). */
export async function markGiftsSeen(): Promise<{ ok: boolean }> {
  const v = await getViewer();
  if (!v) return { ok: false };
  if (v.demo) return { ok: true };
  const { error } = await (await createClient()).rpc("gifts_mark_seen");
  return { ok: !error };
}
