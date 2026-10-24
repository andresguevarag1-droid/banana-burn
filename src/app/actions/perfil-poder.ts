"use server";
// Insignia destacada y verificación de identidad (lado de la persona). La base valida todo otra vez (0030).
import { revalidatePath } from "next/cache";
import { createClient, getViewer } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { isBadgeId } from "@/lib/profile-power";
import { validateSubmission } from "@/lib/identity";
import { COUNTRIES } from "@/lib/countries";
import { errCode, logError, logWarn } from "@/lib/log";
import { limitError } from "@/lib/security/limits";

type Res = { ok: boolean; error?: string; demo?: boolean };
const BUCKET = "identidad";

/** Destaca una insignia ganada (o ninguna con null). La base rechaza lo que no ganaste. */
export async function setFeaturedBadge(id: string | null): Promise<Res> {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar." };
  { const lim = v.demo ? null : await limitError("cuenta:perfil", v.id); if (lim) return { ok: false, error: lim }; }
  if (id !== null && !isBadgeId(id)) return { ok: false, error: "Esa insignia no existe." };
  if (v.demo) return { ok: true, demo: true };
  const sb = await createClient();
  const { error } = await sb.rpc("set_featured_badge", { p_id: id });
  if (error) return { ok: false, error: error.code === "42501" ? "Esa insignia todavía no es tuya." : "No pudimos guardar tu insignia. Intenta de nuevo." };
  revalidatePath("/app/perfil");
  revalidatePath("/app/comunidad", "layout");
  return { ok: true };
}

/** Borra fotos del bucket privado (servidor). Nunca registra rutas ni datos del documento. */
async function removeFiles(paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => typeof p === "string" && p.length > 0);
  if (!list.length) return true;
  const db = adminClient();
  if (!db) return false;
  const { error } = await db.storage.from(BUCKET).remove(list);
  if (error) { logWarn("identidad", "remove_failed", { kind: errCode(error) }); return false; }
  return true;
}

/**
 * Envía la verificación. Las fotos ya están en el bucket privado (las sube el navegador a la carpeta de la persona).
 * Límite: 5 intentos por hora por persona (rate_hit) además de los 3 envíos diarios de la base.
 */
export async function submitVerification(raw: { docType?: unknown; country?: unknown; last3?: unknown; fullName?: unknown; front?: unknown; selfie?: unknown; consent?: unknown; consentVersion?: unknown }): Promise<Res> {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar." };
  if (v.demo) return { ok: true, demo: true };
  const checked = validateSubmission(raw, v.id, COUNTRIES.map((c) => c[0]));
  const dropUploads = () => removeFiles([typeof raw.front === "string" && raw.front.startsWith(`${v.id}/`) ? raw.front : null, typeof raw.selfie === "string" && raw.selfie.startsWith(`${v.id}/`) ? raw.selfie : null]);
  if (!checked.ok) { await dropUploads(); return { ok: false, error: checked.error }; }
  const db = adminClient();
  if (db) {
    const { data: allowed, error: rlErr } = await db.rpc("rate_hit", { p_key: `idv:${v.id}`, p_window_seconds: 3600, p_max: 5 });
    if (!rlErr && allowed === false) { await dropUploads(); return { ok: false, error: "Hiciste varios intentos seguidos. Espera una hora e intenta de nuevo." }; }
  }
  const sb = await createClient();
  // Fotos de un envío anterior rechazado que aún no se borraron: se borran al reemplazarlas.
  const { data: prev } = await sb.from("identity_verifications").select("front_path,selfie_path").eq("user_id", v.id).maybeSingle();
  const x = checked.value;
  const { error } = await sb.rpc("identity_submit", { p_doc_type: x.docType, p_country: x.country, p_last3: x.last3, p_full_name: x.fullName, p_front: x.front, p_selfie: x.selfie, p_consent_version: String(raw.consentVersion ?? "").slice(0, 20) || "v1" });
  if (error) {
    await dropUploads();
    // Nunca el mensaje crudo ni datos del documento en el log: solo el código.
    logWarn("identidad", "submit_failed", { code: errCode(error) });
    const msg = error.code === "P0001" || error.code === "22023" ? (error.message || "").slice(0, 140) : "No pudimos enviar tu verificación. Intenta de nuevo.";
    return { ok: false, error: msg || "No pudimos enviar tu verificación. Intenta de nuevo." };
  }
  if (prev) await removeFiles([prev.front_path as string | null, prev.selfie_path as string | null].filter((p) => p !== x.front && p !== x.selfie));
  revalidatePath("/app/perfil");
  revalidatePath("/app/perfil/verificar");
  return { ok: true };
}

/** Retira la verificación: borra la fila (pierdes el Verificado) y las fotos que queden. */
export async function withdrawVerification(): Promise<Res> {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar." };
  { const lim = v.demo ? null : await limitError("cuenta:perfil", v.id); if (lim) return { ok: false, error: lim }; }
  if (v.demo) return { ok: true, demo: true };
  const sb = await createClient();
  const { data, error } = await sb.rpc("identity_withdraw");
  if (error) { logError("identidad", "withdraw_failed", { code: errCode(error) }); return { ok: false, error: "No pudimos retirar tu verificación. Intenta de nuevo." }; }
  const row = (Array.isArray(data) ? data[0] : data) as { front_path?: string | null; selfie_path?: string | null } | null;
  // Con la sesión de la persona (política "borrar propio") y, si hay, también con service_role.
  const paths = [row?.front_path, row?.selfie_path].filter((p): p is string => !!p);
  if (paths.length && !(await removeFiles(paths))) await sb.storage.from(BUCKET).remove(paths).catch(() => null);
  revalidatePath("/app/perfil");
  revalidatePath("/app/perfil/verificar");
  revalidatePath("/app/comunidad", "layout");
  return { ok: true };
}
