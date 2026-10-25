"use server";
// Método de pago del referidor (SINPE Móvil o IBAN). Con su sesión: RLS solo deja escribir el propio y si es referidor activo.
import { revalidatePath } from "next/cache";
import { createClient, getViewer } from "@/lib/supabase/server";
import { limitError } from "@/lib/security/limits";

export type MethodState = { ok: boolean; msg: string } | null;

export async function saveMethod(_: MethodState, fd: FormData): Promise<MethodState> {
  const v = await getViewer();
  if (!v) return { ok: false, msg: "Tu sesión venció. Vuelve a entrar." };
  if (v.demo) return { ok: true, msg: "Guardado (demo: no se guarda nada)." };
  const lim = await limitError("cuenta:perfil", v.id);
  if (lim) return { ok: false, msg: lim };
  const kind = fd.get("kind") === "iban" ? "iban" : "sinpe";
  const holder = String(fd.get("holder_name") ?? "").trim().replace(/\s+/g, " ");
  const idNumber = String(fd.get("id_number") ?? "").replace(/\s/g, "");
  const phone = String(fd.get("sinpe_phone") ?? "").replace(/\D/g, "");
  const iban = String(fd.get("iban") ?? "").replace(/\s/g, "").toUpperCase();
  if (holder.length < 2 || holder.length > 120) return { ok: false, msg: "Escribe el nombre del titular de la cuenta." };
  if (idNumber && !/^[0-9A-Za-z-]{5,20}$/.test(idNumber)) return { ok: false, msg: "Revisa el número de identificación." };
  if (kind === "sinpe" && !/^[0-9]{8}$/.test(phone)) return { ok: false, msg: "El número de SINPE Móvil tiene 8 dígitos." };
  if (kind === "iban" && !/^[A-Z]{2}[0-9A-Z]{10,32}$/.test(iban)) return { ok: false, msg: "Revisa el IBAN (en Costa Rica empieza con CR y tiene 22 caracteres)." };
  const sb = await createClient();
  const { error } = await sb.from("affiliate_payout_methods").upsert({
    user_id: v.id, kind, holder_name: holder, id_number: idNumber || null,
    sinpe_phone: kind === "sinpe" ? phone : null, iban: kind === "iban" ? iban : null, updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) return { ok: false, msg: "No se pudo guardar. Revisa los datos o escríbenos desde Ayuda." };
  revalidatePath("/app/afiliados");
  return { ok: true, msg: "Método de pago guardado." };
}
