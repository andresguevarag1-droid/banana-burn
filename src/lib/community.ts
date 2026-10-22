import { createClient, type Viewer } from "@/lib/supabase/server";
import { crToday } from "@/lib/today";
import { demoWorkouts } from "@/lib/demo-story";

export type Author = { id: string; username: string | null; name: string };
export type PostData = { title?: string; mins?: number; sets?: number; volume?: number; prs?: string[]; emoji?: string; challenge?: string };
export type FeedPost = { id: string; author: Author; kind: string; body: string | null; data: PostData; at: string; kudos: number; mine: boolean; iKudo: boolean; comments: { id: string; author: Author; body: string; at: string }[]; commentCount: number };

const ago = (h: number) => new Date(Date.now() - h * 3600e3).toISOString();
const DEMO_AUTHORS: Author[] = [
  { id: "d1", username: "carla.fit", name: "Carla Mora" }, { id: "d2", username: "diego_cr", name: "Diego Solís" }, { id: "d3", username: "vale.run", name: "Valeria Jiménez" },
];
/** Gente que todavía no sigues (sugerencias del demo). */
const DEMO_SUGGEST: Author[] = [
  { id: "d4", username: "fabi.rojas", name: "Fabián Rojas" }, { id: "d5", username: "mariela.q", name: "Mariela Quesada" }, { id: "d6", username: "jp.vargas", name: "José Pablo Vargas" },
];
const weekDemo = (v: Viewer) => {
  const t = crToday().iso, from = new Date(t + "T12:00:00"); from.setDate(from.getDate() - 7);
  const all = demoWorkouts(t);
  return { all, week: all.filter((w) => w.d >= from.toISOString().slice(0, 10)).length, me: { id: v.id, username: "andres", name: "Andrés" } as Author };
};

function demoFeed(v: Viewer): FeedPost[] {
  const { all, me } = weekDemo(v);
  const last = all[0];
  const lastH = Math.round((Date.now() - new Date(last.d + "T18:30:00-06:00").getTime()) / 3600e3);
  return [
    { id: "p1", author: DEMO_AUTHORS[0], kind: "workout", body: "Primera vez que llego a 60 kg en sentadilla 😤", data: { title: "Pierna y empuje A", emoji: "🏋️", mins: 52, sets: 13, volume: 7420, prs: ["Sentadilla trasera"] }, at: ago(2), kudos: 14, mine: false, iKudo: false, commentCount: 2, comments: [{ id: "c1", author: DEMO_AUTHORS[1], body: "¡Pura vida! Qué nivel", at: ago(1.5) }, { id: "c1b", author: DEMO_AUTHORS[2], body: "Esa sentadilla viene subiendo cada semana.", at: ago(1) }] },
    { id: "p2", author: DEMO_AUTHORS[1], kind: "challenge", body: null, data: { title: "Completó el reto 30 días Banana", emoji: "🍌", challenge: "30 días Banana" }, at: ago(5), kudos: 31, mine: false, iKudo: true, commentCount: 0, comments: [] },
    { id: "p3", author: me, kind: "workout", body: null, data: { title: last.tpl, emoji: "🦍", mins: 48, sets: 12, volume: 6840, prs: [] }, at: ago(Math.max(3, lastH)), kudos: 6, mine: true, iKudo: false, commentCount: 1, comments: [{ id: "c2", author: DEMO_AUTHORS[2], body: "Constancia 👏", at: ago(20) }] },
    { id: "p4", author: DEMO_AUTHORS[2], kind: "workout", body: "Exprés en el cuarto del hotel, no hay excusa", data: { title: "Exprés 20 min", emoji: "⚡", mins: 20, sets: 15, volume: 0, prs: [] }, at: ago(30), kudos: 9, mine: false, iKudo: false, commentCount: 0, comments: [] },
  ];
}

export async function getFeed(v: Viewer, mode: "siguiendo" | "descubrir" = "siguiendo"): Promise<FeedPost[]> {
  if (v.demo) return demoFeed(v);
  const sb = await createClient();
  let ids: string[] | null = null;
  if (mode === "siguiendo") {
    const { data: f } = await sb.from("follows").select("followee").eq("follower", v.id);
    ids = [v.id, ...(f ?? []).map((r) => r.followee as string)];
  }
  let q = sb.from("posts").select("id,user_id,kind,body,data,created_at").eq("hidden", false).order("created_at", { ascending: false }).limit(40);
  q = ids ? q.in("user_id", ids) : q.eq("visibility", "publico");
  const { data: posts } = await q;
  const list = posts ?? [];
  if (!list.length) return [];
  const postIds = list.map((p) => p.id);
  const userIds = [...new Set(list.map((p) => p.user_id as string))];
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
      id: String(p.id), author: author(p.user_id as string), kind: p.kind as string, body: p.body as string | null, data: (p.data ?? {}) as PostData, at: p.created_at as string,
      kudos: ks.length, iKudo: ks.some((k) => k.user_id === v.id), mine: p.user_id === v.id,
      commentCount: cs.length, comments: cs.slice(-3).map((c) => ({ id: String(c.id), author: author(c.user_id as string), body: c.body as string, at: c.created_at as string })),
    };
  });
}

export type LeaderRow = { userId: string; username: string | null; name: string; workouts: number; xp: number; me: boolean };

export async function getLeaderboard(v: Viewer): Promise<LeaderRow[]> {
  if (v.demo) return [
    { userId: "d2", username: "diego_cr", name: "Diego Solís", workouts: 6, xp: 905, me: false },
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
