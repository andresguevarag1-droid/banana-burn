// Piezas del hub de Banana Run (/app/correr): la semana, tu carrera, la próxima sesión, tus marcas y lo que se
// desbloquea con la Temporada Running. Componentes de servidor; sin estado.
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, CalendarCheck, CheckCircle, Fire, Flag, FlagCheckered, Lock, Medal, Sneaker, Timer, TrendUp } from "@/components/icons";
import { fmtDuration, fmtKm, fmtPace } from "@/lib/runs";
import { fmtTime, RACE_SHORT, ZONE_LABEL, zonePace, type Bests, type GoalCheck, type Paces } from "@/lib/run-fitness";
import { PHASE_LABEL, type MatchedRun, type RacePlan } from "@/lib/run-plan";
import { DOW_LONG, longDate } from "@/lib/seasons";
import type { RaceGoal } from "@/lib/running-server";
import { GROUP_LABEL, drillsFor } from "@/lib/run-drills";

/** "Antes: calentamiento dinámico. Después: enfriamiento" con enlace a la técnica. */
export function DrillLinks({ run }: { run: MatchedRun }) {
  const d = drillsFor(run.kind, run.strides);
  if (!d.before.length && !d.after.length) return null;
  return (
    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold">
      {d.before.map((g) => <Link key={`b${g}`} href={`/app/correr/tecnica#${g}`} className="text-[var(--run)] underline underline-offset-2">Antes: {GROUP_LABEL[g].toLowerCase()}</Link>)}
      {d.after.map((g) => <Link key={`a${g}`} href={`/app/correr/tecnica#${g}`} className="text-[var(--run)] underline underline-offset-2">Después: {GROUP_LABEL[g].toLowerCase()}</Link>)}
    </p>
  );
}

/** Accesos del hub: plan, día de carrera y técnica. */
export function RunTools({ owned }: { owned: boolean }) {
  const items: [string, string, string][] = [["/app/correr/plan", "Mi plan", "Semana a semana"], ["/app/correr/carrera", "Día de carrera", "Ritmos y checklist"], ["/app/correr/tecnica", "Técnica", "Skipping y más"]];
  return (
    <nav aria-label="Herramientas de running" className="grid grid-cols-3 gap-2">
      {items.map(([href, t, d]) => (
        <Link key={href} href={href} className="card flex flex-col gap-1 p-3 transition-transform duration-150 active:scale-[.98]">
          <span className="flex items-center gap-1 font-extrabold text-ink">{t}{!owned && <Lock weight="duotone" className="size-4 text-muted" aria-label="Incluido en la Temporada Running" />}</span>
          <span className="text-xs text-muted">{d}</span>
        </Link>
      ))}
    </nav>
  );
}

export const UNLOCK = "Desbloquear con la Temporada Running";

/** Vista previa honesta de lo que trae la Temporada Running (con datos de ejemplo) y el botón para desbloquear. */
export function Locked({ title, why, href, children }: { title: string; why: string; href: string; children: ReactNode }) {
  return (
    <section className="card overflow-hidden" aria-labelledby={`lk-${title}`}>
      <div className="flex items-start gap-3 p-5 pb-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--run-soft)] text-[var(--run)]"><Lock weight="duotone" className="size-5" /></span>
        <div className="min-w-0"><h2 id={`lk-${title}`} className="text-xl font-extrabold text-ink">{title}</h2><p className="text-sm text-body">{why}</p></div>
      </div>
      <div className="relative">
        <div aria-hidden inert className="pointer-events-none select-none px-5 pb-2 opacity-60 blur-[2px]">{children}</div>
        <p className="px-5 text-xs text-muted">Vista previa con datos de ejemplo.</p>
      </div>
      <div className="p-5 pt-3"><Link href={href} className="btn-banana h-auto min-h-12 w-full py-3 text-center leading-tight">{UNLOCK}<ArrowRight className="size-4" /></Link></div>
    </section>
  );
}

/** Esta semana: km contra la meta, carreras y rachas. */
export function RunWeek({ km, goal, runs, dayStreak, weekStreak }: { km: number; goal: number | null; runs: number; dayStreak: number; weekStreak: number }) {
  const pct = goal ? Math.min(100, Math.round((km / goal) * 100)) : null;
  return (
    <section className="card space-y-4 p-5" aria-labelledby="run-week">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="run-week" className="text-xl font-extrabold text-ink">Esta semana</h2>
        {goal ? <p className="text-sm font-semibold text-muted tabular-nums">Meta: {goal} km</p> : null}
      </div>
      <p className="text-5xl font-extrabold tracking-tight text-ink tabular-nums">{km}<span className="ml-1 text-xl text-muted">km</span></p>
      {pct != null && (
        <div>
          <div className="h-3 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avance de tu meta de km de la semana"><div className="h-full rounded-full bg-[var(--run)]" style={{ width: `${Math.max(2, pct)}%` }} /></div>
          <p className="mt-1.5 text-sm text-body">{pct >= 100 ? "Cumpliste tu meta de la semana." : `Te faltan ${Math.round((goal! - km) * 10) / 10} km para tu meta.`}</p>
        </div>
      )}
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-paper p-3"><dt className="text-xs font-bold text-muted">Carreras</dt><dd className="text-2xl font-extrabold text-ink tabular-nums">{runs}</dd></div>
        <div className="rounded-2xl bg-paper p-3"><dt className="text-xs font-bold text-muted">Días seguidos</dt><dd className="flex items-center justify-center gap-1 text-2xl font-extrabold text-ink tabular-nums">{dayStreak}{dayStreak > 1 && <Fire weight="duotone" className="size-5 text-[var(--run)]" aria-hidden />}</dd></div>
        <div className="rounded-2xl bg-paper p-3"><dt className="text-xs font-bold text-muted">Semanas seguidas</dt><dd className="text-2xl font-extrabold text-ink tabular-nums">{weekStreak}</dd></div>
      </dl>
    </section>
  );
}

const STATUS_TEXT: Record<GoalCheck["status"], string> = { sin_meta: "Para terminarla", conservadora: "A tu alcance", realista: "Realista", ambiciosa: "Ambiciosa", muy_ambiciosa: "Muy ambiciosa" };

/** Tu carrera: cuenta regresiva (gratis) y, con la temporada, si la meta es realista. */
export function RaceCard({ goal, days, check, owned }: { goal: RaceGoal | null; days: number | null; check: GoalCheck | null; owned: boolean }) {
  if (!goal || days == null) {
    return (
      <section className="card flex flex-wrap items-center gap-4 p-5" aria-labelledby="race-none">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--run-soft)] text-[var(--run)]"><Flag weight="duotone" className="size-6" /></span>
        <div className="min-w-0 flex-1"><h2 id="race-none" className="text-lg font-extrabold text-ink">{goal ? "¿Cuál es tu próxima carrera?" : "Elige tu carrera objetivo"}</h2><p className="text-sm text-body">5K, 10K, 21K, 42K o trail. Te armamos todo alrededor de esa fecha.</p></div>
        <Link href="/app/correr/objetivo" className="btn-primary h-12">Elegir carrera<ArrowRight className="size-4" /></Link>
      </section>
    );
  }
  return (
    <section className="card overflow-hidden" aria-labelledby="race-card">
      <div className="flex items-center gap-4 bg-ink p-5 text-white">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-white/70">Tu carrera</p>
          <h2 id="race-card" className="truncate text-2xl font-extrabold">{goal.name ?? `Mi ${RACE_SHORT[goal.kind]}`}</h2>
          <p className="text-sm text-white/80">{longDate(goal.raceDate)}, {fmtKm(goal.distanceM).replace(/\.00$/, "")} km{goal.goalS ? `. Meta: ${fmtTime(goal.goalS)}` : ""}</p>
        </div>
        <div className="shrink-0 text-center"><p className="text-5xl font-extrabold leading-none tabular-nums">{days}</p><p className="text-xs font-bold text-white/70">{days === 1 ? "día" : "días"}</p></div>
      </div>
      <div className="space-y-3 p-5">
        {days === 0 ? <p className="font-extrabold text-ink">Hoy es tu carrera. Sal a disfrutarla.</p> : null}
        {owned && check ? (
          <>
            <p className="flex flex-wrap items-center gap-2"><span className="chip h-7 bg-[var(--run-soft)] font-bold text-[var(--run)]">{STATUS_TEXT[check.status]}</span><span className="text-sm font-semibold text-ink">Hoy: cerca de {fmtTime(check.now)}. Con el plan: {fmtTime(check.withPlan)}</span></p>
            <p className="text-sm text-body">{check.message}</p>
          </>
        ) : null}
        <Link href="/app/correr/objetivo" className="tap inline-flex items-center gap-1 text-sm font-bold text-ink underline underline-offset-4">Cambiar mi carrera</Link>
      </div>
    </section>
  );
}

const zoneOf = (r: MatchedRun) => r.steps.find((s) => s.kind === "trabajo")?.zone ?? r.steps[0]?.zone ?? "facil";
/** Ritmo objetivo de la parte principal de una sesión. */
export function runTarget(r: MatchedRun, p: Paces): string {
  const z = zoneOf(r);
  if (z === "trote" || z === "facil") return `${fmtPace(p.facil[0])} a ${fmtPace(p.facil[1])}/km`;
  return `${fmtPace(zonePace(p, z))}/km (${ZONE_LABEL[z].toLowerCase()})`;
}

/** La próxima sesión del plan. */
export function NextRunCard({ run, paces, plan }: { run: MatchedRun | null; paces: Paces; plan: RacePlan }) {
  const wk = run ? plan.weeks.find((w) => w.runs.some((x) => x.id === run.id)) : null;
  const week = wk?.n ?? null, phase = wk?.phase;
  return (
    <section className="card space-y-4 p-5" aria-labelledby="next-run">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="next-run" className="text-xl font-extrabold text-ink">{run?.status === "hoy" ? "Hoy te toca" : "Tu próxima sesión"}</h2>
        {week && phase ? <p className="text-sm font-semibold text-muted">Semana {week}: {PHASE_LABEL[phase]}</p> : null}
      </div>
      {run ? (
        <>
          <div className="flex items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--run)] text-white"><Sneaker weight="duotone" className="size-6" /></span>
            <div className="min-w-0">
              <p className="text-2xl font-extrabold text-ink">{run.title}</p>
              <p className="text-body">{run.detail}</p>
              <p className="mt-1 text-sm font-semibold text-ink"><Timer weight="duotone" className="mr-1 inline size-4 align-[-3px] text-[var(--run)]" />Ritmo: {runTarget(run, paces)}</p>
              {run.status !== "hoy" && <p className="text-sm text-muted">El {DOW_LONG[run.dow]} {longDate(run.date)}</p>}
              <DrillLinks run={run} />
              {run.note && <p className="mt-2 rounded-xl bg-paper p-2.5 text-sm text-body">{run.note}</p>}
            </div>
          </div>
        </>
      ) : <p className="text-body">Terminaste las sesiones del plan. Muy bien hecho.</p>}
      <Link href="/app/correr/plan" className="btn-ghost h-12 w-full">Ver mi plan completo<ArrowRight className="size-4" /></Link>
    </section>
  );
}

/** Lo que va de la semana del plan: hecho, hoy, pendiente o pendiente de días pasados. */
export function PlanWeekList({ runs, paces, compact = false }: { runs: MatchedRun[]; paces: Paces; compact?: boolean }) {
  return (
    <ol className="divide-y divide-line">
      {runs.map((r) => (
        <li key={r.id} className="flex items-start gap-3 py-3">
          <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full text-xs font-extrabold ${r.status === "hecha" ? "bg-peel text-white" : r.status === "hoy" ? "bg-[var(--run)] text-white" : r.status === "perdida" ? "bg-line text-muted" : "bg-paper text-ink"}`}>
            {r.status === "hecha" ? <CheckCircle weight="fill" className="size-5" aria-hidden /> : DOW_LONG[r.dow].slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink">{r.title}<span className="sr-only">. {r.status === "hecha" ? "Hecha" : r.status === "hoy" ? "Hoy" : r.status === "perdida" ? "Pendiente de un día que pasó" : "Pendiente"}</span></p>
            <p className="text-sm text-body">{r.detail}</p>
            {!compact && <p className="text-xs text-muted">{DOW_LONG[r.dow]} {longDate(r.date)}. Ritmo {runTarget(r, paces)}</p>}
            {!compact && <DrillLinks run={r} />}
            {r.note && <p className="mt-1 text-xs font-semibold text-[var(--run)]">{r.note}</p>}
          </div>
          <span className="shrink-0 text-sm font-bold tabular-nums text-muted">{(r.distM / 1000).toFixed(1)} km</span>
        </li>
      ))}
    </ol>
  );
}

const BEST_ROWS = [["km1", "1 km"], ["km5", "5 km"], ["km10", "10 km"], ["km21", "21 km"]] as const;
/** Marcas personales. */
export function BestsCard({ bests }: { bests: Bests }) {
  const any = BEST_ROWS.some(([k]) => bests[k]) || bests.longest;
  return (
    <section className="card space-y-3 p-5" aria-labelledby="bests">
      <h2 id="bests" className="flex items-center gap-2 text-xl font-extrabold text-ink"><Medal weight="duotone" className="size-6 text-[var(--run)]" />Tus marcas</h2>
      {any ? (
        <dl className="grid grid-cols-2 gap-2">
          {BEST_ROWS.filter(([k]) => bests[k]).map(([k, label]) => (
            <Link key={k} href={`/app/correr/${bests[k]!.runId}`} className="rounded-2xl bg-paper p-3 transition-colors hover:bg-line/60">
              <dt className="text-xs font-bold text-muted">Mejor {label}</dt>
              <dd className="text-2xl font-extrabold text-ink tabular-nums">{fmtDuration(bests[k]!.seconds)}</dd>
              <dd className="text-xs text-muted">{fmtPace(Math.round(bests[k]!.seconds / Number(label.split(" ")[0])))}/km, {longDate(bests[k]!.day)}</dd>
            </Link>
          ))}
          {bests.longest && (
            <Link href={`/app/correr/${bests.longest.runId}`} className="rounded-2xl bg-paper p-3 transition-colors hover:bg-line/60">
              <dt className="text-xs font-bold text-muted">La más larga</dt>
              <dd className="text-2xl font-extrabold text-ink tabular-nums">{fmtKm(bests.longest.distanceM)} km</dd>
              <dd className="text-xs text-muted">{longDate(bests.longest.day)}</dd>
            </Link>
          )}
        </dl>
      ) : <p className="text-body">Registra tus carreras con el GPS y aquí aparecen tus mejores tiempos en 1, 5, 10 y 21 km.</p>}
      <p className="text-xs text-muted">Medimos tus mejores tramos dentro de cada carrera con sus parciales de 1 km.</p>
    </section>
  );
}

/** Tabla de ritmos. */
export function PacesCard({ paces, source }: { paces: Paces; source: string }) {
  const rows: [string, string, string][] = [
    ["Fácil", `${fmtPace(paces.facil[0])} a ${fmtPace(paces.facil[1])}`, "Para conversar. Casi todo tu volumen."],
    ["Tempo", fmtPace(paces.umbral), "Fuerte y controlado."],
    ["Series", fmtPace(paces.intervalo), "Duro, en tramos con recuperación."],
    ["Rectas y cuestas", fmtPace(paces.repeticion), "Rápido y suelto."],
    ["Tu carrera", fmtPace(paces.carrera), "El ritmo de tu meta."],
  ];
  return (
    <section className="card space-y-3 p-5" aria-labelledby="paces">
      <h2 id="paces" className="flex items-center gap-2 text-xl font-extrabold text-ink"><TrendUp weight="duotone" className="size-6 text-[var(--run)]" />Tus ritmos</h2>
      <table className="w-full text-left">
        <thead className="sr-only"><tr><th>Zona</th><th>Ritmo por km</th><th>Cómo se siente</th></tr></thead>
        <tbody className="divide-y divide-line">
          {rows.map(([z, p, h]) => <tr key={z}><th scope="row" className="py-2.5 pr-2 font-bold text-ink">{z}<span className="block text-xs font-normal text-muted">{h}</span></th><td className="whitespace-nowrap py-2.5 text-right text-lg font-extrabold tabular-nums text-ink">{p}<span className="text-xs font-semibold text-muted">/km</span></td></tr>)}
        </tbody>
      </table>
      <p className="text-xs text-muted">Calculados con {source}. Se actualizan cuando corres más rápido.</p>
    </section>
  );
}

/** Con su propio plan de carrera: Banana Burn arma la fuerza alrededor de sus días. */
export function OwnPlanCard({ goal, runDays, longDay }: { goal: RaceGoal; runDays: number[]; longDay: number | null }) {
  return (
    <section className="card space-y-3 p-5" aria-labelledby="own-plan">
      <h2 id="own-plan" className="flex items-center gap-2 text-xl font-extrabold text-ink"><CalendarCheck weight="duotone" className="size-6 text-[var(--run)]" />Tu plan, tu entrenador</h2>
      <p className="text-body">Sigues tu propio plan de carrera. Banana Burn arma tu fuerza, movilidad y técnica alrededor de tus días para que sumes sin chocar con tus series ni tu larga.</p>
      <ul className="space-y-1 text-sm text-body">
        <li><b className="text-ink">Corres:</b> {runDays.length ? runDays.map((d) => DOW_LONG[d]).join(", ") : "sin días fijos"}</li>
        {longDay !== null && <li><b className="text-ink">Carrera larga:</b> {DOW_LONG[longDay]}</li>}
        {goal.hardDays.length > 0 && <li><b className="text-ink">Series o tempo:</b> {goal.hardDays.map((d) => DOW_LONG[d]).join(", ")}</li>}
      </ul>
      <p className="text-sm text-muted">Nunca ponemos piernas pesadas el día de tus series o tu larga, ni el día anterior.</p>
    </section>
  );
}

/** Pide el cuestionario de la temporada (de ahí salen los días y los km). */
export function IntakeNeeded({ slug }: { slug: string }) {
  return (
    <section className="card space-y-3 p-5" aria-labelledby="need-intake">
      <h2 id="need-intake" className="flex items-center gap-2 text-xl font-extrabold text-ink"><FlagCheckered weight="duotone" className="size-6 text-[var(--run)]" />Arma tu semana</h2>
      <p className="text-body">Cuéntanos qué días corres, tu carrera larga y cuántos km haces. Con eso ajustamos tu plan de carrera y tu fuerza.</p>
      <Link href={`/app/temporadas/${slug}/cuestionario`} className="btn-banana h-12 w-full">Llenar mi cuestionario<ArrowRight className="size-4" /></Link>
    </section>
  );
}

/** Logros de running: ganados con su fecha y los que vienen con su avance. */
export function BadgesCard({ badges }: { badges: { id: string; label: string; desc: string; earnedOn: string | null; progress: number }[] }) {
  const won = badges.filter((b) => b.earnedOn), next = badges.filter((b) => !b.earnedOn).sort((a, b) => b.progress - a.progress).slice(0, 3);
  return (
    <section className="card space-y-3 p-5" aria-labelledby="badges">
      <h2 id="badges" className="text-xl font-extrabold text-ink">Logros de running <span className="text-sm font-semibold text-muted">{won.length} de {badges.length}</span></h2>
      {won.length > 0 && <ul className="flex flex-wrap gap-2">{won.map((b) => <li key={b.id} className="chip h-8 bg-[var(--run)] text-sm font-bold text-white" title={b.desc}>{b.label}</li>)}</ul>}
      <ul className="space-y-2">
        {next.map((b) => (
          <li key={b.id}>
            <p className="flex justify-between text-sm"><span className="font-bold text-ink">{b.label}</span><span className="tabular-nums text-muted">{Math.round(b.progress * 100)} %</span></p>
            <div className="h-2 overflow-hidden rounded-full bg-line" aria-hidden><div className="h-full rounded-full bg-ink" style={{ width: `${Math.max(2, b.progress * 100)}%` }} /></div>
            <p className="text-xs text-muted">{b.desc}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Reto del mes (gratis): km del mes contra una meta que sube sobre el mes pasado. */
export function MonthChallengeCard({ c }: { c: { title: string; goalKm: number; km: number; daysLeft: number; done: boolean } }) {
  const pct = Math.min(100, Math.round((c.km / c.goalKm) * 100));
  return (
    <section className="card space-y-3 p-5" aria-labelledby="reto-mes">
      <p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--run)]">Reto del mes</p>
      <h2 id="reto-mes" className="text-2xl font-extrabold text-ink">{c.title}</h2>
      <div className="h-3 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Avance del reto ${c.title}`}><div className="h-full rounded-full bg-[var(--run)]" style={{ width: `${Math.max(2, pct)}%` }} /></div>
      <p className="text-sm text-body">{c.done ? `Lo lograste: ${c.km} km. La meta del próximo mes sube un poco.` : `Llevas ${c.km} km. ${c.daysLeft === 0 ? "Hoy es el último día." : `Quedan ${c.daysLeft} ${c.daysLeft === 1 ? "día" : "días"}.`}`}</p>
    </section>
  );
}
