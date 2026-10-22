import Link from "next/link";
import { getViewer } from "@/lib/supabase/server";
import { getAthlete } from "@/lib/athlete";
import { getCommunityMe, getFeed, getLeaderboard, getPeople, getTodayWorkout, getWeekStats, type BoardScope, type PeopleFilter, type Person } from "@/lib/community";
import { COUNTRY_NAME } from "@/lib/countries";
import { PostCard } from "@/components/post-card";
import { Avatar, LevelBadge } from "@/components/community/avatar";
import { MapPin } from "@/components/community/icons";
import { ArrowRight, BananaMedal, BananaTrophy, Lightning, MagnifyingGlass, MonkeyBanana, ShieldCheck, Target, Users } from "@/components/icons";
import { Composer, ComposeTrigger } from "./composer";
import { TropaHero } from "./hero";
import { PersonCard, PersonRow } from "./people";
import { Ranking } from "./ranking";
import { RefreshButton } from "./refresh";

export const metadata = { title: "Comunidad" };

const TABS = [["siguiendo", "Siguiendo", Users], ["descubrir", "Descubrir", MagnifyingGlass], ["ranking", "Ranking", BananaTrophy]] as const;
type Tab = (typeof TABS)[number][0];
const SCOPES: BoardScope[] = ["siguiendo", "pais", "global"];
const FILTERS: [PeopleFilter, string, typeof Users][] = [["todos", "Todos", Users], ["cerca", "Cerca de ti", MapPin], ["objetivo", "Mismo objetivo", Target], ["activos", "Más activos", Lightning]];

function EmptyState({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="card p-6 sm:p-8 text-center">
      <span className="mx-auto grid place-items-center size-20 rounded-[1.75rem] bg-banana-soft text-banana-ink" aria-hidden><MonkeyBanana className="size-12" /></span>
      <p className="mt-3 text-lg font-extrabold text-ink">{title}</p>
      <p className="mt-1 text-muted text-pretty">{children}</p>
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/** Feed vacío: tres caminos reales para arrancar (publicar, seguir gente que existe, unirse a un reto). */
function EmptyFeed({ people, canPost }: { people: Person[]; canPost: boolean }) {
  return (
    <section className="card overflow-hidden" aria-labelledby="vacio-t">
      <div className="flex items-center gap-4 bg-gradient-to-br from-banana-soft to-cream p-5">
        <span className="grid place-items-center size-16 shrink-0 rounded-3xl bg-banana text-ink rotate-[-4deg]" aria-hidden><MonkeyBanana weight="fill" className="size-11 [--bb-icon-bg:#FFD60A]" /></span>
        <div className="min-w-0">
          <h2 id="vacio-t" className="text-lg font-extrabold text-ink leading-tight">Tu feed arranca contigo</h2>
          <p className="mt-1 text-sm text-body">Aquí ves tus publicaciones y las de quienes sigues. Tres formas de empezar:</p>
        </div>
      </div>
      <ol className="divide-y divide-line">
        {canPost && (
          <li className="flex items-center gap-3 p-4">
            <span className="grid place-items-center size-10 shrink-0 rounded-2xl bg-ink text-banana" aria-hidden><BananaMedal weight="fill" className="size-5" /></span>
            <div className="flex-1 min-w-0"><p className="font-bold text-ink">Publica tu primer logro</p><p className="text-sm text-muted">Grande o pequeño, cuenta.</p></div>
            <ComposeTrigger tag="logro" className="btn-banana h-11 px-4 text-sm shrink-0">Publicar</ComposeTrigger>
          </li>
        )}
        <li className="p-4">
          <div className="flex items-center gap-3">
            <span className="grid place-items-center size-10 shrink-0 rounded-2xl bg-banana-soft text-banana-ink" aria-hidden><Users weight="duotone" className="size-5" /></span>
            <div className="flex-1 min-w-0"><p className="font-bold text-ink">Sigue a gente que entrena</p><p className="text-sm text-muted">{people.length ? "Personas reales con perfil público." : "Todavía no hay perfiles públicos para sugerirte. Invita a alguien de tu gym."}</p></div>
          </div>
          {people.length > 0 && <ul className="mt-3 space-y-3 pl-0 sm:pl-13">{people.slice(0, 3).map((p) => <PersonRow key={p.id} p={p} />)}</ul>}
          {people.length > 3 && <Link href="/app/comunidad?vista=descubrir" className="tap mt-2 inline-flex h-11 items-center gap-1 text-sm font-bold text-banana-ink hover:text-ink sm:ml-13">Ver más personas<ArrowRight weight="bold" className="size-4" /></Link>}
        </li>
        <li className="flex items-center gap-3 p-4">
          <span className="grid place-items-center size-10 shrink-0 rounded-2xl bg-banana-soft text-banana-ink" aria-hidden><BananaTrophy className="size-5" /></span>
          <div className="flex-1 min-w-0"><p className="font-bold text-ink">Únete a un reto</p><p className="text-sm text-muted">Al completarlo, tu medalla aparece aquí.</p></div>
          <Link href="/app/retos" className="btn-ghost h-11 px-4 text-sm shrink-0">Ver retos</Link>
        </li>
      </ol>
    </section>
  );
}

export default async function Comunidad({ searchParams }: { searchParams: Promise<{ vista?: string; alcance?: string; filtro?: string }> }) {
  const sp = await searchParams;
  const v = (await getViewer())!;
  const tab: Tab = TABS.some(([k]) => k === sp.vista) ? (sp.vista as Tab) : "siguiendo";
  const scope: BoardScope = SCOPES.includes(sp.alcance as BoardScope) ? (sp.alcance as BoardScope) : "siguiendo";
  const filter: PeopleFilter = FILTERS.some(([k]) => k === sp.filtro) ? (sp.filtro as PeopleFilter) : "todos";
  const [a, me, stats] = await Promise.all([getAthlete(v), getCommunityMe(v), getWeekStats(v)]);
  const [feed, board, people, today] = await Promise.all([
    tab === "ranking" ? Promise.resolve([]) : getFeed(v, tab),
    tab === "ranking" ? getLeaderboard(v, scope) : Promise.resolve([]),
    getPeople(v, tab === "descubrir" ? filter : "activos").then((p) => (p.length || tab === "descubrir" ? p : getPeople(v, "todos"))),
    tab === "siguiendo" ? getTodayWorkout(v) : Promise.resolve(null),
  ]);
  const country = v.country && COUNTRY_NAME[v.country] ? COUNTRY_NAME[v.country] : null;
  const canPost = !me.suspended;

  return (
    <div className="space-y-5 animate-enter">
      <TropaHero stats={stats} />

      <div className="flex items-center gap-2">
        <nav className="grid flex-1 grid-cols-3 rounded-full bg-white border border-line p-1 sm:flex-none sm:w-fit" aria-label="Vistas de la comunidad">
          {TABS.map(([k, l, Icon]) => {
            const on = tab === k;
            return (
              <Link key={k} href={`/app/comunidad?vista=${k}`} aria-current={on ? "page" : undefined} scroll={false}
                className={`tap pressable flex h-11 items-center justify-center gap-1.5 rounded-full px-2 sm:px-4 text-sm font-bold whitespace-nowrap ${on ? "bg-ink text-white shadow-soft" : "text-muted hover:bg-cream hover:text-ink"}`}>
                <Icon weight={on ? "fill" : "duotone"} className={`size-4 ${on ? "text-banana" : ""}`} />{l}
              </Link>
            );
          })}
        </nav>
        <RefreshButton />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr] items-start [&>*]:min-w-0">
        <div className="space-y-4">
          {tab === "ranking" ? (
            <Ranking rows={board} scope={scope} country={country} />
          ) : tab === "descubrir" ? (
            <>
              <section aria-labelledby="personas-t" className="space-y-3">
                <h2 id="personas-t" className="text-xl font-extrabold text-ink">Personas para seguir</h2>
                <nav aria-label="Filtrar personas" className="flex flex-wrap gap-2">
                  {FILTERS.filter(([k]) => k !== "cerca" || v.country).map(([k, l, Icon]) => {
                    const on = filter === k;
                    return (
                      <Link key={k} href={`/app/comunidad?vista=descubrir${k === "todos" ? "" : `&filtro=${k}`}`} aria-current={on ? "page" : undefined} scroll={false}
                        className={`chip pressable h-11 px-4 text-[13px] font-bold border ${on ? "bg-ink text-white border-ink" : "bg-white text-ink border-line hover:border-ink/30"}`}>
                        <Icon weight={on ? "fill" : "duotone"} className={`size-4 ${on ? "text-banana" : "text-banana-ink"}`} />{k === "cerca" && country ? `En ${country}` : l}
                      </Link>
                    );
                  })}
                </nav>
                {people.length ? (
                  <ul className="grid gap-3 sm:grid-cols-2">{people.map((p) => <PersonCard key={p.id} p={p} />)}</ul>
                ) : (
                  <p className="card p-5 text-sm text-muted">
                    {filter === "todos" ? "Por ahora no hay más perfiles públicos. Invita a alguien de tu gym y entrenen juntos." : filter === "cerca" ? `Todavía no hay perfiles públicos ${country ? `en ${country}` : "en tu país"} que no sigas.` : filter === "objetivo" ? "Todavía no hay perfiles públicos con tu mismo objetivo que no sigas." : "Nadie con perfil público entrenó en las últimas dos semanas."}
                    {filter !== "todos" && <> <Link href="/app/comunidad?vista=descubrir" className="font-bold text-ink underline">Ver todos</Link></>}
                  </p>
                )}
              </section>
              <section aria-labelledby="publicas-t" className="space-y-4 pt-2">
                <h2 id="publicas-t" className="text-xl font-extrabold text-ink">Publicaciones públicas</h2>
                {feed.length ? feed.map((p) => <PostCard key={p.id} p={p} me={a.name} />) : (
                  <EmptyState title="Todavía no hay publicaciones públicas" action={<Link href="/app/perfil#comunidad" className="btn-ghost h-11 px-5">Hacer público mi perfil<ArrowRight weight="bold" className="size-4" /></Link>}>
                    Aquí verás lo que comparten las personas con perfil público. Puedes ser de las primeras.
                  </EmptyState>
                )}
              </section>
            </>
          ) : (
            <>
              <Composer me={a.name} meXp={stats.xp} visibility={me.visibility} suspended={me.suspended} today={today} feedIds={feed.map((p) => p.id)} />
              {feed.length ? feed.map((p) => <PostCard key={p.id} p={p} me={a.name} />) : <EmptyFeed people={people} canPost={canPost} />}
            </>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6">
          {!me.username && !v.demo && (
            <section className="card p-4">
              <p className="flex items-center gap-2 font-extrabold text-ink"><Users weight="duotone" className="size-5 text-banana-ink" />Elige tu usuario</p>
              <p className="mt-1 text-sm text-muted">Con un usuario, otras personas pueden encontrarte y ver tu perfil.</p>
              <Link href="/app/perfil#comunidad" className="tap mt-2 inline-flex h-11 items-center gap-1 font-bold text-banana-ink hover:text-ink">Crear mi perfil<ArrowRight weight="bold" className="size-4" /></Link>
            </section>
          )}
          {me.username && (
            <Link href={`/app/comunidad/u/${me.username}`} className="card pressable flex items-center gap-3 p-4 hover:bg-banana-soft/40">
              <Avatar name={a.name} xp={stats.xp} />
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-ink truncate">Mi perfil en la tropa</span>
                <span className="flex items-center gap-1.5 text-xs text-faint"><span className="truncate">@{me.username}</span><LevelBadge xp={stats.xp} compact /></span>
              </span>
              <ArrowRight weight="bold" className="size-4 text-muted" />
            </Link>
          )}
          {tab !== "descubrir" && (feed.length > 0 || tab === "ranking") && (
            <section className="card p-4" aria-labelledby="sugerencias">
              <h2 id="sugerencias" className="font-extrabold text-ink">Personas para seguir</h2>
              {people.length ? (
                <>
                  <ul className="mt-3 space-y-3">{people.slice(0, 4).map((p) => <PersonRow key={p.id} p={p} />)}</ul>
                  <Link href="/app/comunidad?vista=descubrir" className="tap mt-2 inline-flex h-11 items-center gap-1 text-sm font-bold text-banana-ink hover:text-ink">Descubrir más<ArrowRight weight="bold" className="size-4" /></Link>
                </>
              ) : <p className="mt-2 text-sm text-muted">Por ahora no hay más perfiles públicos. Invita a alguien de tu gym.</p>}
            </section>
          )}
          <section className="card p-4 text-sm text-muted">
            <p className="flex items-center gap-2 font-bold text-ink"><ShieldCheck weight="duotone" className="size-5 text-peel" />Tu privacidad</p>
            <p className="mt-1">De tus entrenos solo compartimos el resumen (tiempo, series, volumen, ejercicios, récords y XP). Nunca tu peso, medidas ni fotos.</p>
            <Link href="/app/perfil#comunidad" className="tap mt-2 inline-flex h-11 items-center gap-1 font-bold text-banana-ink hover:text-ink">Configurar perfil público<ArrowRight weight="bold" className="size-4" /></Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
