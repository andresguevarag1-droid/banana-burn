"use server";
import { revalidatePath } from "next/cache";
import { createClient, getViewer } from "@/lib/supabase/server";
import { isUuid } from "@/lib/security";
import { validateUsername } from "@/lib/username";

const clean = (s: unknown, n: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const postIdOf = (x: unknown) => (typeof x === "string" || typeof x === "number") && /^[0-9]{1,18}$/.test(String(x)) ? Number(x) : null;

export async function toggleKudo(postId: string, on: boolean) {
  const v = await getViewer();
  const pid = postIdOf(postId);
  if (!v || pid === null) return { ok: false };
  if (v.demo) return { ok: true };
  const sb = await createClient();
  const r = on ? await sb.from("kudos").upsert({ post_id: pid, user_id: v.id }, { onConflict: "post_id,user_id", ignoreDuplicates: true }) : await sb.from("kudos").delete().eq("post_id", pid).eq("user_id", v.id);
  return { ok: !r.error };
}

export async function addComment(postId: string, body: string) {
  const v = await getViewer();
  const text = clean(body, 300);
  const pid = postIdOf(postId);
  if (!v || !text || pid === null) return { ok: false };
  if (v.demo) return { ok: true, id: `demo-${Date.now()}` };
  const sb = await createClient();
  const { data, error } = await sb.from("comments").insert({ post_id: pid, user_id: v.id, body: text }).select("id").single();
  revalidatePath("/app/comunidad");
  return { ok: !error, id: data ? String(data.id) : undefined };
}

export async function deletePost(postId: string) {
  const v = await getViewer();
  const pid = postIdOf(postId);
  if (!v || v.demo || pid === null) return { ok: true };
  const sb = await createClient();
  await sb.from("posts").delete().eq("id", pid).eq("user_id", v.id);
  revalidatePath("/app/comunidad");
  return { ok: true };
}

export async function setFollow(userId: string, on: boolean) {
  const v = await getViewer();
  if (!v || userId === v.id) return { ok: false };
  if (v.demo) return { ok: true };
  if (!isUuid(userId)) return { ok: false };
  const sb = await createClient();
  const r = on ? await sb.from("follows").upsert({ follower: v.id, followee: userId }, { onConflict: "follower,followee", ignoreDuplicates: true }) : await sb.from("follows").delete().eq("follower", v.id).eq("followee", userId);
  revalidatePath("/app/comunidad");
  return { ok: !r.error };
}

export type ReportReason = "spam" | "acoso" | "contenido_inapropiado" | "desinformacion_salud" | "otro";
const REASONS: ReportReason[] = ["spam", "acoso", "contenido_inapropiado", "desinformacion_salud", "otro"];

/**
 * Reporta contenido. El extracto que ve el moderador lo arma el SERVIDOR con lo que el reportante puede ver
 * (RLS); el texto que manda el navegador se ignora para que nadie pueda inventar lo que "dijo" otra persona.
 */
export async function report(targetType: "post" | "comment" | "user", targetId: string, reason: ReportReason = "otro", _excerpt = "") {
  void _excerpt;
  const v = await getViewer();
  if (!v) return { ok: false };
  if (!["post", "comment", "user"].includes(targetType)) return { ok: false };
  if (v.demo) return { ok: true };
  const sb = await createClient();
  const ok = REASONS.includes(reason) ? reason : "otro";
  let excerpt: string | null = null;
  if (targetType === "post" || targetType === "comment") {
    const id = postIdOf(targetId);
    if (id === null) return { ok: false };
    const { data } = await sb.from(targetType === "post" ? "posts" : "comments").select("body").eq("id", id).maybeSingle();
    if (!data) return { ok: false }; // no existe o no lo puede ver: no se puede reportar
    excerpt = clean(data.body, 280) || null;
  } else {
    if (!isUuid(targetId) || targetId === v.id) return { ok: false };
    const { data } = await sb.from("public_profiles").select("username,bio").eq("id", targetId).maybeSingle();
    if (!data) return { ok: false };
    excerpt = clean(`@${data.username ?? ""} ${data.bio ?? ""}`, 280) || null;
  }
  const { error } = await sb.from("reports").insert({ reporter: v.id, target_type: targetType, target_id: String(targetId), reason: ok, excerpt });
  return { ok: !error };
}

export async function saveCommunityProfile(input: { username: string; bio: string; visibility: "publico" | "seguidores" | "privado"; share: boolean }) {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Inicia sesión." };
  const u = validateUsername(input?.username);
  if (!u.ok) return { ok: false, error: u.error };
  const username = u.username;
  if (!["publico", "seguidores", "privado"].includes(input.visibility)) return { ok: false, error: "Visibilidad inválida." };
  if (v.demo) return { ok: true, demo: true };
  const sb = await createClient();
  const { error } = await sb.from("profiles").update({ username, bio: clean(input.bio, 160) || null, visibility: input.visibility, share_workouts: input.share === true }).eq("id", v.id);
  if (error) return { ok: false, error: error.code === "23505" ? "Ese usuario ya existe." : "No pudimos guardar. Intenta de nuevo." };
  revalidatePath("/app", "layout");
  return { ok: true };
}
