import { getViewer } from "@/lib/supabase/server";
import { getCatalog, getMyChallenges } from "@/lib/challenges-server";
import { todayMetrics } from "@/lib/metrics";
import { MAX_ACTIVE } from "@/lib/challenges";
import { toEndedView, toView } from "@/lib/challenge-view";
import { ChallengeCard, EndedChallengeCard, JoinButton } from "@/components/challenge-card";
import { BananaMedal, BrandIcon } from "@/components/icons";

export const metadata = { title: "Retos" };

export default async function Retos() {
  const v = (await getViewer())!;
  const [{ active, done, ended }, catalog] = await Promise.all([getMyChallenges(v, await todayMetrics(v)), getCatalog(v.demo)]);
  const joined = new Set(active.map((a) => a.c.id));
  const retry = new Set(ended.map((e) => e.c.id));
  const full = active.length >= MAX_ACTIVE;
  const options = [...catalog.values()].filter((c) => !joined.has(c.id) && !retry.has(c.id));
  return (
    <div className="space-y-6 animate-enter">
      <header>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">Hábitos que se quedan</h1>
        <p className="mt-1 max-w-[65ch] text-muted">Un pequeño objetivo cada día durante 21 o 30 días. Al terminar ganas una medalla y XP.</p>
      </header>

      {active.length > 0 && (
        <section className="space-y-3" aria-labelledby="retos-curso">
          <h2 id="retos-curso" className="font-extrabold text-ink">En curso <span className="font-semibold text-muted tabular-nums">({active.length} de {MAX_ACTIVE})</span></h2>
          <div className="grid gap-3 lg:grid-cols-2">{active.map((m) => <ChallengeCard key={m.ucId} v={toView(m)} />)}</div>
        </section>
      )}

      {ended.length > 0 && (
        <section className="space-y-3" aria-labelledby="retos-terminados">
          <h2 id="retos-terminados" className="font-extrabold text-ink">Para volver a intentar</h2>
          <div className="grid gap-3 lg:grid-cols-2">{ended.map((e) => <EndedChallengeCard key={e.ucId} e={toEndedView(e)} />)}</div>
        </section>
      )}

      <section className="space-y-3" aria-labelledby="retos-unirse">
        <h2 id="retos-unirse" className="font-extrabold text-ink">Únete a un reto</h2>
        {full && <p className="rounded-2xl bg-cream p-3 text-sm text-muted">Ya tienes {MAX_ACTIVE} retos en curso. Termina o abandona uno para empezar otro.</p>}
        {options.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {options.map((c) => (
              <article key={c.id} className="card p-5 flex flex-col">
                <div className="flex items-center gap-3"><span className={`grid place-items-center size-12 shrink-0 rounded-2xl text-ink ${c.color}`}><BrandIcon name={c.icon} className="size-7" /></span><div><h3 className="font-extrabold text-ink">{c.title}</h3><p className="text-xs font-semibold text-muted tabular-nums">{c.days} días, +{c.xp} XP</p></div></div>
                <p className="mt-3 text-sm text-muted flex-1">{c.desc}</p>
                <p className="mt-2 text-xs font-semibold text-faint">{c.verify === "manual" ? "Lo marcas tú cada día." : "Se verifica solo con tus registros."}{c.grace > 0 && ` ${c.grace === 1 ? "1 comodín" : `${c.grace} comodines`} si un día no puedes.`}</p>
                {!full && <div className="mt-4"><JoinButton id={c.id} title={c.title} /></div>}
              </article>
            ))}
          </div>
        ) : <p className="text-sm text-muted">Ya estás en todos los retos disponibles.</p>}
      </section>

      <section className="card p-5" aria-labelledby="retos-medallas">
        <h2 id="retos-medallas" className="flex items-center gap-2 font-extrabold text-ink"><BananaMedal className="size-6 text-banana-ink" />Medallas de retos</h2>
        {done.length ? (
          <ul className="mt-3 flex flex-wrap gap-3">{done.map((d, i) => <li key={i} className="flex items-center gap-2 rounded-2xl bg-banana-soft px-3 py-2"><span className="grid place-items-center size-10 shrink-0 rounded-xl bg-white text-banana-ink"><BrandIcon name={d.c.icon} className="size-6" /></span><span><span className="block text-sm font-extrabold text-ink">{d.c.title}</span><span className="block text-[11px] text-muted">{new Date(d.at + "T12:00:00").toLocaleDateString("es-419", { day: "numeric", month: "short", year: "numeric" })}</span></span></li>)}</ul>
        ) : <p className="mt-2 text-sm text-muted">Termina tu primer reto para ganar tu medalla.</p>}
      </section>
    </div>
  );
}
