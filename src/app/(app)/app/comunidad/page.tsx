import Link from "next/link";
import { getViewer } from "@/lib/supabase/server";
import { getAthlete } from "@/lib/athlete";
import { getCommunityMe, getFeed, getLeaderboard, getSuggestions } from "@/lib/community";
import { PostCard } from "@/components/post-card";
import { FollowButton } from "./follow";
import { Composer } from "./composer";
import { ArrowRight, BananaMedal, BananaTrophy, MonkeyBanana, Users } from "@/components/icons";

export const metadata = { title: "Comunidad" };

const TABS = [["siguiendo", "Siguiendo"], ["descubrir", "Descubrir"], ["ranking", "Ranking"]] as const;

function EmptyState({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="card p-8 text-center">
      <span className="mx-auto grid place-items-center size-20 rounded-[1.75rem] bg-banana-soft text-banana-ink" aria-hidden><MonkeyBanana className="size-12" /></span>
      <p className="mt-3 text-lg font-extrabold text-ink">{title}</p>
      <p className="mt-1 text-muted text-pretty">{children}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export default async function Comunidad({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const { vista = "siguiendo" } = await searchParams;
  const v = (await getViewer())!;
  const a = await getAthlete(v);
  const tab = TABS.some(([k]) => k === vista) ? vista : "siguiendo";
  const [feed, board, sugg, me] = await Promise.all([
    tab === "ranking" ? Promise.resolve([]) : getFeed(v, tab as "siguiendo" | "descubrir"),
    tab === "ranking" ? getLeaderboard(v) : Promise.resolve([]),
    getSuggestions(v),
    getCommunityMe(v),
  ]);
  const onlyMe = board.length <= 1;
  return (
    <div className="space-y-5 animate-enter">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">La tropa</h1>
        </div>
        <Link href="/app/retos" className="btn-ghost h-11 px-4 text-sm"><BananaTrophy className="size-5 text-banana-ink" />Retos</Link>
      </header>

      <nav className="flex rounded-full bg-white border border-line p-1 w-fit max-w-full overflow-x-auto" aria-label="Vistas de la comunidad">
        {TABS.map(([k, l]) => <Link key={k} href={`/app/comunidad?vista=${k}`} aria-current={tab === k ? "page" : undefined} className={`tap pressable h-11 px-4 grid place-items-center rounded-full text-sm font-bold whitespace-nowrap ${tab === k ? "bg-ink text-white" : "text-muted hover:bg-cream hover:text-ink"}`}>{l}</Link>)}
      </nav>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr] items-start [&>*]:min-w-0">
        <div className="space-y-4">
          {tab === "ranking" ? (
            onlyMe ? (
              <EmptyState title="Tu ranking empieza cuando sigues a alguien" action={<Link href="/app/comunidad?vista=descubrir" className="btn-primary h-11 px-5">Descubrir personas<ArrowRight weight="bold" className="size-4" /></Link>}>
                El ranking compara tu XP de la semana con el de las personas que sigues. {board[0] ? `Esta semana llevas ${board[0].xp.toLocaleString("es-419")} XP.` : ""}
              </EmptyState>
            ) : (
              <section className="card overflow-hidden" aria-labelledby="ranking-t">
                <h2 id="ranking-t" className="flex items-center gap-2 p-4 pb-2 font-extrabold text-ink"><BananaTrophy className="size-6 text-banana-ink" />Ranking de la semana</h2>
                <p className="px-4 text-xs text-muted">Tú y las personas que sigues. XP ganado desde el lunes.</p>
                <ol className="mt-2">
                  {board.map((r, i) => (
                    <li key={r.userId} className={`flex items-center gap-3 px-4 py-3 border-t border-line ${r.me ? "bg-banana-soft/50" : ""}`}>
                      <span className={`grid place-items-center size-8 shrink-0 rounded-full text-sm font-extrabold ${i === 0 ? "bg-banana text-ink" : i < 3 ? "bg-cream text-ink" : "text-muted"}`}>{i < 3 ? <><BananaMedal weight={i === 0 ? "fill" : "duotone"} className={`size-5 ${i === 0 ? "text-ink" : "text-banana-ink"}`} /><span className="sr-only">{i + 1}</span></> : i + 1}</span>
                      <span className="flex-1 min-w-0 font-bold text-ink truncate">{r.username && !r.me ? <Link href={`/app/comunidad/u/${r.username}`} className="hover:underline">{r.name}</Link> : r.name}{r.me && " (tú)"}</span>
                      <span className="hidden sm:inline text-sm text-muted tabular-nums">{r.workouts} {r.workouts === 1 ? "entreno" : "entrenos"}</span>
                      <span className="w-20 shrink-0 text-right font-extrabold text-ink tabular-nums">{r.xp.toLocaleString("es-419")} XP</span>
                    </li>
                  ))}
                </ol>
              </section>
            )
          ) : (
            <>
              {tab === "siguiendo" && <Composer me={a.name} visibility={me.visibility} suspended={me.suspended} feedIds={feed.map((p) => p.id)} />}
              {feed.length ? feed.map((p) => <PostCard key={p.id} p={p} me={a.name} />) : tab === "siguiendo" ? (
                <EmptyState title="Tu feed está vacío" action={<Link href="/app/comunidad?vista=descubrir" className="btn-ghost h-11 px-5">Descubrir personas<ArrowRight weight="bold" className="size-4" /></Link>}>
                  Sigue a otras personas o publica algo arriba. Tus entrenos aparecen aquí automáticamente si lo activas en tu perfil.
                </EmptyState>
              ) : (
                <EmptyState title="Todavía no hay publicaciones públicas" action={<Link href="/app/perfil#comunidad" className="btn-ghost h-11 px-5">Hacer público mi perfil<ArrowRight weight="bold" className="size-4" /></Link>}>
                  Aquí verás lo que comparten las personas con perfil público. Puedes ser de las primeras.
                </EmptyState>
              )}
            </>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6">
          {!me.username && !v.demo && (
            <section className="card p-4">
              <p className="flex items-center gap-2 font-extrabold text-ink"><Users weight="duotone" className="size-5 text-banana-ink" />Elige tu usuario</p>
              <p className="mt-1 text-sm text-muted">Con un usuario, otras personas pueden encontrarte y ver tu perfil.</p>
              <Link href="/app/perfil#comunidad" className="tap mt-2 inline-flex items-center gap-1 font-bold text-banana-ink hover:text-ink">Crear mi perfil<ArrowRight weight="bold" className="size-4" /></Link>
            </section>
          )}
          {me.username && <Link href={`/app/comunidad/u/${me.username}`} className="card pressable flex items-center gap-3 p-4 hover:bg-banana-soft/40"><span className="grid place-items-center size-10 shrink-0 rounded-full bg-banana font-extrabold text-ink" aria-hidden>{a.name[0]?.toUpperCase()}</span><span className="flex-1 min-w-0"><span className="block font-bold text-ink truncate">Mi perfil público</span><span className="block text-xs text-faint">@{me.username}</span></span><ArrowRight weight="bold" className="size-4 text-muted" /></Link>}
          <section className="card p-4" aria-labelledby="sugerencias">
            <h2 id="sugerencias" className="font-extrabold text-ink">Personas para seguir</h2>
            {sugg.length ? (
              <ul className="mt-3 space-y-3">
                {sugg.map((s) => (
                  <li key={s.id} className="flex items-center gap-3">
                    <span className="grid place-items-center size-9 shrink-0 rounded-full bg-cream font-bold text-ink" aria-hidden>{s.name[0]?.toUpperCase()}</span>
                    <span className="flex-1 min-w-0">{s.username ? <Link href={`/app/comunidad/u/${s.username}`} className="block font-bold text-ink truncate hover:underline">{s.name}</Link> : <span className="block font-bold text-ink truncate">{s.name}</span>}{s.username && <span className="block text-xs text-faint">@{s.username}</span>}</span>
                    <FollowButton userId={s.id} name={s.name} />
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-muted">Por ahora no hay más perfiles públicos. Invita a tus amigos del gym.</p>}
          </section>
          <section className="card p-4 text-sm text-muted">
            <p className="font-bold text-ink">Tu privacidad</p>
            <p className="mt-1">De tus entrenos solo compartimos el resumen (tiempo, series, volumen, récords). Nunca tu peso, medidas ni fotos.</p>
            <Link href="/app/perfil#comunidad" className="tap mt-2 inline-flex items-center gap-1 font-bold text-banana-ink hover:text-ink">Configurar perfil público<ArrowRight weight="bold" className="size-4" /></Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
