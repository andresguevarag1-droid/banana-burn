"use server";
import { createClient, getViewer } from "@/lib/supabase/server";

/** La persona cerró la bienvenida de tester: no se vuelve a mostrar (tester_mark_seen, 0029: solo sus filas). */
export async function markTesterSeen(): Promise<{ ok: boolean }> {
  const v = await getViewer();
  if (!v) return { ok: false };
  if (v.demo) return { ok: true };
  const { error } = await (await createClient()).rpc("tester_mark_seen");
  return { ok: !error };
}
