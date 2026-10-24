"use server";
import { createClient, getViewer } from "@/lib/supabase/server";

/**
 * La app se abrió instalada (pantalla de inicio) en este dispositivo. Marca la cuenta propia (RPC con auth.uid(),
 * migración linkapp). Sirve para la métrica de instalación del admin y para no volver a pedir que la instale.
 */
export async function markAppInstalled(): Promise<{ ok: boolean }> {
  const v = await getViewer();
  if (!v) return { ok: false };
  if (v.demo) return { ok: true };
  const { error } = await (await createClient()).rpc("app_mark_installed");
  return { ok: !error };
}
