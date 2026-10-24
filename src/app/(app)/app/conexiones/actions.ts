"use server";
import { createClient, getViewer } from "@/lib/supabase/server";
import { DEVICES, type DeviceId } from "./devices";
import { limitError } from "@/lib/security/limits";

/** Voto de interés por un reloj (tabla device_interest de 0013). Sirve para priorizar qué conectar primero. */
export async function setDeviceInterest(device: DeviceId, on: boolean): Promise<{ ok: boolean; demo?: boolean; error?: string }> {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar." };
  { const lim = v.demo ? null : await limitError("registro", v.id); if (lim) return { ok: false, error: lim }; }
  if (!DEVICES.some((d) => d.id === device)) return { ok: false, error: "Ese reloj no está en la lista." };
  if (v.demo) return { ok: true, demo: true };
  const sb = await createClient();
  const r = on
    ? await sb.from("device_interest").upsert({ user_id: v.id, device }, { onConflict: "user_id,device", ignoreDuplicates: true })
    : await sb.from("device_interest").delete().eq("user_id", v.id).eq("device", device);
  return r.error ? { ok: false, error: "No pudimos guardar tu voto. Intenta de nuevo." } : { ok: true };
}
