"use server";
import { revalidatePath } from "next/cache";
import { createClient, getViewer } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements";
import { APP_LOCKED_MSG } from "@/lib/plan-access";
import { getComments as loadComments, getCommunityMe, getTodayWorkout, POST_MAX, summarizeWorkout, type FeedComment, type FeedPost, type PostData } from "@/lib/community";
import { isPostTag, type PostTag } from "@/lib/community-view";
import { todayFor } from "@/lib/today";
import { isUuid } from "@/lib/security";
import { validateUsername } from "@/lib/username";
import { limitError } from "@/lib/security/limits";

const clean = (s: unknown, n: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
/** Texto de una publicación: conserva saltos de línea (máx. 2 seguidos), sin espacios repetidos. */
const cleanBody = (s: unknown, n: number) => String(s ?? "").replace(/\r\n?/g, "\n").replace(/[^\S\n]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, n);
const postIdOf = (x: unknown) => (typeof x === "string" || typeof x === "number") && /^[0-9]{1,18}$/.test(String(x)) ? Number(x) : null;

type Res = { ok: boolean; error?: string };

/** Errores de la base de datos → mensajes para la persona. */
function dbError(e: { code?: string; message?: string; hint?: string } | null, fallback: string): string {
  if (!e) return fallback;
  if (e.hint === "rate_limit" || /Demasiadas acciones/.test(e.message ?? "")) return "Vas muy rápido. Espera unos minutos e intenta de nuevo.";
  if (e.code === "42501" || /row-level security/i.test(e.message ?? "")) return "No puedes hacer esto ahora. Si tu cuenta está pausada, escríbenos.";
  return fallback;
}

/** ¿Puede escribir en la comunidad? (plan o prueba vigente y cuenta no suspendida). La RLS lo vuelve a validar. */
async function canWrite(): Promise<{ ok: true; v: NonNullable<Awaited<ReturnType<typeof getViewer>>> } | { ok: false; error: string }> {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar." };
  if (v.demo) return { ok: true, v };
  // Publicar y comentar tienen tope por tabla en la base (0012); este freno corta antes, sin las lecturas de abajo.
  const lim = await limitError("comunidad:escribir", v.id);
  if (lim) return { ok: false, error: lim };
  const [ent, me] = await Promise.all([getEntitlements(v), getCommunityMe(v)]);
  if (!ent.app) return { ok: false, error: "Tu plan no incluye la comunidad ahora mismo. Revisa tu suscripción." };
  if (me.suspended) return { ok: false, error: "Tu cuenta no puede publicar ni comentar por ahora. Si crees que es un error, escríbenos a hola@bananaburn.app." };
  return { ok: true, v };
}

export async function createPost(body: string, visibility?: "publico" | "seguidores", tag?: PostTag | null): Promise<Res & { post?: FeedPost; demo?: boolean }> {
  const text = cleanBody(body, POST_MAX);
  if (!text) return { ok: false, error: "Escribe algo antes de publicar." };
  if (String(body ?? "").trim().length > POST_MAX) return { ok: false, error: `Máximo ${POST_MAX} caracteres.` };
  const w = await canWrite();
  if (!w.ok) return { ok: false, error: w.error };
  const v = w.v;
  const me = await getCommunityMe(v);
  const vis = visibility === "publico" || visibility === "seguidores" ? visibility : me.visibility === "publico" ? "publico" : "seguidores";
  // Solo la etiqueta de tipo; el servidor (0019) descarta cualquier otro dato en publicaciones de texto.
  const data: PostData = isPostTag(tag) ? { tag } : {};
  const author = { id: v.id, username: me.username, name: v.name };
  if (v.demo) return { ok: true, demo: true, post: { id: `demo-${Date.now()}`, author, kind: "text", body: text, data, at: new Date().toISOString(), kudos: 0, mine: true, iKudo: false, comments: [], commentCount: 0 } };
  const sb = await createClient();
  const { data: row, error } = await sb.from("posts").insert({ user_id: v.id, kind: "text", body: text, visibility: vis, data }).select("id,created_at,data").single();
  if (error || !row) return { ok: false, error: dbError(error, "No pudimos publicar. Intenta de nuevo.") };
  revalidatePath("/app/comunidad");
  return { ok: true, post: { id: String(row.id), author, kind: "text", body: text, data: (row.data ?? {}) as PostData, at: row.created_at as string, kudos: 0, mine: true, iKudo: false, comments: [], commentCount: 0 } };
}

/**
 * "Terminé mi entreno": publica el entreno de HOY (el último registrado) con su resumen real, más el texto opcional.
 * El resumen lo arma el servidor desde las series guardadas; la base (guard_post_write) exige que el entreno sea tuyo
 * y que no esté publicado.
 */
export async function publishTodayWorkout(body: string, visibility?: "publico" | "seguidores"): Promise<Res & { post?: FeedPost; demo?: boolean }> {
  const text = cleanBody(body, POST_MAX);
  if (String(body ?? "").trim().length > POST_MAX) return { ok: false, error: `Máximo ${POST_MAX} caracteres.` };
  const w = await canWrite();
  if (!w.ok) return { ok: false, error: w.error };
  const v = w.v;
  if (v.demo) return { ok: false, error: "En el demo no hay un entreno de hoy para publicar." };
  const today = await getTodayWorkout(v);
  if (!today) return { ok: false, error: "Todavía no registras un entreno hoy." };
  if (today.published) return { ok: false, error: "Tu entreno de hoy ya está publicado." };
  const me = await getCommunityMe(v);
  const vis = visibility === "publico" || visibility === "seguidores" ? visibility : me.visibility === "publico" ? "publico" : "seguidores";
  const sb = await createClient();
  const [{ data: wk }, { data: sets }] = await Promise.all([
    sb.from("workouts").select("id,template,started_at,finished_at,xp,day").eq("id", today.id).eq("user_id", v.id).maybeSingle(),
    sb.from("workout_sets").select("exercise,kg,reps").eq("workout_id", today.id),
  ]);
  if (!wk || wk.day !== todayFor(v).iso) return { ok: false, error: "Todavía no registras un entreno hoy." };
  const sum = summarizeWorkout(wk, sets ?? []);
  const data: PostData = { title: sum.title, icon: "barbell", sets: sum.sets, volume: sum.volume, ex: sum.ex, prs: [], ...(sum.mins ? { mins: sum.mins } : {}), ...(Number(wk.xp) > 0 ? { xp: Number(wk.xp) } : {}) };
  const { data: row, error } = await sb.from("posts").insert({ user_id: v.id, kind: "workout", workout_id: today.id, body: text || null, visibility: vis, data }).select("id,created_at").single();
  if (error?.code === "23505") return { ok: false, error: "Tu entreno de hoy ya está publicado." };
  if (error || !row) return { ok: false, error: dbError(error, "No pudimos publicar tu entreno. Intenta de nuevo.") };
  revalidatePath("/app/comunidad");
  return { ok: true, post: { id: String(row.id), author: { id: v.id, username: me.username, name: v.name }, kind: "workout", body: text || null, data, at: row.created_at as string, kudos: 0, mine: true, iKudo: false, comments: [], commentCount: 0 } };
}

export async function toggleKudo(postId: string, on: boolean): Promise<Res> {
  const v = await getViewer();
  if (v?.demo) return { ok: true };
  const pid = postIdOf(postId);
  if (!v || pid === null) return { ok: false, error: "No pudimos guardar tu banana." };
  { const lim = v.demo ? null : await limitError("comunidad:like", v.id); if (lim) return { ok: false, error: lim }; }
  if (!(await getEntitlements(v)).app) return { ok: false, error: APP_LOCKED_MSG };
  const sb = await createClient();
  const r = on ? await sb.from("kudos").upsert({ post_id: pid, user_id: v.id }, { onConflict: "post_id,user_id", ignoreDuplicates: true }) : await sb.from("kudos").delete().eq("post_id", pid).eq("user_id", v.id);
  return r.error ? { ok: false, error: dbError(r.error, "No pudimos guardar tu banana. Intenta de nuevo.") } : { ok: true };
}

export async function addComment(postId: string, body: string): Promise<Res & { id?: string }> {
  const text = clean(body, 300);
  if (!text) return { ok: false, error: "Escribe un comentario." };
  const w = await canWrite();
  if (!w.ok) return { ok: false, error: w.error };
  if (w.v.demo) return { ok: true, id: `demo-${Date.now()}` };
  const pid = postIdOf(postId);
  if (pid === null) return { ok: false, error: "No encontramos esa publicación." };
  const sb = await createClient();
  const { data, error } = await sb.from("comments").insert({ post_id: pid, user_id: w.v.id, body: text }).select("id").single();
  if (error || !data) return { ok: false, error: dbError(error, "No pudimos enviar tu comentario. Intenta de nuevo.") };
  revalidatePath("/app/comunidad");
  return { ok: true, id: String(data.id) };
}

export async function getComments(postId: string): Promise<{ ok: boolean; comments: FeedComment[] }> {
  const v = await getViewer();
  if (!v || typeof postId !== "string" || postId.length > 30) return { ok: false, comments: [] };
  if (!v.demo && postIdOf(postId) === null) return { ok: false, comments: [] };
  { const lim = v.demo ? null : await limitError("comunidad:leer", v.id); if (lim) return { ok: false, comments: [] }; }
  // Leer la comunidad es parte del plan: sin plan ni prueba no se devuelven comentarios de nadie.
  if (!(await getEntitlements(v)).app) return { ok: false, comments: [] };
  return { ok: true, comments: await loadComments(v, postId) };
}

export async function deleteComment(commentId: string): Promise<Res> {
  const v = await getViewer();
  const id = postIdOf(commentId);
  if (!v) return { ok: false, error: "Tu sesión expiró." };
  { const lim = v.demo ? null : await limitError("comunidad:escribir", v.id); if (lim) return { ok: false, error: lim }; }
  if (v.demo) return { ok: true };
  if (id === null) return { ok: false, error: "No pudimos borrar el comentario." };
  const sb = await createClient();
  const { data, error } = await sb.from("comments").delete().eq("id", id).eq("user_id", v.id).select("id");
  if (error || !data?.length) return { ok: false, error: "No pudimos borrar el comentario. Intenta de nuevo." };
  revalidatePath("/app/comunidad");
  return { ok: true };
}

export async function deletePost(postId: string): Promise<Res> {
  const v = await getViewer();
  const pid = postIdOf(postId);
  if (!v) return { ok: false, error: "Tu sesión expiró." };
  { const lim = v.demo ? null : await limitError("comunidad:escribir", v.id); if (lim) return { ok: false, error: lim }; }
  if (v.demo) return { ok: true };
  if (pid === null) return { ok: false, error: "No pudimos borrar la publicación." };
  const sb = await createClient();
  const { data, error } = await sb.from("posts").delete().eq("id", pid).eq("user_id", v.id).select("id");
  if (error || !data?.length) return { ok: false, error: "No pudimos borrar la publicación. Intenta de nuevo." };
  revalidatePath("/app/comunidad");
  return { ok: true };
}

export async function setFollow(userId: string, on: boolean): Promise<Res> {
  const v = await getViewer();
  if (!v || userId === v.id) return { ok: false, error: "No pudimos actualizar a quién sigues." };
  { const lim = v.demo ? null : await limitError("comunidad:seguir", v.id); if (lim) return { ok: false, error: lim }; }
  if (v.demo) return { ok: true };
  if (!isUuid(userId)) return { ok: false, error: "No pudimos actualizar a quién sigues." };
  if (!(await getEntitlements(v)).app) return { ok: false, error: APP_LOCKED_MSG };
  const sb = await createClient();
  const r = on ? await sb.from("follows").upsert({ follower: v.id, followee: userId }, { onConflict: "follower,followee", ignoreDuplicates: true }) : await sb.from("follows").delete().eq("follower", v.id).eq("followee", userId);
  if (r.error) return { ok: false, error: dbError(r.error, on ? "No pudimos seguir a esta persona. Puede que su perfil sea privado." : "No pudimos dejar de seguir. Intenta de nuevo.") };
  revalidatePath("/app/comunidad");
  return { ok: true };
}

export type ReportReason = "spam" | "acoso" | "contenido_inapropiado" | "desinformacion_salud" | "otro";
const REASONS: ReportReason[] = ["spam", "acoso", "contenido_inapropiado", "desinformacion_salud", "otro"];

/**
 * Reporta contenido. El extracto que ve el moderador lo arma el SERVIDOR con lo que el reportante puede ver
 * (RLS); el texto que manda el navegador se ignora para que nadie pueda inventar lo que "dijo" otra persona.
 */
export async function report(targetType: "post" | "comment" | "user", targetId: string, reason: ReportReason = "otro", _excerpt = ""): Promise<Res> {
  void _excerpt;
  const v = await getViewer();
  if (!v) return { ok: false, error: "Tu sesión expiró." };
  { const lim = v.demo ? null : await limitError("comunidad:escribir", v.id); if (lim) return { ok: false, error: lim }; }
  if (!["post", "comment", "user"].includes(targetType)) return { ok: false };
  if (v.demo) return { ok: true };
  const sb = await createClient();
  const ok = REASONS.includes(reason) ? reason : "otro";
  let excerpt: string | null = null;
  if (targetType === "post" || targetType === "comment") {
    const id = postIdOf(targetId);
    if (id === null) return { ok: false };
    const { data } = await sb.from(targetType === "post" ? "posts" : "comments").select("body,user_id").eq("id", id).maybeSingle();
    if (!data) return { ok: false, error: "Ese contenido ya no está disponible." };
    if (data.user_id === v.id) return { ok: false, error: "No puedes reportar tu propio contenido." };
    excerpt = clean(data.body, 280) || null;
  } else {
    if (!isUuid(targetId) || targetId === v.id) return { ok: false };
    const { data } = await sb.from("public_profiles").select("username,bio").eq("id", targetId).maybeSingle();
    if (!data) return { ok: false };
    excerpt = clean(`@${data.username ?? ""} ${data.bio ?? ""}`, 280) || null;
  }
  const { error } = await sb.from("reports").insert({ reporter: v.id, target_type: targetType, target_id: String(targetId), reason: ok, excerpt });
  if (error?.code === "23505") return { ok: true }; // ya lo habías reportado
  return error ? { ok: false, error: dbError(error, "No pudimos enviar el reporte. Intenta de nuevo.") } : { ok: true };
}

export async function saveCommunityProfile(input: { username: string; bio: string; visibility: "publico" | "seguidores" | "privado"; share: boolean }) {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Inicia sesión." };
  { const lim = v.demo ? null : await limitError("comunidad:perfil", v.id); if (lim) return { ok: false, error: lim }; }
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
