import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "@/components/icons";
import { getViewer } from "@/lib/supabase/server";
import { getSex } from "@/lib/athlete";
import { COACHES, seasonCoachId } from "@/lib/coaches";
import { getRunningView } from "@/lib/running-server";
import { fmtDuration, fmtKm, fmtPace } from "@/lib/runs";
import { longDate } from "@/lib/seasons";
import { mondayOf, type MatchedRun } from "@/lib/run-plan";
import { trainingPaces } from "@/lib/run-fitness";
import { RunTracker } from "@/components/correr/run-tracker";
import { WeeklyKm } from "@/components/correr/weekly-km";
import { BestsCard, IntakeNeeded, Locked, NextRunCard, OwnPlanCard, PlanWeekList, RaceCard, RunWeek } from "@/components/correr/run-hub";

export const metadata = { title: "Banana Run" };

/** Ejemplo para las vistas previas bloqueadas (no son datos de la persona). */
const SAMPLE_PACES = trainingPaces(42);
const SAMPLE_RUNS: MatchedRun[] = [
  { id: "a", date: "2026-11-10", dow: 1, kind: "intervalos", title: "Series", detail: "6 x 400 m a ritmo de series, con 90 s de trote", distM: 6800, steps: [{ kind: "trabajo", distM: 400, zone: "intervalo", label: "400 m" }], strides: false, key: true, status: "hecha" },
  { id: "b", date: "2026-11-12", dow: 3, kind: "facil", title: "Fácil", detail: "6 km suaves y 4 a 6 rectas de 20 s", distM: 6000, steps: [{ kind: "continuo", distM: 6000, zone: "facil", label: "Fácil" }], strides: true, key: false, status: "hoy" },
  { id: "c", date: "2026-11-14", dow: 5, kind: "larga", title: "Carrera larga", detail: "12 km a ritmo fácil", distM: 12000, steps: [{ kind: "continuo", distM: 12000, zone: "facil", label: "Carrera larga" }], strides: false, key: true, status: "pendiente" },
];

export default async function Correr() {
  const v = await getViewer();
  if (!v) redirect("/entrar?next=/app/correr");
  const [sex, r] = await Promise.all([getSex(v), getRunningView(v)]);
  const coach = COACHES[seasonCoachId("running", sex)];
  const seasonHref = r.season ? `/app/temporadas/${r.season.slug}` : "/app/temporadas";
  const thisMon = mondayOf(r.today);
  const runsThisWeek = r.runs.filter((x) => x.day >= thisMon).length;
  return (
    <div className="space-y-6 animate-rise">
      <RunTracker coachSrc={coach.hello} coachName={coach.name} />
      <RunWeek km={r.weekKm} goal={r.weekGoal} runs={runsThisWeek} dayStreak={r.dayStreak} weekStreak={r.weekStreak} />
      <RaceCard goal={r.goal} days={r.daysToRace} check={r.check} owned={r.owned} />

      {r.owned ? (
        r.goal?.ownPlan ? <OwnPlanCard goal={r.goal} runDays={r.intake?.running?.runDays ?? []} longDay={r.intake?.running?.longRunDay ?? null} />
        : r.plan ? (
          <>
            {r.adjusts.length > 0 && <section className="card space-y-1 border-l-4 border-[var(--run)] p-4" aria-label="Ajustes de tu plan">{r.adjusts.map((a) => <p key={a.kind} className="text-sm text-body">{a.message}</p>)}</section>}
            <NextRunCard run={r.next} paces={r.plan.paces} plan={r.plan} />
            {r.thisWeek.length > 0 && <section className="card p-5" aria-labelledby="sem-plan"><h2 id="sem-plan" className="text-xl font-extrabold text-ink">Tu semana del plan</h2><PlanWeekList runs={r.thisWeek} paces={r.plan.paces} compact /></section>}
            {!r.intake && r.season && <IntakeNeeded slug={r.season.slug} />}
          </>
        ) : null
      ) : (
        <Locked title="Tu plan de carrera" why="Semana a semana hasta tu carrera: fáciles, tempo, series y la larga, con tus ritmos. Se ajusta solo con lo que corres." href={seasonHref}>
          <PlanWeekList runs={SAMPLE_RUNS} paces={SAMPLE_PACES} compact />
        </Locked>
      )}

      {r.owned ? <BestsCard bests={r.bests} /> : (
        <Locked title="Tus marcas y tus ritmos" why="Tus mejores 1, 5, 10 y 21 km medidos con tus parciales, y tus ritmos de entrenamiento." href={seasonHref}>
          <dl className="grid grid-cols-2 gap-2">
            {[["Mejor 1 km", "4:41"], ["Mejor 5 km", "25:12"], ["Mejor 10 km", "52:40"], ["La más larga", "16.20 km"]].map(([a, b]) => <div key={a} className="rounded-2xl bg-paper p-3"><dt className="text-xs font-bold text-muted">{a}</dt><dd className="text-2xl font-extrabold text-ink">{b}</dd></div>)}
          </dl>
        </Locked>
      )}

      {r.runs.length > 0 && (
        <>
          <WeeklyKm weeks={r.weeks} />
          <section className="space-y-3" aria-labelledby="hist">
            <h2 id="hist" className="text-xl font-extrabold text-ink">Tus carreras</h2>
            <ul className="card divide-y divide-line p-0">
              {r.runs.slice(0, 30).map((x) => (
                <li key={x.id}>
                  <Link href={`/app/correr/${x.id}`} className="flex items-center gap-3 px-5 py-3.5 transition-colors duration-150 hover:bg-paper/60">
                    <span className="min-w-0 flex-1"><span className="block font-bold text-ink tabular-nums">{fmtKm(x.distanceM)} km</span><span className="block text-sm text-muted">{longDate(x.day)}, {fmtDuration(x.movingS)}, {fmtPace(x.paceSKm)}/km</span></span>
                    <ArrowRight className="size-4 shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
