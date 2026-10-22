import { getViewer } from "@/lib/supabase/server";
import { getMyChallenges } from "@/lib/challenges-server";
import { todayMetrics } from "@/lib/metrics";
import { CHALLENGES } from "@/lib/challenges";
import { toView } from "@/lib/challenge-view";
import { ChallengeCard } from "@/components/challenge-card";
import { JoinButton } from "./join";
import { BananaMedal, BrandIcon } from "@/components/icons";

export const metadata = { title: "Retos" };

export default async function Retos() {
  const v = (await getViewer())!;
  const { active, done } = await getMyChallenges(v, await todayMetrics(v));
  const joined = new Set(active.map((a) => a.c.id));
  return (
    <div className="space-y-6 animate-enter">
      <header>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">Hábitos que se quedan</h1>
        <p className="mt-1 max-w-[65ch] text-muted">Un pequeño objetivo cada día durante 21 o 30 días. Al terminar ganas una medalla y XP.</p>
      </header>

      {active.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-extrabold text-ink">En curso</h2>
          <div className="grid gap-3 lg:grid-cols-2">{active.map((m) => <ChallengeCard key={m.ucId} v={toView(m)} />)}</div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-extrabold text-ink">Únete a un reto</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CHALLENGES.filter((c) => !joined.has(c.id)).map((c) => (
            <article key={c.id} className="card p-5 flex flex-col">
              <div className="flex items-center gap-3"><span className={`grid place-items-center size-12 shrink-0 rounded-2xl text-ink ${c.color}`}><BrandIcon name={c.icon} className="size-7" /></span><div><h3 className="font-extrabold text-ink">{c.title}</h3><p className="text-xs font-semibold text-muted tabular-nums">{c.days} días, +{c.xp} XP</p></div></div>
              <p className="mt-3 text-sm text-muted flex-1">{c.desc}</p>
              <p className="mt-2 text-xs font-semibold text-faint">{c.verify === "manual" ? "Lo marcas tú cada día." : "Se verifica solo con tus registros."}</p>
              <div className="mt-4"><JoinButton id={c.id} title={c.title} /></div>
            </article>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="flex items-center gap-2 font-extrabold text-ink"><BananaMedal className="size-6 text-banana-ink" />Medallas de retos</h2>
        {done.length ? (
          <ul className="mt-3 flex flex-wrap gap-3">{done.map((d, i) => <li key={i} className="flex items-center gap-2 rounded-2xl bg-banana-soft px-3 py-2"><span className="grid place-items-center size-10 shrink-0 rounded-xl bg-white text-banana-ink"><BrandIcon name={d.c.icon} className="size-6" /></span><span><span className="block text-sm font-extrabold text-ink">{d.c.title}</span><span className="block text-[11px] text-muted">{new Date(d.at + "T12:00:00").toLocaleDateString("es-CR", { day: "numeric", month: "short", year: "numeric" })}</span></span></li>)}</ul>
        ) : <p className="mt-2 text-sm text-muted">Termina tu primer reto para ganar tu medalla.</p>}
      </section>
    </div>
  );
}
