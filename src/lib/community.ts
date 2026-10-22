import "server-only";
import { createClient, type Viewer } from "@/lib/supabase/server";
import { todayFor } from "@/lib/today";
import { demoWorkouts } from "@/lib/demo-story";

export type Author = { id: string; username: string | null; name: string };
export type PostData = { title?: string; mins?: number; sets?: number; volume?: number; prs?: string[]; emoji?: string; icon?: string; challenge?: string };
export type FeedComment = { id: string; author: Author; body: string; at: string; mine: boolean };
export type FeedPost = { id: string; author: Author; kind: string; body: string | null; data: PostData; at: string; kudos: number; mine: boolean; iKudo: boolean; comments: FeedComment[]; commentCount: number };

/** Largo máximo de una publicación de texto (igual al CHECK de posts.body en 0009). */
export const POST_MAX = 500;
/** Comentarios que se muestran por publicación antes de "Ver los N comentarios". */
export const COMMENTS_PREVIEW = 3;

const ago = (h: number) => new Date(Date.now() - h * 3600e3).toISOString();
const DEMO_AUTHORS: Author[] = [
  { id: "d1", username: "carla.fit", name: "Carla Mora" }, { id: "d2", username: "diego.sol", name: "Diego Solís" }, { id: "d3", username: "vale.run", name: "Valeria Jiménez" },
];
/** Gente que todavía no sigues (sugerencias del demo). */
const DEMO_SUGGEST: Author[] = [
  { id: "d4", username: "fabi.rojas", name: "Fabián Rojas" }, { id: "d5", username: "mariela.q", name: "Mariela Quesada" }, { id: "d6", username: "jp.vargas", name: "José Pablo Vargas" },
];
const DEMO_BIO: Record<string, string> = { "carla.fit": "Fuerza 4 días por semana. Bajando de 78 a 68 kg.", "diego.sol": "Volví al gym después de 3 años.", "vale.run": "Corro y levanto. Exprés cuando viajo." };
const weekDemo = (v: Viewer) => {
  const t = todayFor(v).iso, from = new Date(t + "T12:00:00"); from.setDate(from.getDate() - 7);
  const all = demoWorkouts(t);
  return { all, week: all.filter((w) => w.d >= from.toISOString().slice(0, 10)).length, me: { id: v.id, username: "andres", name: "Andrés" } as Author };
};

function demoFeed(v: Viewer): FeedPost[] {
  const { all, me } = weekDemo(v);
  const last = all[0];
  const lastH = Math.round((Date.now() - new Date(last.d + "T18:30:00-06:00").getTime()) / 3600e3);
  const c = (id: string, a: Author, body: string, h: number, mine = false): FeedComment => ({ id, author: a, body, at: ago(h), mine });
  return [
    { id: "p1", author: DEMO_AUTHORS[0], kind: "workout", body: "Primera vez que llego a 60 kg en sentadilla. Se siente increíble.", data: { title: "Pierna y empuje A", icon: "barbell", mins: 52, sets: 13, volume: 7420, prs: ["Sentadilla trasera"] }, at: ago(2), kudos: 14, mine: false, iKudo: false, commentCount: 4, comments: [c("c1", DEMO_AUTHORS[1], "¡Qué nivel! Se nota el trabajo.", 1.8), c("c1b", DEMO_AUTHORS[2], "Esa sentadilla viene subiendo cada semana.", 1.5), c("c1c", me, "Vamos con todo, Carla.", 1.2, true)] },
    { id: "p2", author: DEMO_AUTHORS[1], kind: "challenge", body: null, data: { title: "Completó el reto 30 días Banana", icon: "medal", challenge: "30 días Banana" }, at: ago(5), kudos: 31, mine: false, iKudo: true, commentCount: 0, comments: [] },
    { id: "p3", author: me, kind: "workout", body: null, data: { title: last.tpl, icon: "gorilla", mins: 48, sets: 12, volume: 6840, prs: [] }, at: ago(Math.max(3, lastH)), kudos: 6, mine: true, iKudo: false, commentCount: 1, comments: [c("c2", DEMO_AUTHORS[2], "Constancia pura. Así se hace.", 20)] },
    { id: "p4", author: DEMO_AUTHORS[2], kind: "workout", body: "Exprés en el cuarto del hotel, no hay excusa", data: { title: "Exprés 20 min", icon: "bolt", mins: 20, sets: 15, volume: 0, prs: [] }, at: ago(30), kudos: 9, mine: false, iKudo: false, commentCount: 0, comments: [] },
  ];
}

type Sb = Awaited<ReturnType<typeof createClient>>;
type PostRow = { id: number; user_id: string; kind: string; body: string | null; data: PostData | null; created_at: string };

/** Arma las tarjetas: autores, bananas y los últimos comentarios visibles (RLS decide qué se ve). */
async function hydrate(sb: Sb, v: Viewer, list: PostRow[]): Promise<FeedPost[]> {
  if (!list.length) return [];
  const postIds = list.map((p) => p.id);
  const userIds = [...new Set(list.map((p) => p.user_id))];
  const [{ data: profs }, { data: kd }, { data: cm }] = await Promise.all([
    sb.from("public_profiles").select("id,username,full_name").in("id", userIds),
    sb.from("kudos").select("post_id,user_id").in("post_id", postIds),
    sb.from("comments").select("id,post_id,user_id,body,created_at").in("post_id", postIds).eq("hidden", false).order("created_at"),
  ]);
  const cmUsers = [...new Set((cm ?? []).map((c) => c.user_id as string))].filter((u) => !userIds.includes(u));
  const { data: cmProfs } = cmUsers.length ? await sb.from("public_profiles").select("id,username,full_name").in("id", cmUsers) : { data: [] };
  const pmap = new Map([...(profs ?? []), ...(cmProfs ?? [])].map((p) => [p.id as string, { id: p.id as string, username: p.username as string | null, name: (p.full_name as string) || (p.username as string) || "Atleta" }]));
  const author = (id: string): Author => pmap.get(id) ?? { id, username: null, name: "Atleta" };
  return list.map((p) => {
    const ks = (kd ?? []).filter((k) => k.post_id === p.id);
    const cs = (cm ?? []).filter((c) => c.post_id === p.id);
    return {
      id: String(p.id), author: author(p.user_id), kind: p.kind, body: p.body, data: (p.data ?? {}) as PostData, at: p.created_at,
      kudos: ks.length, iKudo: ks.some((k) => k.user_id === v.id), mine: p.user_id === v.id,
      commentCount: cs.length,
      comments: cs.slice(-COMMENTS_PREVIEW).map((c) => ({ id: String(c.id), author: author(c.user_id as string), body: c.body as string, at: c.created_at as string, mine: c.user_id === v.id })),
    };
  });
}

export async function getFeed(v: Viewer, mode: "siguiendo" | "descubrir" = "siguiendo"): Promise<FeedPost[]> {
  if (v.demo) return mode === "descubrir" ? demoFeed(v).filter((p) => !p.mine) : demoFeed(v);
  const sb = await createClient();
  let ids: string[] | null = null;
  if (mode === "siguiendo") {
    const { data: f } = await sb.from("follows").select("followee").eq("follower", v.id);
    ids = [v.id, ...(f ?? []).map((r) => r.followee as string)];
  }
  let q = sb.from("posts").select("id,user_id,kind,body,data,created_at").eq("hidden", false).order("created_at", { ascending: false }).limit(40);
  q = ids ? q.in("user_id", ids) : q.eq("visibility", "publico").neq("user_id", v.id);
  const { data: posts } = await q;
  return hydrate(sb, v, (posts ?? []) as PostRow[]);
}

/** Todos los comentarios visibles de una publicación ("Ver los N comentarios"). */
export async function getComments(v: Viewer, postId: string): Promise<FeedComment[]> {
  if (v.demo) {
    const p = demoFeed(v).find((x) => x.id === postId);
    return p ? [{ id: "c0", author: DEMO_AUTHORS[2], body: "¡Bien ahí! Mañana me toca pierna también.", at: ago(1.9), mine: false }, ...p.comments] : [];
  }
  if (!/^[0-9]{1,18}$/.test(postId)) return [];
  const sb = await createClient();
  const { data: cm } = await sb.from("comments").select("id,user_id,body,created_at").eq("post_id", Number(postId)).eq("hidden", false).order("created_at").limit(200);
  const ids = [...new Set((cm ?? []).map((c) => c.user_id as string))];
  const { data: profs } = ids.length ? await sb.from("public_profiles").select("id,username,full_name").in("id", ids) : { data: [] };
  const pmap = new Map((profs ?? []).map((p) => [p.id as string, { id: p.id as string, username: p.username as string | null, name: (p.full_name as string) || (p.username as string) || "Atleta" }]));
  return (cm ?? []).map((c) => ({ id: String(c.id), author: pmap.get(c.user_id as string) ?? { id: c.user_id as string, username: null, name: "Atleta" }, body: c.body as string, at: c.created_at as string, mine: c.user_id === v.id }));
}

export type PublicProfile = { id: string; username: string; name: string; bio: string | null; visibility: string; followers: number; following: number; iFollow: boolean; me: boolean; posts: FeedPost[] };

/** Perfil público por usuario (null si no existe o es privado). */
export async function getPublicProfile(v: Viewer, username: string): Promise<PublicProfile | null> {
  const u = username.toLowerCase();
  if (!/^[a-z0-9_.]{3,24}$/.test(u)) return null;
  if (v.demo) {
    const feed = demoFeed(v);
    const a = [...DEMO_AUTHORS, ...DEMO_SUGGEST, weekDemo(v).me].find((x) => x.username === u);
    if (!a) return null;
    const me = a.id === v.id;
    return { id: a.id, username: u, name: a.name, bio: me ? "Bajando de 94 a 85 kg con Banana Burn" : DEMO_BIO[u] ?? null, visibility: "publico", followers: me ? 12 : 48, following: me ? 9 : 31, iFollow: DEMO_AUTHORS.some((x) => x.id === a.id), me, posts: feed.filter((p) => p.author.id === a.id) };
  }
  const sb = await createClient();
  const { data, error } = await sb.rpc("community_profile", { p_username: u });
  const row = (Array.isArray(data) ? data[0] : data) as { id: string; username: string; full_name: string | null; bio: string | null; visibility: string; followers: number; following: number; i_follow: boolean } | null;
  if (error || !row) {
    // Sin la migración 0013: perfil básico desde la vista pública.
    if (error && !["PGRST202", "42883"].includes(error.code ?? "")) return null;
    const { data: p } = await sb.from("public_profiles").select("id,username,full_name,bio,visibility").eq("username", u).maybeSingle();
    if (!p) return null;
    const { data: f } = await sb.from("follows").select("followee").eq("follower", v.id).eq("followee", p.id).maybeSingle();
    return { id: p.id as string, username: u, name: (p.full_name as string) || u, bio: (p.bio as string) ?? null, visibility: p.visibility as string, followers: 0, following: 0, iFollow: !!f, me: p.id === v.id, posts: await postsOf(sb, v, p.id as string) };
  }
  return { id: row.id, username: row.username, name: row.full_name || row.username, bio: row.bio, visibility: row.visibility, followers: Number(row.followers), following: Number(row.following), iFollow: row.i_follow, me: row.id === v.id, posts: await postsOf(sb, v, row.id) };
}

async function postsOf(sb: Sb, v: Viewer, userId: string) {
  const { data } = await sb.from("posts").select("id,user_id,kind,body,data,created_at").eq("user_id", userId).eq("hidden", false).order("created_at", { ascending: false }).limit(30);
  return hydrate(sb, v, (data ?? []) as PostRow[]);
}

export type LeaderRow = { userId: string; username: string | null; name: string; workouts: number; xp: number; me: boolean };

export async function getLeaderboard(v: Viewer): Promise<LeaderRow[]> {
  if (v.demo) return [
    { userId: "d2", username: "diego.sol", name: "Diego Solís", workouts: 6, xp: 905, me: false },
    { userId: v.id, username: "andres", name: "Andrés", workouts: weekDemo(v).week, xp: weekDemo(v).week * 140, me: true },
    { userId: "d1", username: "carla.fit", name: "Carla Mora", workouts: 5, xp: 690, me: false },
    { userId: "d3", username: "vale.run", name: "Valeria Jiménez", workouts: 3, xp: 395, me: false },
  ].sort((a, b) => b.xp - a.xp);
  const sb = await createClient();
  const { data } = await sb.rpc("weekly_leaderboard");
  return ((data ?? []) as { user_id: string; username: string | null; full_name: string | null; workouts: number; xp: number }[]).map((r) => ({ userId: r.user_id, username: r.username, name: r.full_name || r.username || "Atleta", workouts: Number(r.workouts), xp: Number(r.xp), me: r.user_id === v.id }));
}

export async function getSuggestions(v: Viewer): Promise<Author[]> {
  if (v.demo) return DEMO_SUGGEST;
  const sb = await createClient();
  const { data: f } = await sb.from("follows").select("followee").eq("follower", v.id);
  const skip = new Set([v.id, ...(f ?? []).map((r) => r.followee as string)]);
  const { data } = await sb.from("public_profiles").select("id,username,full_name").eq("visibility", "publico").limit(30);
  return (data ?? []).filter((p) => !skip.has(p.id as string)).slice(0, 6).map((p) => ({ id: p.id as string, username: p.username as string, name: (p.full_name as string) || (p.username as string) }));
}

/** Estado del perfil para la comunidad: usuario elegido y si está suspendido (no puede publicar ni comentar). */
export async function getCommunityMe(v: Viewer): Promise<{ username: string | null; suspended: boolean; visibility: string }> {
  if (v.demo) return { username: "andres", suspended: false, visibility: "seguidores" };
  const sb = await createClient();
  const { data, error } = await sb.from("profiles").select("username,visibility,suspended_at").eq("id", v.id).maybeSingle();
  if (error) {
    // Sin la columna suspended_at (0013 sin aplicar)
    const { data: d2 } = await sb.from("profiles").select("username,visibility").eq("id", v.id).maybeSingle();
    return { username: (d2?.username as string) ?? null, suspended: false, visibility: (d2?.visibility as string) ?? "seguidores" };
  }
  return { username: (data?.username as string) ?? null, suspended: Boolean(data?.suspended_at), visibility: (data?.visibility as string) ?? "seguidores" };
}
