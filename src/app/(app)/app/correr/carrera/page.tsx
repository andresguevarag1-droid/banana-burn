import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Confetti, Flag } from "@/components/icons";
import { getViewer } from "@/lib/supabase/server";
import { getRunningView } from "@/lib/running-server";
import { fmtKm } from "@/lib/runs";
import { fmtTime, RACE_SHORT, vdot } from "@/lib/run-fitness";
import { raceWarmup, raceWeek } from "@/lib/run-guide";
import { daysBetween } from "@/lib/run-plan";
import { longDate } from "@/lib/seasons";
import { Locked, RaceCard } from "@/components/correr/run-hub";
import { PaceBandTool, RaceWeekList, ResultForm, ResultShare } from "@/components/correr/race-tools";

export const metadata = { title: "Día de carrera" };

export default async function Carrera() {
  const v = await getViewer();
  if (!v) redirect("/entrar?next=/app/correr/carrera");
  const r = await getRunningView(v);
  const back = <Link href="/app/correr" className="tap inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft weight="bold" className="size-4" />Banana Run</Link>;
  const seasonHref = r.season ? `/app/temporadas/${r.season.slug}` : "/app/temporadas";
  if (!r.owned) {
    return (
      <div className="space-y-5 animate-rise">
        {back}
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">Día de carrera</h1>
        <Locked title="Todo para tu carrera" why="Tu semana de carrera día por día, tu tabla de ritmos para guardar, el calentamiento y el modo carrera con voz km por km." href={seasonHref}>
          <ul className="space-y-2">{["Faltan 3 días: hidrátate", "Tabla de ritmos: km 5 en 26:40", "Modo carrera: 8 s adelante de tu plan"].map((x) => <li key={x} className="rounded-2xl bg-paper p-3 font-bold text-ink">{x}</li>)}</ul>
        </Locked>
      </div>
    );
  }
  const g = r.goal;
  if (!g || !r.check) {
    return <div className="space-y-5 animate-rise">{back}<h1 className="text-3xl font-extrabold tracking-tight text-ink">Día de carrera</h1><RaceCard goal={null} days={null} check={null} owned /></div>;
  }
  const title = g.name ?? `Mi ${RACE_SHORT[g.kind]}`;
  const goalS = g.goalS && r.check.status !== "muy_ambiciosa" ? g.goalS : r.check.withPlan;
  const past = g.raceDate <= r.today;
  const toRace = daysBetween(r.today, g.raceDate);
  // Marca personal: mejor que su mejor estimación previa en esa distancia (VDOT mayor que el de su forma de antes).
  const pr = g.resultS != null && r.fitness != null && (vdot(g.distanceM, g.resultS) ?? 0) > r.fitness.vdot + 0.2;
  const dayRuns = r.runs.filter((x) => x.day === g.raceDate && x.distanceM >= g.distanceM * 0.8).map((x) => ({ id: x.id, label: `${fmtKm(x.distanceM)} km con GPS`, movingS: x.movingS }));
  return (
    <div className="space-y-5 animate-rise">
      {back}
      <header className="space-y-1"><h1 className="text-3xl font-extrabold tracking-tight text-ink">Día de carrera</h1><p className="text-body">{title}, {longDate(g.raceDate)}.</p></header>
      {g.resultS != null ? (
        <section className="card space-y-4 overflow-hidden p-0" aria-labelledby="res">
          <div className="space-y-2 bg-ink p-6 text-white">
            <Confetti weight="duotone" className="size-10 text-banana" aria-hidden />
            <h2 id="res" className="text-2xl font-extrabold">Terminaste {title}</h2>
            <p className="text-6xl font-extrabold tabular-nums">{fmtTime(g.resultS)}</p>
            <p className="text-white/80">{fmtKm(g.distanceM)} km{g.goalS ? `. Tu meta era ${fmtTime(g.goalS)}` : ""}</p>
            {pr && <p className="chip h-8 bg-banana text-sm font-extrabold text-ink">Marca personal</p>}
          </div>
          <div className="space-y-3 p-5 pt-0">
            <ResultShare title={title} km={fmtKm(g.distanceM)} timeS={g.resultS} pr={pr} />
            <p className="text-sm text-body">Esta semana es de recuperación: trotes suaves y tu fuerza más ligera. Ya está en tu plan.</p>
            <Link href="/app/correr/objetivo" className="btn-ghost h-12 w-full">Elegir mi próxima carrera<ArrowRight className="size-4" /></Link>
          </div>
        </section>
      ) : past ? (
        <section className="card space-y-3 p-5" aria-labelledby="como"><h2 id="como" className="flex items-center gap-2 text-xl font-extrabold text-ink"><Flag weight="duotone" className="size-6 text-[var(--run)]" />¿Cómo te fue?</h2><ResultForm runs={dayRuns} /></section>
      ) : (
        <>
          <RaceCard goal={g} days={r.daysToRace} check={r.check} owned />
          <Link href="/app/correr?modo=carrera" className="btn-banana h-14 w-full text-base">Probar el modo carrera<ArrowRight className="size-5" /></Link>
        </>
      )}
      {!past && <PaceBandTool distM={g.distanceM} goalS={goalS} title={title} />}
      {!past && (
        <section className="card space-y-3 p-5" aria-labelledby="cal">
          <h2 id="cal" className="text-xl font-extrabold text-ink">Calentamiento del día</h2>
          <ol className="list-decimal space-y-1.5 pl-5 text-body">{raceWarmup(g.distanceM).map((x) => <li key={x}>{x}</li>)}</ol>
          <Link href="/app/correr/tecnica" className="tap inline-flex items-center gap-1 text-sm font-bold text-ink underline underline-offset-4">Ver los ejercicios de técnica</Link>
        </section>
      )}
      {(toRace <= 10 || past) && (
        <section className="space-y-3" aria-labelledby="sem"><h2 id="sem" className="text-xl font-extrabold text-ink">Tu semana de carrera</h2><RaceWeekList days={raceWeek(g.raceDate, g.distanceM)} today={r.today} raceDate={g.raceDate} /></section>
      )}
      {toRace > 10 && (
        <details className="card p-5"><summary className="cursor-pointer font-extrabold text-ink">Ver tu semana de carrera</summary><p className="my-2 text-sm text-body">La lista para marcar, día por día, desde 6 días antes.</p><RaceWeekList days={raceWeek(g.raceDate, g.distanceM)} today={r.today} raceDate={g.raceDate} /></details>
      )}
      <p className="text-xs text-muted">Consejos generales de entrenamiento, no son indicaciones médicas.</p>
    </div>
  );
}
