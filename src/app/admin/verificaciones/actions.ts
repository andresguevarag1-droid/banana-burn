"use server";
// Verificación de identidad en el panel: ver fotos (enlaces firmados de 60 s, auditado), aprobar o rechazar.
// La base valida el rol otra vez (admin_identity_*, 0030) y escribe la auditoría. Nunca se registran datos del documento.
import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/security";
import { errCode, logError, logWarn } from "@/lib/log";

const BUCKET = "identidad";
/** Vida de los enlaces de las fotos para quien revisa. */
const SIGNED_SECONDS = 60;

export type DocsResult = { ok: true; front: string; selfie: string; expiresIn: number; demo?: boolean } | { ok: false; error: string };

/** Foto de ejemplo del demo (SVG local, sin datos de nadie). */
const demoImg = (title: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"><rect width="320" height="200" rx="16" fill="#FFF1A8"/><rect x="18" y="18" width="284" height="164" rx="12" fill="#fff" stroke="#EDE3C6" stroke-width="2"/><circle cx="78" cy="96" r="34" fill="#FFD60A"/><rect x="132" y="66" width="140" height="12" rx="6" fill="#EDE3C6"/><rect x="132" y="90" width="110" height="12" rx="6" fill="#EDE3C6"/><rect x="132" y="114" width="80" height="12" rx="6" fill="#EDE3C6"/><text x="160" y="164" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="700" fill="#6A604B">${title}</text></svg>`)}`;

export async function viewIdentityDocs(userId: string): Promise<DocsResult> {
  const auth = await authorize("users.verify");
  if (!auth.ok) return { ok: false, error: auth.error };
  if (auth.v.demo) return { ok: true, front: demoImg("Documento de ejemplo"), selfie: demoImg("Selfie de ejemplo"), expiresIn: SIGNED_SECONDS, demo: true };
  if (!isUuid(userId)) return { ok: false, error: "Usuario inválido." };
  const sb = await createClient();
  // Con la sesión de quien revisa: la base valida el rol, que no sea su propia verificación y deja la auditoría.
  const { data, error } = await sb.rpc("admin_identity_files", { p_user: userId });
  if (error) return { ok: false, error: error.code === "42501" ? "Tu rol no puede ver documentos o es tu propia verificación." : "No hay fotos para revisar." };
  const row = (Array.isArray(data) ? data[0] : data) as { front_path?: string; selfie_path?: string } | null;
  if (!row?.front_path || !row.selfie_path) return { ok: false, error: "No hay fotos para revisar." };
  const db = adminClient();
  if (!db) return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor para firmar las fotos." };
  const { data: signed, error: sErr } = await db.storage.from(BUCKET).createSignedUrls([row.front_path, row.selfie_path], SIGNED_SECONDS);
  if (sErr || !signed || signed.length < 2 || !signed[0].signedUrl || !signed[1].signedUrl) { logWarn("identidad", "sign_failed", { kind: errCode(sErr) }); return { ok: false, error: "No pudimos abrir las fotos. Intenta de nuevo." }; }
  return { ok: true, front: signed[0].signedUrl, selfie: signed[1].signedUrl, expiresIn: SIGNED_SECONDS };
}

export type DecideResult = { ok: boolean; message: string; demo?: boolean };

/** Aprueba o rechaza. Después borra las fotos de Storage (minimización); si falla, el cron las borra. */
export async function decideIdentity(userId: string, approve: boolean, reason?: string): Promise<DecideResult> {
  const auth = await authorize("users.verify");
  if (!auth.ok) return { ok: false, message: auth.error };
  const why = String(reason ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  if (!approve && why.length < 4) return { ok: false, message: "Escribe el motivo del rechazo (la persona lo va a leer)." };
  if (auth.v.demo) return { ok: true, message: `${approve ? "Aprobada" : "Rechazada"} (modo demo: no se guardó).`, demo: true };
  if (!isUuid(userId)) return { ok: false, message: "Usuario inválido." };
  const sb = await createClient();
  const { data, error } = await sb.rpc("admin_identity_decide", { p_user: userId, p_approve: approve, p_reason: approve ? null : why });
  if (error) return { ok: false, message: error.code === "42501" ? "No puedes decidir esta verificación." : error.code === "P0001" ? (error.message || "").slice(0, 120) : "No se pudo guardar la decisión." };
  const row = (Array.isArray(data) ? data[0] : data) as { front_path?: string | null; selfie_path?: string | null } | null;
  const paths = [row?.front_path, row?.selfie_path].filter((p): p is string => !!p);
  const db = adminClient();
  let purged = false;
  if (db && paths.length) {
    const { error: rmErr } = await db.storage.from(BUCKET).remove(paths);
    if (!rmErr) { const { error: mErr } = await sb.rpc("identity_files_purged", { p_user: userId }); purged = !mErr; }
    else logError("identidad", "purge_after_decide_failed", { kind: errCode(rmErr) });
  } else if (!paths.length) purged = true;
  revalidatePath("/admin/verificaciones");
  return { ok: true, message: `${approve ? "Aprobada" : "Rechazada"}. ${purged ? "Fotos borradas." : "Las fotos se borran en la próxima corrida diaria."} La persona ya tiene el aviso.` };
}
