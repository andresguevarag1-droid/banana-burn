import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/supabase/server";
import { getAthlete } from "@/lib/athlete";
import { getPublicProfile } from "@/lib/community";
import { PostCard } from "@/components/post-card";
import { ArrowLeft, Globe, LevelIcon, Lock, MonkeyBanana, Users } from "@/components/icons";
import { FollowButton } from "../../follow";
import { ReportUser } from "./report-user";
import { createClient } from "@/lib/supabase/server";
import { getXpTotal } from "@/lib/xp-server";
import { levelOf, perksAt } from "@/lib/gamify";
import { FRAME_RING } from "@/components/levels/level-badge";

/** XP público (solo total; nada si el perfil es privado). En demo solo se conoce el propio, no se inventa el de otros. */
async function publicXp(v: Awaited<ReturnType<typeof getViewer>>, id: string, me: boolean): Promise<number | null> {
  if (!v) return null;
  if (me) return getXpTotal(v);
  if (v.demo) return null;
  const { data, error } = await (await createClient()).rpc("community_xp", { p_user: id });
  return error || data === null ? null : Number(data);
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return { title: `@${username.slice(0, 24)}` };
}

export default async function PerfilPublico({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const v = (await getViewer())!;
  const p = await getPublicProfile(v, decodeURIComponent(username));
  if (!p) notFound();
  const [a, xp] = await Promise.all([getAthlete(v), publicXp(v, p.id, p.me).catch(() => null)]);
  const lv = xp !== null ? levelOf(xp) : null;
  const frame = lv ? perksAt(lv.idx).frame : null;
  const fmt = (n: number) => n.toLocaleString("es-419");
  return (
    <div className="space-y-5 animate-enter max-w-2xl">
      <Link href="/app/comunidad" className="tap inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft weight="bold" className="size-4" />Comunidad</Link>
      <header className="card p-5">
        <div className="flex items-start gap-4">
          <span className={`grid place-items-center size-16 shrink-0 rounded-3xl bg-banana text-2xl font-extrabold text-ink ${frame ? FRAME_RING[frame] : ""}`} aria-hidden>{p.name[0]?.toUpperCase()}</span>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight text-ink truncate">{p.name}</h1>
            <p className="text-sm text-faint truncate">@{p.username}</p>
            {lv && <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-banana-soft px-2 py-0.5 text-xs font-bold text-banana-ink"><LevelIcon idx={lv.idx} className="size-3.5" />{lv.n}, nivel {lv.idx}</p>}
            {p.bio && <p className="mt-2 text-[15px] text-body break-words">{p.bio}</p>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="text-muted"><b className="text-ink tabular-nums">{fmt(p.followers)}</b> {p.followers === 1 ? "seguidor" : "seguidores"}</span>
          <span className="text-muted"><b className="text-ink tabular-nums">{fmt(p.following)}</b> siguiendo</span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-faint">{p.visibility === "publico" ? <><Globe weight="duotone" className="size-4" />Perfil público</> : <><Users weight="duotone" className="size-4" />Solo seguidores ven sus entrenos</>}</span>
          <span className="ml-auto flex items-center gap-2">
            {p.me ? <Link href="/app/perfil#comunidad" className="btn-ghost h-11 px-4 text-sm">Editar perfil</Link> : <><ReportUser userId={p.id} /><FollowButton userId={p.id} name={p.name} initial={p.iFollow} refresh /></>}
          </span>
        </div>
      </header>

      <section className="space-y-4" aria-labelledby="pp-posts">
        <h2 id="pp-posts" className="font-extrabold text-ink">Publicaciones</h2>
        {p.posts.length ? p.posts.map((x) => <PostCard key={x.id} p={x} me={a.name} />) : (
          <div className="card p-8 text-center">
            <span className="mx-auto grid place-items-center size-16 rounded-3xl bg-banana-soft text-banana-ink" aria-hidden>{p.visibility === "publico" || p.iFollow || p.me ? <MonkeyBanana className="size-10" /> : <Lock weight="duotone" className="size-8" />}</span>
            <p className="mt-3 font-extrabold text-ink">{p.me ? "Todavía no publicas nada" : p.visibility === "publico" || p.iFollow ? "Sin publicaciones todavía" : "Sus publicaciones son para seguidores"}</p>
            <p className="mt-1 text-sm text-muted">{p.me ? "Publica desde la comunidad o termina un entreno con la publicación automática activada." : p.visibility === "publico" || p.iFollow ? "Cuando publique algo, aparece aquí." : "Síguele para ver sus entrenos y logros."}</p>
          </div>
        )}
      </section>
    </div>
  );
}
