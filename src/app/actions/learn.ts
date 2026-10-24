"use server";
import { createClient, getViewer } from "@/lib/supabase/server";
import { isLearnKey } from "@/lib/primeros-pasos";

/** Marca un paso, una lección o un recorrido como hecho. Solo la cuenta propia (RPC con auth.uid(), 0046). */
export async function markLearn(key: string): Promise<{ ok: boolean }> {
  const v = await getViewer();
  if (!v || !isLearnKey(key)) return { ok: false };
  if (v.demo) return { ok: true };
  const { error } = await (await createClient()).rpc("learn_mark", { p_key: key });
  return { ok: !error };
}
