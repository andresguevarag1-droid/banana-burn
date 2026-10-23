import "server-only";
import { createClient, type Viewer } from "@/lib/supabase/server";
import { todayFor } from "@/lib/today";
import { demoActiveDays, demoWorkouts, demoXp, DEMO_PRS } from "@/lib/demo-story";
import { streakOf } from "@/lib/gamify";
import { exerciseName, workoutName } from "@/lib/progress";
import { mondayIso, zonedMidnightUtc, type BoardRow } from "@/lib/community-view";
import { getXpTotal } from "@/lib/xp-total";
import { testersAmong } from "@/lib/testers-server";
import { DEMO_FLAIR, getFlair } from "@/lib/profile-power-server";
import type { Flair } from "@/lib/profile-power";

/** `xp`: XP total para la insignia de nivel; null si la persona no comparte sus entrenos (o no se pudo leer). */
/** `tester`: es tester de la beta hoy (insignia; 0029). */
/** `flair`: verificado, nivel de perfil e insignia destacada (0030); null si no se pudo leer o no aplica. */
export type Author = { id: string; username: string | null; name: string; xp?: number | null; tester?: boolean; flair?: Flair | null };
export type PostData = { title?: string; mins?: number; sets?: number; volume?: number; prs?: string[]; emoji?: string; icon?: string; challenge?: string; xp?: number; ex?: string[]; tag?: string };
export type FeedComment = { id: string; author: Author; body: string; at: string; mine: boolean };
export type FeedPost = { id: string; author: Author; kind: string; body: string | null; data: PostData; at: string; kudos: number; mine: boolean; iKudo: boolean; comments: FeedComment[]; commentCount: number };

/** Largo máximo de una publicación de texto (igual al CHECK de posts.body en 0009). */
export const POST_MAX = 500;
/** Comentarios que se muestran por publicación antes de "Ver los N comentarios". */
export const COMMENTS_PREVIEW = 3;

/** ¿La RPC no existe todavía (migración sin aplicar)? */
const missingRpc = (e: { code?: string } | null) => !!e && ["PGRST202", "42883"].includes(e.code ?? "");

// ───────────── Modo demo: una sola historia, coherente con demo-story ─────────────
const ago = (h: number) => new Date(Date.now() - h * 3600e3).toISOString();
const DEMO_AUTHORS: Author[] = [
  { id: "d1", username: "carla.fit", name: "Carla Mora", xp: 3420, tester: true, flair: DEMO_FLAIR.d1 }, { id: "d2", username: "diego.sol", name: "Diego Solís", xp: 5180, flair: DEMO_FLAIR.d2 }, { id: "d3", username: "vale.run", name: "Valeria Jiménez", xp: 1240, flair: DEMO_FLAIR.d3 },
];
/** El Andrés del demo: Cosecha con su certificado de Abdomen marcado (coherente con demoPower en profile-power-server). */
const DEMO_ME_FLAIR: Flair = { verified: false, tier: 3, featured: { id: "prog:abdomen-marcado", label: "Core de acero", icon: "target", cover: "sky" } };
/** Gente que todavía no sigues (sugerencias del demo). */
const DEMO_SUGGEST: (Author & { bio: string; sameCountry: boolean; sameGoal: boolean; activeDays: number; followers: number })[] = [
  { id: "d4", username: "fabi.rojas", name: "Fabián Rojas", xp: 2210, flair: DEMO_FLAIR.d4, bio: "Pierna los lunes, sin falta.", sameCountry: true, sameGoal: true, activeDays: 9, followers: 21 },
  { id: "d5", username: "mariela.q", name: "Mariela Quesada", xp: 860, flair: DEMO_FLAIR.d5, bio: "Mamá de dos, entreno exprés en casa.", sameCountry: true, sameGoal: false, activeDays: 6, followers: 14 },
  { id: "d6", username: "jp.vargas", name: "José Pablo Vargas", xp: 420, flair: DEMO_FLAIR.d6, bio: "Empezando de cero, aquí vamos.", sameCountry: false, sameGoal: true, activeDays: 3, followers: 5 },
];
const DEMO_BIO: Record<string, string> = { "carla.fit": "Fuerza 4 días por semana. Bajando de 78 a 68 kg.", "diego.sol": "Volví al gym después de 3 años.", "vale.run": "Corro y levanto. Exprés cuando viajo." };
const weekDemo = (v: Viewer) => {
  const t = todayFor(v).iso, mon = mondayIso(t);
  const all = demoWorkouts(t);
  return { all, today: t, week: new Set(all.filter((w) => w.d >= mon).map((w) => w.d)).size, me: { id: v.id, username: "andres", name: "Andrés", xp: demoXp(t), flair: DEMO_ME_FLAIR } as Author };
};

function demoFeed(v: Viewer): FeedPost[] {
  const { all, me } = weekDemo(v);
  const last = all[0];
  const lastH = Math.round((Date.now() - new Date(last.d + "T18:30:00-06:00").getTime()) / 3600e3);
  const c = (id: string, a: Author, body: string, h: number, mine = false): FeedComment => ({ id, author: a, body, at: ago(h), mine });
  return [
    { id: "p1", author: DEMO_AUTHORS[0], kind: "workout", body: "Primera vez que llego a 60 kg en sentadilla. Se siente increíble.", data: { title: "Fuerza total: piernas, pecho y hombros", icon: "barbell", mins: 52, sets: 13, volume: 7420, prs: ["Sentadilla trasera"], xp: 210, ex: ["Sentadilla trasera", "Press de banca", "Zancadas", "Fondos"] }, at: ago(2), kudos: 14, mine: false, iKudo: false, commentCount: 4, comments: [c("c1", DEMO_AUTHORS[1], "¡Qué nivel! Se nota el trabajo.", 1.8), c("c1b", DEMO_AUTHORS[2], "Esa sentadilla viene subiendo cada semana.", 1.5), c("c1c", me, "Vamos con todo, Carla.", 1.2, true)] },
    { id: "p5", author: DEMO_AUTHORS[2], kind: "text", body: "¿Cuánto descansan entre series de sentadilla? Yo hago 90 segundos y llego muerta a la última.", data: { tag: "pregunta" }, at: ago(4), kudos: 3, mine: false, iKudo: false, commentCount: 1, comments: [c("c5", DEMO_AUTHORS[0], "Yo 2 a 3 minutos en las pesadas. Hace la diferencia.", 3.5)] },
    { id: "p2", author: DEMO_AUTHORS[1], kind: "challenge", body: null, data: { title: "Completó el reto 30 días Banana", icon: "medal", challenge: "30 días Banana" }, at: ago(5), kudos: 31, mine: false, iKudo: true, commentCount: 0, comments: [] },
    { id: "p3", author: me, kind: "workout", body: null, data: { title: last.tpl, icon: "gorilla", mins: 48, sets: 12, volume: 6840, prs: [], xp: 150, ex: ["Peso muerto rumano", "Remo con barra", "Jalón al pecho"] }, at: ago(Math.max(3, lastH)), kudos: 6, mine: true, iKudo: false, commentCount: 1, comments: [c("c2", DEMO_AUTHORS[2], "Constancia pura. Así se hace.", 20)] },
    { id: "p4", author: DEMO_AUTHORS[2], kind: "workout", body: "Exprés en el cuarto del hotel, no hay excusa", data: { title: "Exprés 20 min", icon: "bolt", mins: 20, sets: 15, volume: 0, prs: [], xp: 180 }, at: ago(30), kudos: 9, mine: false, iKudo: false, commentCount: 0, comments: [] },
  ];
}

type Sb = Awaited<ReturnType<typeof createClient>>;
type PostRow = { id: number; user_id: string; kind: string; body: string | null; data: PostData | null; created_at: string };
type ProfRow = { id: string; username: string | null; full_name: string | null };

/** XP total (para el nivel) de quien comparte sus entrenos y es visible. Sin la migración 0019: sin niveles. */
async function levelsOf(sb: Sb, ids: string[]): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const { data, error } = await sb.rpc("community_levels", { p_ids: ids.slice(0, 100) });
  if (error) return new Map();
  return new Map(((data ?? []) as { user_id: string; total_xp: number }[]).map((r) => [r.user_id, Number(r.total_xp)]));
}

/** Nivel (XP) e insignias junto al nombre en una sola lectura (0030). Sin 0030: solo el nivel de 0019. */
async function badgesOf(sb: Sb, ids: string[]): Promise<{ xp: Map<string, number>; flair: Map<string, Flair> }> {
  const f = await getFlair(sb, ids);
  if (f) {
    const xp = new Map<string, number>();
    for (const [id, r] of f) if (r.xp !== null) xp.set(id, r.xp);
    return { xp, flair: new Map([...f].map(([id, r]) => [id, { verified: r.verified, tier: r.tier, featured: r.featured }])) };
  }
  return { xp: await levelsOf(sb, ids), flair: new Map() };
}

/** Arma las tarjetas: autores (con nivel), bananas y los últimos comentarios visibles (RLS decide qué se ve). */
async function hydrate(sb: Sb, v: Viewer, list: PostRow[]): Promise<FeedPost[]> {
  if (!list.length) return [];
  const postIds = list.map((p) => p.id);
  const userIds = [...new Set(list.map((p) => p.user_id))];
  const [{ data: profs }, { data: kd }, { data: cm }, lv] = await Promise.all([
    sb.from("public_profiles").select("id,username,full_name").in("id", userIds),
    sb.from("kudos").select("post_id,user_id").in("post_id", postIds),
    sb.from("comments").select("id,post_id,user_id,body,created_at").in("post_id", postIds).eq("hidden", false).order("created_at"),
    badgesOf(sb, userIds),
  ]);
  const cmUsers = [...new Set((cm ?? []).map((c) => c.user_id as string))].filter((u) => !userIds.includes(u));
  const [{ data: cmProfs }, cmLv, testers] = await Promise.all([
    cmUsers.length ? sb.from("public_profiles").select("id,username,full_name").in("id", cmUsers) : Promise.resolve({ data: [] }),
    cmUsers.length ? badgesOf(sb, cmUsers) : Promise.resolve(null),
    testersAmong(sb, [...userIds, ...cmUsers]),
  ]);
  const xpOf = (id: string) => lv.xp.get(id) ?? cmLv?.xp.get(id) ?? null;
  const flairOf = (id: string) => lv.flair.get(id) ?? cmLv?.flair.get(id) ?? null;
  const pmap = new Map([...((profs ?? []) as ProfRow[]), ...((cmProfs ?? []) as ProfRow[])].map((p) => [p.id, { id: p.id, username: p.username, name: p.full_name || p.username || "Atleta", xp: xpOf(p.id), tester: testers.has(p.id), flair: flairOf(p.id) }]));
  const author = (id: string): Author => pmap.get(id) ?? { id, username: null, name: "Atleta", xp: null };
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
    return p ? [{ id: "c0", author: DEMO_AUTHORS[2], body: "¡Muy bien! Mañana me toca pierna también.", at: ago(1.9), mine: false }, ...p.comments] : [];
  }
  if (!/^[0-9]{1,18}$/.test(postId)) return [];
  const sb = await createClient();
  const { data: cm } = await sb.from("comments").select("id,user_id,body,created_at").eq("post_id", Number(postId)).eq("hidden", false).order("created_at").limit(200);
  const ids = [...new Set((cm ?? []).map((c) => c.user_id as string))];
  const [{ data: profs }, b, testers] = await Promise.all([
    ids.length ? sb.from("public_profiles").select("id,username,full_name").in("id", ids) : Promise.resolve({ data: [] }),
    ids.length ? badgesOf(sb, ids) : Promise.resolve(null),
    testersAmong(sb, ids),
  ]);
  const pmap = new Map(((profs ?? []) as ProfRow[]).map((p) => [p.id, { id: p.id, username: p.username, name: p.full_name || p.username || "Atleta", xp: b?.xp.get(p.id) ?? null, tester: testers.has(p.id), flair: b?.flair.get(p.id) ?? null }]));
  return (cm ?? []).map((c) => ({ id: String(c.id), author: pmap.get(c.user_id as string) ?? { id: c.user_id as string, username: null, name: "Atleta" }, body: c.body as string, at: c.created_at as string, mine: c.user_id === v.id }));
}

export type PublicProfile = { id: string; username: string; name: string; bio: string | null; visibility: string; followers: number; following: number; iFollow: boolean; me: boolean; posts: FeedPost[]; tester?: boolean };

/** Perfil público por usuario (null si no existe o es privado). */
export async function getPublicProfile(v: Viewer, username: string): Promise<PublicProfile | null> {
  const u = username.toLowerCase();
  if (!/^[a-z0-9_.]{3,24}$/.test(u)) return null;
  if (v.demo) {
    const feed = demoFeed(v);
    const a = [...DEMO_AUTHORS, ...DEMO_SUGGEST, weekDemo(v).me].find((x) => x.username === u);
    if (!a) return null;
    const me = a.id === v.id;
    const sugg = DEMO_SUGGEST.find((x) => x.id === a.id);
    return { id: a.id, username: u, name: a.name, bio: me ? "Bajando de 94 a 85 kg con Banana Burn" : DEMO_BIO[u] ?? sugg?.bio ?? null, visibility: "publico", followers: me ? 12 : sugg?.followers ?? 48, following: me ? 9 : 31, iFollow: DEMO_AUTHORS.some((x) => x.id === a.id), me, posts: feed.filter((p) => p.author.id === a.id), tester: !!a.tester };
  }
  const sb = await createClient();
  const { data, error } = await sb.rpc("community_profile", { p_username: u });
  const row = (Array.isArray(data) ? data[0] : data) as { id: string; username: string; full_name: string | null; bio: string | null; visibility: string; followers: number; following: number; i_follow: boolean } | null;
  if (error || !row) {
    // Sin la migración 0013: perfil básico desde la vista pública.
    if (error && !missingRpc(error)) return null;
    const { data: p } = await sb.from("public_profiles").select("id,username,full_name,bio,visibility").eq("username", u).maybeSingle();
    if (!p) return null;
    const { data: f } = await sb.from("follows").select("followee").eq("follower", v.id).eq("followee", p.id).maybeSingle();
    return { id: p.id as string, username: u, name: (p.full_name as string) || u, bio: (p.bio as string) ?? null, visibility: p.visibility as string, followers: 0, following: 0, iFollow: !!f, me: p.id === v.id, posts: await postsOf(sb, v, p.id as string) };
  }
  const [posts, testers] = await Promise.all([postsOf(sb, v, row.id), testersAmong(sb, [row.id])]);
  return { id: row.id, username: row.username, name: row.full_name || row.username, bio: row.bio, visibility: row.visibility, followers: Number(row.followers), following: Number(row.following), iFollow: row.i_follow, me: row.id === v.id, posts, tester: testers.has(row.id) };
}

async function postsOf(sb: Sb, v: Viewer, userId: string) {
  const { data } = await sb.from("posts").select("id,user_id,kind,body,data,created_at").eq("user_id", userId).eq("hidden", false).order("created_at", { ascending: false }).limit(30);
  return hydrate(sb, v, (data ?? []) as PostRow[]);
}

// ───────────── Estadísticas de un perfil ─────────────
export type ProfileStats = { workoutsTotal: number; workoutsWeek: number; prs: number; xp: number; streak: number | null };

/** Solo si puedes ver sus entrenos (la RPC lo decide). La racha solo se muestra en tu propio perfil (es la misma de Hoy). */
export async function getProfileStats(v: Viewer, userId: string, me: boolean): Promise<ProfileStats | null> {
  if (v.demo) {
    if (me) { const w = weekDemo(v); return { workoutsTotal: w.all.length, workoutsWeek: w.week, prs: DEMO_PRS, xp: demoXp(w.today), streak: streakOf(demoActiveDays(w.today), w.today).days }; }
    const a = [...DEMO_AUTHORS, ...DEMO_SUGGEST].find((x) => x.id === userId);
    if (!a) return null;
    const n = Math.round((a.xp ?? 0) / 150);
    return { workoutsTotal: n, workoutsWeek: Math.min(5, Math.max(1, Math.round(n / 8))), prs: Math.round(n / 6), xp: a.xp ?? 0, streak: null };
  }
  const sb = await createClient();
  const { data, error } = await sb.rpc("community_profile_stats", { p_user: userId });
  const row = (Array.isArray(data) ? data[0] : data) as { workouts_total: number; workouts_week: number; prs_total: number; total_xp: number } | null;
  if (error || !row) return null;
  return { workoutsTotal: Number(row.workouts_total), workoutsWeek: Number(row.workouts_week), prs: Number(row.prs_total), xp: Number(row.total_xp), streak: me ? (await myStreak(sb, v)).days : null };
}

const addDays = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** Racha igual que en Hoy: entreno, registro diario o pesaje cuentan como día activo. */
async function myStreak(sb: Sb, v: Viewer) {
  const today = todayFor(v).iso, since = addDays(today, -90);
  const [{ data: wk }, { data: dl }, { data: ws }] = await Promise.all([
    sb.from("workouts").select("day").eq("user_id", v.id).gte("day", since),
    sb.from("daily_logs").select("day").eq("user_id", v.id).gte("day", since),
    sb.from("weights").select("day").eq("user_id", v.id).gte("day", since),
  ]);
  return streakOf(new Set([...(wk ?? []), ...(dl ?? []), ...(ws ?? [])].map((r) => r.day as string)), today);
}

// ───────────── Tu semana (encabezado de La tropa) ─────────────
export type WeekStats = { workouts: number; kudos: number; streak: number; todayDone: boolean; xp: number };

/** Entrenos de esta semana (días distintos, como el ranking), bananas recibidas desde el lunes, racha y XP total. */
export async function getWeekStats(v: Viewer): Promise<WeekStats> {
  if (v.demo) {
    const w = weekDemo(v);
    const s = streakOf(demoActiveDays(w.today), w.today);
    const kudos = demoFeed(v).filter((p) => p.mine).reduce((a, p) => a + p.kudos, 0);
    return { workouts: w.week, kudos, streak: s.days, todayDone: s.todayDone, xp: demoXp(w.today) };
  }
  const sb = await createClient();
  const today = todayFor(v).iso, mon = mondayIso(today);
  const since = zonedMidnightUtc(mon, v.tz).toISOString();
  const [{ data: wk }, kd, s, xp] = await Promise.all([
    sb.from("workouts").select("day").eq("user_id", v.id).gte("day", mon),
    sb.from("kudos").select("post_id,posts!inner(user_id)", { count: "exact", head: true }).eq("posts.user_id", v.id).neq("user_id", v.id).gte("created_at", since),
    myStreak(sb, v),
    getXpTotal(v).catch(() => 0),
  ]);
  return {
    workouts: new Set((wk ?? []).map((r) => r.day as string)).size,
    kudos: kd.error ? 0 : kd.count ?? 0,
    streak: s.days, todayDone: s.todayDone,
    xp,
  };
}

// ───────────── Entreno de hoy (para "Terminé mi entreno") ─────────────
export type TodayWorkout = { id: string; title: string; mins: number | null; sets: number; volume: number; ex: string[]; published: boolean };

/** El último entreno registrado hoy, con su resumen y si ya está en la comunidad. */
export async function getTodayWorkout(v: Viewer): Promise<TodayWorkout | null> {
  if (v.demo) return null; // en la historia del demo, hoy todavía no entrena
  const sb = await createClient();
  const { data: w } = await sb.from("workouts").select("id,template,started_at,finished_at").eq("user_id", v.id).eq("day", todayFor(v).iso).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!w) return null;
  const [{ data: sets }, { data: post }] = await Promise.all([
    sb.from("workout_sets").select("exercise,kg,reps").eq("workout_id", w.id),
    sb.from("posts").select("id").eq("workout_id", w.id).limit(1).maybeSingle(),
  ]);
  return { id: w.id as string, ...summarizeWorkout(w, sets ?? []), published: !!post };
}

/** Resumen público de un entreno (sin pesos corporales ni medidas): título, minutos, series, volumen y ejercicios. */
export function summarizeWorkout(w: { template: string; started_at: string | null; finished_at: string | null }, sets: { exercise: string; kg: number | null; reps: number | null }[]) {
  const ms = w.started_at && w.finished_at ? new Date(w.finished_at).getTime() - new Date(w.started_at).getTime() : NaN;
  const ex: string[] = [];
  for (const s of sets) { const n = exerciseName(s.exercise); if (!ex.includes(n)) ex.push(n); }
  return {
    title: workoutName(w.template).slice(0, 60),
    mins: Number.isFinite(ms) && ms > 0 ? Math.min(240, Math.max(1, Math.round(ms / 60000))) : null,
    sets: sets.length,
    volume: Math.round(sets.reduce((a, s) => a + Number(s.kg ?? 0) * Number(s.reps ?? 0), 0)),
    ex: ex.slice(0, 6).map((x) => x.slice(0, 40)),
  };
}

// ───────────── Ranking semanal ─────────────
export type BoardScope = "siguiendo" | "pais" | "global";
export const BOARD_SCOPES: [BoardScope, string][] = [["siguiendo", "Siguiendo"], ["pais", "Mi país"], ["global", "Global"]];

export async function getLeaderboard(v: Viewer, scope: BoardScope = "siguiendo"): Promise<BoardRow[]> {
  if (v.demo) {
    const w = weekDemo(v);
    const base = [
      { userId: "d2", username: "diego.sol", name: "Diego Solís", workouts: 6, xp: 905, totalXp: 5180, me: false },
      { userId: v.id, username: "andres", name: "Andrés", workouts: w.week, xp: w.week * 140, totalXp: demoXp(w.today), me: true },
      { userId: "d1", username: "carla.fit", name: "Carla Mora", workouts: 5, xp: 690, totalXp: 3420, me: false },
      { userId: "d3", username: "vale.run", name: "Valeria Jiménez", workouts: 3, xp: 395, totalXp: 1240, me: false },
    ];
    const extra = DEMO_SUGGEST.map((s, i) => ({ userId: s.id, username: s.username, name: s.name, workouts: s.activeDays > 6 ? 4 : 2, xp: [760, 320, 140][i], totalXp: s.xp ?? 0, me: false, sameCountry: s.sameCountry }));
    const rows = scope === "siguiendo" ? base : scope === "global" ? [...base, ...extra] : [base[1], base[0], ...extra.filter((x) => x.sameCountry)];
    const flairOf = (id: string) => (id === v.id ? DEMO_ME_FLAIR : DEMO_FLAIR[id] ?? null);
    return rows.sort((a, b) => b.xp - a.xp).map((r, i) => ({ userId: r.userId, username: r.username, name: r.name, workouts: r.workouts, xp: r.xp, totalXp: r.totalXp, me: r.me, pos: i + 1, flair: flairOf(r.userId) }));
  }
  const sb = await createClient();
  const { data, error } = await sb.rpc("community_board", { p_scope: scope });
  if (!error) {
    const rows = (data ?? []) as { user_id: string; username: string | null; full_name: string | null; workouts: number; xp: number; total_xp: number; pos: number }[];
    const fl = await getFlair(sb, rows.map((r) => r.user_id));
    return rows.map((r) => ({ userId: r.user_id, username: r.username, name: r.full_name || r.username || "Atleta", workouts: Number(r.workouts), xp: Number(r.xp), totalXp: Number(r.total_xp), pos: Number(r.pos), me: r.user_id === v.id, flair: fl?.get(r.user_id) ?? null }));
  }
  if (!missingRpc(error) || scope !== "siguiendo") return [];
  // Sin la migración 0019: el ranking de siempre (tú y a quienes sigues).
  const { data: old } = await sb.rpc("weekly_leaderboard");
  return ((old ?? []) as { user_id: string; username: string | null; full_name: string | null; workouts: number; xp: number }[]).map((r, i) => ({ userId: r.user_id, username: r.username, name: r.full_name || r.username || "Atleta", workouts: Number(r.workouts), xp: Number(r.xp), totalXp: null, pos: i + 1, me: r.user_id === v.id }));
}

// ───────────── Descubrir: personas ─────────────
export type PeopleFilter = "todos" | "cerca" | "objetivo" | "activos";
export type Person = Author & { bio: string | null; sameCountry: boolean; sameGoal: boolean; activeDays: number; followers: number };

/** Personas con perfil público que todavía no sigues (reales, nunca inventadas). */
export async function getPeople(v: Viewer, filter: PeopleFilter = "todos"): Promise<Person[]> {
  if (v.demo) {
    const all = DEMO_SUGGEST.map((s) => ({ ...s }));
    return filter === "cerca" ? all.filter((p) => p.sameCountry) : filter === "objetivo" ? all.filter((p) => p.sameGoal) : filter === "activos" ? all.filter((p) => p.activeDays > 0).sort((a, b) => b.activeDays - a.activeDays) : all;
  }
  const sb = await createClient();
  const { data, error } = await sb.rpc("community_people", { p_filter: filter });
  if (!error) {
    const rows = (data ?? []) as { id: string; username: string; full_name: string | null; bio: string | null; same_country: boolean; same_goal: boolean; active_days: number; total_xp: number | null; followers: number }[];
    const fl = await getFlair(sb, rows.map((r) => r.id));
    return rows.map((r) => ({ id: r.id, username: r.username, name: r.full_name || r.username, bio: r.bio, sameCountry: !!r.same_country, sameGoal: !!r.same_goal, activeDays: Number(r.active_days), xp: r.total_xp === null ? null : Number(r.total_xp), followers: Number(r.followers), flair: fl?.get(r.id) ?? null }));
  }
  if (!missingRpc(error) || filter !== "todos") return [];
  // Sin la migración 0019: perfiles públicos sin filtros.
  const { data: f } = await sb.from("follows").select("followee").eq("follower", v.id);
  const skip = new Set([v.id, ...(f ?? []).map((r) => r.followee as string)]);
  const { data: pp } = await sb.from("public_profiles").select("id,username,full_name,bio").eq("visibility", "publico").limit(30);
  return (pp ?? []).filter((p) => !skip.has(p.id as string)).slice(0, 12).map((p) => ({ id: p.id as string, username: p.username as string, name: (p.full_name as string) || (p.username as string), bio: (p.bio as string) ?? null, sameCountry: false, sameGoal: false, activeDays: 0, xp: null, followers: 0 }));
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
