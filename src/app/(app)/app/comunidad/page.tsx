import Link from "next/link";
import { getViewer } from "@/lib/supabase/server";
import { getAthlete } from "@/lib/athlete";
import { getFeed, getLeaderboard, getSuggestions } from "@/lib/community";
import { PostCard } from "@/components/post-card";
import { FollowButton } from "./follow";

export const metadata = { title: "Comunidad" };

const TABS = [["siguiendo", "Siguiendo"], ["descubrir", "Descubrir"], ["ranking", "Ranking"]] as const;

export default async function Comunidad({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const { vista = "siguiendo" } = await searchParams;
  const v = (await getViewer())!;
  const a = await getAthlete(v);
  const tab = TABS.some(([k]) => k === vista) ? vista : "siguiendo";
  const [feed, board, sugg] = await Promise.all([
    tab === "ranking" ? Promise.resolve([]) : getFeed(v, tab as "siguiendo" | "descubrir"),
    tab === "ranking" ? getLeaderboard(v) : Promise.resolve([]),
    getSuggestions(v),
  ]);
  return (
    <div className="space-y-5 animate-rise">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Comunidad</p>
          <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">La tropa 🍌</h1>
        </div>
        <Link href="/app/retos" className="btn-ghost h-10 px-4 text-sm">🏆 Retos</Link>
      </header>

      <nav className="flex rounded-full bg-white border border-line p-1 w-fit" aria-label="Vistas de la comunidad">
        {TABS.map(([k, l]) => <Link key={k} href={`/app/comunidad?vista=${k}`} aria-current={tab === k ? "page" : undefined} className={`tap pressable h-10 px-4 grid place-items-center rounded-full text-sm font-bold ${tab === k ? "bg-ink text-white" : "text-muted hover:bg-cream hover:text-ink"}`}>{l}</Link>)}
      </nav>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr] items-start [&>*]:min-w-0">
        <div className="space-y-4">
          {tab === "ranking" ? (
            <section className="card overflow-hidden">
              <h2 className="p-4 pb-2 font-extrabold text-ink">🏆 Ranking de la semana</h2>
              <p className="px-4 text-xs text-muted">Tú y las personas que sigues · XP ganado desde el lunes</p>
              <ol className="mt-2">
                {board.map((r, i) => (
                  <li key={r.userId} className={`flex items-center gap-3 px-4 py-3 border-t border-line ${r.me ? "bg-banana-soft/50" : ""}`}>
                    <span className={`grid place-items-center size-8 rounded-full text-sm font-extrabold ${i === 0 ? "bg-banana text-ink" : i < 3 ? "bg-cream text-ink" : "text-muted"}`}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
                    <span className="flex-1 min-w-0 font-bold text-ink truncate">{r.name}{r.me && " (tú)"}</span>
                    <span className="text-sm text-muted tabular-nums">{r.workouts} entrenos</span>
                    <span className="w-20 text-right font-extrabold text-ink tabular-nums">{r.xp.toLocaleString("es-CR")} XP</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : feed.length ? (
            feed.map((p) => <PostCard key={p.id} p={p} me={a.name} />)
          ) : (
            <div className="card p-8 text-center">
              <p className="text-5xl">👋</p>
              <p className="mt-3 text-lg font-extrabold text-ink">{tab === "siguiendo" ? "Tu feed está vacío" : "Aún no hay publicaciones públicas"}</p>
              <p className="mt-1 text-muted">Sigue a otras personas y termina tu primer entreno: aparece aquí automáticamente.</p>
            </div>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6">
          <section className="card p-4">
            <h2 className="font-extrabold text-ink">Personas para seguir</h2>
            {sugg.length ? (
              <ul className="mt-3 space-y-3">
                {sugg.map((s) => (
                  <li key={s.id} className="flex items-center gap-3">
                    <span className="grid place-items-center size-9 rounded-full bg-cream font-bold text-ink" aria-hidden>{s.name[0]?.toUpperCase()}</span>
                    <span className="flex-1 min-w-0"><span className="block font-bold text-ink truncate">{s.name}</span>{s.username && <span className="block text-xs text-faint">@{s.username}</span>}</span>
                    <FollowButton userId={s.id} />
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-muted">Invita a tus amigos del gym 💪</p>}
          </section>
          <section className="card p-4 text-sm text-muted">
            <p className="font-bold text-ink">Tu privacidad</p>
            <p className="mt-1">Solo compartimos el resumen del entreno (tiempo, series, volumen, récords). Nunca tu peso, medidas ni fotos.</p>
            <Link href="/app/perfil#comunidad" className="tap mt-2 inline-block font-bold text-banana-ink hover:text-ink">Configurar perfil público →</Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
