import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight } from "@/components/icons";
import { getViewer } from "@/lib/supabase/server";
import { getRunningView } from "@/lib/running-server";
import { PHASE_HINT, PHASE_LABEL, matchRuns, mondayOf, type PlanWeek } from "@/lib/run-plan";
import { longDate } from "@/lib/seasons";
import { Locked, OwnPlanCard, PacesCard, PlanWeekList, RaceCard } from "@/components/correr/run-hub";

export const metadata = { title: "Mi plan de carrera" };

const PHASES = ["base", "construccion", "pico", "afinar", "carrera", "recuperar"] as const;

export default async function Plan() {
  const v = await getViewer();
  if (!v) redirect("/entrar?next=/app/correr/plan");
  const r = await getRunningView(v);
  const seasonHref = r.season ? `/app/temporadas/${r.season.slug}` : "/app/temporadas";
  const back = <Link href="/app/correr" className="tap inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft weight="bold" className="size-4" />Banana Run</Link>;

  if (!r.owned) {
    return (
      <div className="space-y-5 animate-rise">
        {back}
        <header className="space-y-1"><h1 className="text-3xl font-extrabold tracking-tight text-ink">Tu plan de carrera</h1><p className="text-body">Incluido en la Temporada Running.</p></header>
        <Locked title="Semana a semana hasta tu carrera" why="Base, construcción, pico y afinar, con tus ritmos de fácil, tempo y series. Tu fuerza de la temporada se acomoda alrededor de tus días de carrera." href={seasonHref}>
          <ol className="grid grid-cols-3 gap-2 text-center sm:grid-cols-6">{PHASES.map((p) => <li key={p} className="rounded-2xl bg-paper p-3 text-sm font-bold text-ink">{PHASE_LABEL[p]}</li>)}</ol>
        </Locked>
      </div>
    );
  }
  if (!r.goal) {
    return (
      <div className="space-y-5 animate-rise">
        {back}
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">Tu plan de carrera</h1>
        <RaceCard goal={null} days={null} check={null} owned />
      </div>
    );
  }
  if (r.goal.ownPlan || !r.plan) {
    return (
      <div className="space-y-5 animate-rise">
        {back}
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">Tu plan de carrera</h1>
        <RaceCard goal={r.goal} days={r.daysToRace} check={r.check} owned />
        {r.goal.ownPlan ? <OwnPlanCard goal={r.goal} runDays={r.intake?.running?.runDays ?? []} longDay={r.intake?.running?.longRunDay ?? null} /> : <p className="card p-5 text-body">Tu carrera ya pasó. <Link href="/app/correr/objetivo" className="font-bold text-ink underline underline-offset-4">Elige la próxima</Link> y armamos un plan nuevo.</p>}
      </div>
    );
  }
  const thisMon = mondayOf(r.today);
  const done = r.runs.map((x) => ({ id: x.id, day: x.day, distanceM: x.distanceM, movingS: x.movingS }));
  const weeks = r.plan.weeks;
  const total = weeks.length - 1;
  const max = Math.max(...weeks.map((w) => w.km), 1);
  const Week = ({ w }: { w: PlanWeek }) => <PlanWeekList runs={matchRuns(w.runs, done, r.today)} paces={r.plan!.paces} />;
  return (
    <div className="space-y-5 animate-rise">
      {back}
      <header className="space-y-1"><h1 className="text-3xl font-extrabold tracking-tight text-ink">Tu plan de carrera</h1><p className="text-body">{total} semanas hasta tu carrera y una de recuperación. Se ajusta con lo que corres.</p></header>
      <RaceCard goal={r.goal} days={r.daysToRace} check={r.check} owned />
      {r.adjusts.length > 0 && <section className="card space-y-1 border-l-4 border-[var(--run)] p-4" aria-label="Ajustes de tu plan">{r.adjusts.map((a) => <p key={a.kind} className="text-sm text-body">{a.message}</p>)}</section>}
      <section className="card space-y-3 p-5" aria-labelledby="vol">
        <h2 id="vol" className="text-xl font-extrabold text-ink">Km por semana del plan</h2>
        <ol className="flex h-28 items-end gap-1" aria-label="Km planeados por semana">
          {weeks.map((w) => <li key={w.start} className="flex h-full flex-1 flex-col justify-end" aria-label={`Semana ${w.n}, ${PHASE_LABEL[w.phase]}: ${w.km} km`}><span className={`w-full rounded-t ${w.start === thisMon ? "bg-[var(--run)]" : w.phase === "carrera" ? "bg-ink" : "bg-ink/25"}`} style={{ height: `${Math.max(4, (w.km / max) * 100)}%` }} /></li>)}
        </ol>
        <p className="text-xs text-muted">Sube poco a poco, con semanas de descarga, y baja antes de tu carrera para que llegues fresco.</p>
      </section>
      <PacesCard paces={r.plan.paces} source={r.fitness?.label ?? "tu nivel"} />
      <section className="space-y-3" aria-labelledby="weeks">
        <h2 id="weeks" className="text-xl font-extrabold text-ink">Semana a semana</h2>
        {weeks.map((w) => {
          const cur = w.start === thisMon;
          const head = <><span className="font-extrabold text-ink">Semana {w.n}{w.phase === "recuperar" ? " (recuperación)" : ""}</span><span className="text-sm text-muted">{PHASE_LABEL[w.phase]}{w.cutback ? ", descarga" : ""}. {longDate(w.start)}. {w.km} km</span></>;
          return cur ? (
            <section key={w.start} className="card border-2 border-[var(--run)] p-5" aria-label={`Semana ${w.n}, esta semana`}>
              <p className="chip mb-2 h-7 bg-[var(--run)] text-white">Esta semana</p>
              <div className="flex flex-col">{head}</div>
              <p className="mt-1 text-sm text-body">{PHASE_HINT[w.phase]}</p>
              <Week w={w} />
            </section>
          ) : (
            <details key={w.start} className="card group p-5">
              <summary className="flex cursor-pointer list-none flex-col">{head}</summary>
              <p className="mt-2 text-sm text-body">{PHASE_HINT[w.phase]}</p>
              <Week w={w} />
            </details>
          );
        })}
      </section>
      <Link href="/app/correr/objetivo" className="btn-ghost h-12 w-full">Cambiar mi carrera o mi meta<ArrowRight className="size-4" /></Link>
      <p className="text-xs text-muted">Incluido en tu Temporada Running. Si algo duele de forma distinta a la fatiga normal, descansa y consulta a un profesional de salud.</p>
    </div>
  );
}
