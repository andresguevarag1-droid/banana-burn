"use server";
import { revalidatePath } from "next/cache";
import { createClient, getViewer } from "@/lib/supabase/server";

const clean = (s: string, n: number) => s.replace(/\s+/g, " ").trim().slice(0, n);

export async function toggleKudo(postId: string, on: boolean) {
  const v = await getViewer();
  if (!v) return { ok: false };
  if (v.demo) return { ok: true };
  const sb = await createClient();
  const r = on ? await sb.from("kudos").upsert({ post_id: Number(postId), user_id: v.id }, { onConflict: "post_id,user_id", ignoreDuplicates: true }) : await sb.from("kudos").delete().eq("post_id", Number(postId)).eq("user_id", v.id);
  return { ok: !r.error };
}

export async function addComment(postId: string, body: string) {
  const v = await getViewer();
  const text = clean(body, 300);
  if (!v || !text) return { ok: false };
  if (v.demo) return { ok: true, id: `demo-${Date.now()}` };
  const sb = await createClient();
  const { data, error } = await sb.from("comments").insert({ post_id: Number(postId), user_id: v.id, body: text }).select("id").single();
  revalidatePath("/app/comunidad");
  return { ok: !error, id: data ? String(data.id) : undefined };
}

export async function deletePost(postId: string) {
  const v = await getViewer();
  if (!v || v.demo) return { ok: true };
  const sb = await createClient();
  await sb.from("posts").delete().eq("id", Number(postId)).eq("user_id", v.id);
  revalidatePath("/app/comunidad");
  return { ok: true };
}

export async function setFollow(userId: string, on: boolean) {
  const v = await getViewer();
  if (!v || userId === v.id) return { ok: false };
  if (v.demo) return { ok: true };
  const sb = await createClient();
  const r = on ? await sb.from("follows").upsert({ follower: v.id, followee: userId }, { onConflict: "follower,followee", ignoreDuplicates: true }) : await sb.from("follows").delete().eq("follower", v.id).eq("followee", userId);
  revalidatePath("/app/comunidad");
  return { ok: !r.error };
}

export type ReportReason = "spam" | "acoso" | "contenido_inapropiado" | "desinformacion_salud" | "otro";
export async function report(targetType: "post" | "comment" | "user", targetId: string, reason: ReportReason = "otro", excerpt = "") {
  const v = await getViewer();
  if (!v) return { ok: false };
  if (v.demo) return { ok: true };
  const sb = await createClient();
  // tabla `reports` (creada por el módulo de administración)
  const ok = ["spam", "acoso", "contenido_inapropiado", "desinformacion_salud", "otro"].includes(reason) ? reason : "otro";
  const { error } = await sb.from("reports").insert({ reporter: v.id, target_type: targetType, target_id: targetId, reason: ok, excerpt: clean(excerpt, 280) || null });
  return { ok: !error };
}

export async function saveCommunityProfile(input: { username: string; bio: string; visibility: "publico" | "seguidores" | "privado"; share: boolean }) {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Inicia sesión." };
  const username = input.username.toLowerCase().trim();
  if (!/^[a-z0-9_.]{3,24}$/.test(username)) return { ok: false, error: "Usuario: 3–24 letras, números, punto o guion bajo." };
  if (!["publico", "seguidores", "privado"].includes(input.visibility)) return { ok: false, error: "Visibilidad inválida." };
  if (v.demo) return { ok: true, demo: true };
  const sb = await createClient();
  const { error } = await sb.from("profiles").update({ username, bio: clean(input.bio, 160) || null, visibility: input.visibility, share_workouts: input.share }).eq("id", v.id);
  if (error) return { ok: false, error: error.code === "23505" ? "Ese usuario ya existe." : "No se pudo guardar." };
  revalidatePath("/app", "layout");
  return { ok: true };
}
