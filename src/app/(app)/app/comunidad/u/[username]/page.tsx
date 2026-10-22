import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/supabase/server";
import { getAthlete } from "@/lib/athlete";
import { getProfileStats, getPublicProfile } from "@/lib/community";
import { fmtDuration, fmtNum, fmtVolume, plural, publicBadges, timeAgo } from "@/lib/community-view";
import { PostCard } from "@/components/post-card";
import { Avatar, LevelBadge } from "@/components/community/avatar";
import { ArrowLeft, Banana, BananaTrophy, BrandIcon, Globe, Lock, MonkeyBanana, PencilSimple, Users } from "@/components/icons";
import { FollowButton } from "../../follow";
import { ReportUser } from "./report-user";
import { levelOf, perksAt } from "@/lib/gamify";
import { FRAME_RING } from "@/components/levels/level-badge";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return { title: `@${username.slice(0, 24)}` };
}

export default async function PerfilPublico({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const v = (await getViewer())!;
  const p = await getPublicProfile(v, decodeURIComponent(username));
  if (!p) notFound();
  const [a, stats] = await Promise.all([getAthlete(v), getProfileStats(v, p.id, p.me)]);
  const xp = stats?.xp ?? null;
  const frame = xp !== null ? perksAt(levelOf(xp).idx).frame : null;
  const canSee = p.visibility === "publico" || p.iFollow || p.me;
  const workouts = p.posts.filter((x) => x.kind === "workout").slice(0, 4);
  const allBadges = stats ? publicBadges({ workouts: stats.workoutsTotal, prs: stats.prs, streak: p.me ? stats.streak : undefined }) : [];
  const shownBadges = p.me ? allBadges : allBadges.filter((b) => b.got);
  const numbers: [string, number][] = [
    [p.followers === 1 ? "Seguidor" : "Seguidores", p.followers],
    ["Siguiendo", p.following],
    ...(stats ? ([["Entrenos", stats.workoutsTotal], ["Esta semana", stats.workoutsWeek], [stats.prs === 1 ? "Récord" : "Récords", stats.prs]] as [string, number][]) : []),
    ...(stats && p.me && stats.streak !== null ? ([["Racha", stats.streak]] as [string, number][]) : []),
  ];

  return (
    <div className="space-y-5 animate-enter max-w-2xl">
      <Link href="/app/comunidad" className="tap inline-flex h-11 items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft weight="bold" className="size-4" />La tropa</Link>

      <header className="card overflow-hidden">
        {/* Portada de marca */}
        <div aria-hidden className="relative h-32 sm:h-40 overflow-hidden bg-ink">
          <div className="absolute -right-10 -top-16 size-64 rounded-full bg-banana/30 blur-3xl" />
          <div className="absolute left-1/4 -bottom-20 size-48 rounded-full bg-ember/25 blur-3xl" />
          <Banana weight="fill" className="bb-sway absolute left-6 top-5 size-7 text-banana/40" style={{ ["--r" as string]: "-20deg" }} />
          <Banana weight="fill" className="bb-sway absolute left-[42%] top-10 size-5 text-banana/25 [animation-delay:1.4s]" style={{ ["--r" as string]: "30deg" }} />
          <Banana weight="duotone" className="bb-sway absolute right-[30%] bottom-4 size-6 text-white/20 [animation-delay:2.2s]" style={{ ["--r" as string]: "8deg" }} />
          <MonkeyBanana weight="fill" className="absolute -right-4 -bottom-6 size-36 sm:size-44 text-banana rotate-[-8deg] [--bb-icon-bg:#1B1505]" />
        </div>
        <div className="px-5 pb-5">
          <div className="flex items-end justify-between gap-3">
            <Avatar name={p.name} xp={xp} size="xl" className={`relative z-10 -mt-12 !ring-offset-0 shadow-lift ${frame ? "" : "ring-4 !ring-white"}`} frame={frame ? FRAME_RING[frame] : ""} />
            <div className="flex items-center gap-2 pt-3">
              {p.me ? <Link href="/app/perfil#comunidad" className="btn-ghost h-11 px-4 text-sm"><PencilSimple weight="bold" className="size-4" />Editar perfil</Link> : <><ReportUser userId={p.id} /><FollowButton userId={p.id} name={p.name} initial={p.iFollow} refresh /></>}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 text-2xl sm:text-3xl font-extrabold tracking-tight text-ink break-words">{p.name}</h1>
            <LevelBadge xp={xp} />
          </div>
          <p className="text-sm text-faint">@{p.username}</p>
          {p.bio && <p className="mt-2 text-[15px] text-body break-words">{p.bio}</p>}
          <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-faint">{p.visibility === "publico" ? <><Globe weight="duotone" className="size-4" />Perfil público</> : <><Users weight="duotone" className="size-4" />Solo seguidores ven sus entrenos</>}</p>

          <dl className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-2">
            {numbers.map(([k, n]) => (
              <div key={k} className="flex flex-col-reverse rounded-2xl bg-cream px-2 py-2.5 text-center">
                <dt className="mt-1 text-[11px] font-semibold text-muted">{k}</dt>
                <dd className="text-lg font-extrabold text-ink tabular-nums leading-none">{fmtNum(n)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      {shownBadges.length > 0 && (
        <section className="card p-4" aria-labelledby="pp-logros">
          <h2 id="pp-logros" className="font-extrabold text-ink">Logros</h2>
          <ul className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {shownBadges.map((b) => (
              <li key={b.id} className={`flex items-center gap-2.5 rounded-2xl p-2.5 ${b.got ? "bg-banana-soft" : "bg-cream"}`}>
                <span className={`grid place-items-center size-10 shrink-0 rounded-xl ${b.got ? "bg-banana text-ink" : "bg-white text-faint"}`}>{b.got ? <BrandIcon name={b.icon} className="size-5" /> : <Lock weight="duotone" className="size-5" />}</span>
                <span className="min-w-0"><span className={`block text-sm font-bold leading-tight ${b.got ? "text-ink" : "text-muted"}`}>{b.n}</span><span className="block text-[11px] text-muted leading-tight">{b.got ? "Conseguido" : b.d}</span></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {workouts.length > 0 && (
        <section className="card overflow-hidden" aria-labelledby="pp-entrenos">
          <h2 id="pp-entrenos" className="p-4 pb-2 font-extrabold text-ink">Entrenos recientes</h2>
          <ul>
            {workouts.map((w) => {
              const bits = [fmtDuration(w.data.mins), w.data.sets ? plural(w.data.sets, "serie", "series") : null, fmtVolume(w.data.volume)].filter(Boolean).join(", ");
              return (
                <li key={w.id} className="flex items-center gap-3 border-t border-line px-4 py-3">
                  <span className="grid place-items-center size-10 shrink-0 rounded-xl bg-ink text-banana"><BrandIcon name={w.data.icon ?? "barbell"} className="size-5" /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold text-ink truncate">{w.data.title ?? "Entreno"}</span>
                    <span className="block text-xs text-muted truncate"><time dateTime={w.at} suppressHydrationWarning>{timeAgo(w.at)}</time>{bits ? `, ${bits}` : ""}</span>
                  </span>
                  {w.data.prs && w.data.prs.length > 0 && <span className="chip bg-banana text-ink shrink-0"><BananaTrophy className="size-3.5" />{w.data.prs.length === 1 ? "Récord" : `${w.data.prs.length} récords`}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-4" aria-labelledby="pp-posts">
        <h2 id="pp-posts" className="text-xl font-extrabold text-ink">Publicaciones</h2>
        {p.posts.length ? p.posts.map((x) => <PostCard key={x.id} p={x} me={a.name} />) : (
          <div className="card p-8 text-center">
            <span className="mx-auto grid place-items-center size-16 rounded-3xl bg-banana-soft text-banana-ink" aria-hidden>{canSee ? <MonkeyBanana className="size-10" /> : <Lock weight="duotone" className="size-8" />}</span>
            <p className="mt-3 font-extrabold text-ink">{p.me ? "Todavía no publicas nada" : canSee ? "Sin publicaciones todavía" : "Sus publicaciones son para seguidores"}</p>
            <p className="mt-1 text-sm text-muted">{p.me ? "Publica desde la comunidad o termina un entreno con la publicación automática activada." : canSee ? "Cuando publique algo, aparece aquí." : "Síguele para ver sus entrenos y logros."}</p>
            {p.me && <Link href="/app/comunidad" className="btn-banana mt-4 h-11 px-5 text-sm">Ir a La tropa</Link>}
          </div>
        )}
      </section>
    </div>
  );
}
