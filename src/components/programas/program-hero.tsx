// Héroe del programa activo en Hoy: reemplaza la tarjeta genérica de "Rutina de hoy" mientras hay un programa.
// Portada del programa, "Semana 2 de 8, día 2", la sesión de hoy, el avance y el próximo hito. Servidor.
import { CoachPic } from "@/components/coach-pic";
import Link from "next/link";
import { ArrowRight, BrandIcon, CalendarCheck, CheckCircle, Flag, Medal, Monkey, Pause, TreePalm, TrendUp } from "@/components/icons";
import { ChallengeCover, coverInk } from "@/components/retos/cover";
import { ProgressBar } from "@/components/progress-bar";
import { Readiness } from "@/components/readiness";
import { DAY_NAMES } from "@/lib/engine";
import type { AthleteProgram } from "@/lib/programs-server";
import { daysToWeekEnd, tipFor, weekDaysLabel } from "@/lib/programs";
import { coachOf } from "@/lib/coaches";
import { SPORTS } from "@/lib/seasons";
import { ExerciseTiles } from "@/components/hoy/exercise-tiles";
import { DEFAULT_VOICE, commonTempo, sessionLine, setsLegend, t, type Voice } from "@/lib/voice";

const fmtDay = (iso: string) => {
  const d = new Date(iso + "T12:00:00");
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()}`;
};
const n = (x: number) => x.toLocaleString("es-419");

/** "Semana 2 de 8, día 2" (el día es la sesión que toca dentro de la semana). */
export function weekLabel(p: Pick<AthleteProgram, "run">) {
  const r = p.run;
  if (r.byDays) return `Día ${Math.min(r.days, r.effectiveDay + 1)} de ${r.days}`;
  const day = r.next?.day ?? r.weekSessions.filter((w) => w.done).length;
  return `Semana ${r.week} de ${r.weeks}${day ? `, día ${day}` : ""}`;
}

/** `she`: la persona es mujer (textos en femenino). */
/** ", en 2 semanas" / ", esta semana"; en un programa en días: ", en 18 días" / ", mañana" / ", hoy". */
function milestoneWhen(p: Pick<AthleteProgram, "run" | "meta">) {
  const m = p.run.milestone;
  if (!m) return "";
  if (p.run.byDays) {
    const left = daysToWeekEnd(p.meta, m.week, p.run.effectiveDay);
    return left === 0 ? ", hoy" : left === 1 ? ", mañana" : `, en ${left} días`;
  }
  return m.left > 0 ? `, en ${m.left} ${m.left === 1 ? "semana" : "semanas"}` : ", esta semana";
}

export function ProgramHero({ p, trainedToday, energy, dateKey, demo, mins, voice = DEFAULT_VOICE, lastTime = null, she = false }: { p: AthleteProgram; trainedToday: boolean; energy: number; dateKey: string; demo: boolean; mins: number; voice?: Voice; lastTime?: string | null; she?: boolean }) {
  const ink = coverInk(p.cover);
  const r = p.run;
  const plan = p.plan;
  const session = r.today === "entreno" && plan.program;
  const x = p.meta.experience;
  const coach = coachOf(x);
  // Primer día: la bienvenida del programa; después, el consejo de la coach (Coach Banana o Coach Platanita) de esa semana.
  const first = r.sessionsDone === 0 && r.week === 1 && !!x?.welcome;
  const tip = first ? x!.welcome : tipFor(x, r.week);
  return (
    <section aria-labelledby="prog-hoy" className="overflow-hidden rounded-[1.75rem] shadow-soft">
      <ChallengeCover c={{ id: p.slug, cover: p.cover, icon: p.icon }} chip={false} className="p-5 sm:p-6">
        <div className={`relative ${ink}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-ink px-2.5 text-[11px] font-extrabold uppercase tracking-[.1em] text-banana"><BrandIcon name={p.icon} className="size-3.5" />{x?.mode ?? "Programa activo"}</span>
            {p.season && <span style={{ backgroundColor: SPORTS[p.season.sport].accent }} className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-extrabold uppercase tracking-[.1em] text-white"><Medal weight="fill" className="size-3.5" />Temporada de {SPORTS[p.season.sport].name.toLowerCase()}</span>}
            {r.phase.phase.deload && <span className="inline-flex h-7 items-center gap-1 rounded-full bg-white/85 px-2.5 text-[11px] font-extrabold text-ink"><TreePalm weight="duotone" className="size-3.5" />Semana de descarga</span>}
          </div>
          {/* Título y semana sin pasar del velo (72 %): no se montan sobre la coach de la portada. */}
          <h2 id="prog-hoy" className="mt-3 max-w-[72%] text-[26px] sm:text-[30px] font-extrabold leading-tight tracking-tight text-balance">{p.title}</h2>
          <p className="mt-1 max-w-[72%] text-sm font-bold opacity-85">{weekLabel(p)}. Fase {r.phase.index}: {r.phase.phase.name}</p>
          <div className="mt-3">
            <ProgressBar value={r.pct} min={0.03} className="h-2.5" track="bg-white/25" fill={p.cover === "noche" ? "bg-banana" : "bg-ink"} label={`Programa: ${r.sessionsDone} de ${r.sessionsTotal} sesiones`} />
            <p className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-xs font-bold tabular-nums opacity-85"><span>{n(r.sessionsDone)} de {n(r.sessionsTotal)} sesiones</span><span>{Math.round(r.pct * 100)} % del programa</span></p>
          </div>
        </div>
      </ChallengeCover>

      <div className="bg-cream p-5 sm:p-6">
        {session ? (
          <>
            <p className="text-sm font-semibold text-muted">Hoy {DAY_NAMES[new Date(dateKey + "T12:00:00").getDay()]}, sesión del programa</p>
            <h3 className="mt-0.5 text-2xl font-extrabold tracking-tight text-ink">{plan.name}</h3>
            <p className="mt-1 text-sm font-semibold text-ink/70 tabular-nums">{sessionLine(voice, { exercises: plan.exercises.length, mins, tempo: commonTempo(plan.program?.exercises ?? []) })}{plan.program?.deload ? t(voice, { basico: ", más liviano esta semana", intermedio: ", con carga de descarga", tecnico: ", descarga" }) : ""}</p>
            {trainedToday ? (
              <p className="mt-4 flex items-center gap-2 font-extrabold text-ink"><CheckCircle weight="fill" className="size-5 shrink-0 text-peel" />Ya entrenaste hoy. La sesión del programa sigue lista para cuando quieras.</p>
            ) : <div className="mt-4"><Readiness voice={voice} initial={energy} dateKey={dateKey} demo={demo} mins={mins} she={she} coachName={coach.name} program /></div>}
            {lastTime && !trainedToday && <p className="mt-3 flex items-start gap-1.5 rounded-2xl bg-ink px-3 py-2.5 text-sm font-semibold leading-snug text-banana"><TrendUp weight="bold" className="mt-0.5 size-4 shrink-0" aria-hidden />{lastTime}</p>}
            <div className="mt-3"><ExerciseTiles exercises={plan.program!.exercises} voice={voice} label="Ejercicios de la sesión" art={coach.exercise} /></div>
            {setsLegend(voice) && !trainedToday && <p className="mt-2 text-xs font-semibold text-ink/70">{setsLegend(voice)}</p>}
          </>
        ) : r.today === "hecho" ? (
          <p className="flex items-start gap-2.5 text-ink"><CheckCircle weight="fill" className="mt-0.5 size-6 shrink-0 text-peel" /><span><b className="block text-lg font-extrabold">Sesión de hoy completada</b><span className="text-sm text-muted">{r.nextOn ? `Tu próxima sesión es el ${fmtDay(r.nextOn)}.` : "Descansa y come bien."}</span></span></p>
        ) : r.today === "terminado" || (r.today === "semana-completa" && r.week === r.weeks && r.canFinish) ? (
          <div>
            <p className="flex items-start gap-2.5 text-ink"><Flag weight="duotone" className="mt-0.5 size-6 shrink-0 text-ember-ink" /><span><b className="block text-lg font-extrabold">{r.today !== "terminado" ? "Hiciste todas las sesiones" : r.byDays ? `Terminaste los ${r.days} días` : `Terminaste las ${r.weeks} semanas`}</b><span className="text-sm text-muted">{r.today !== "terminado" ? `${r.byDays ? `Hoy es el día ${Math.min(r.days, r.effectiveDay + 1)} de ${r.days}: camina y estira. ` : ""}Ya puedes cerrar el programa, recibir tu certificado y comparar con tu día 1.` : "Cierra el programa para recibir tu certificado y comparar con tu día 1."}</span></span></p>
            <Link href={`/app/retos/${p.slug}/progreso`} className="btn-primary mt-4 h-12 w-full sm:w-auto px-6">Ver mi certificado<ArrowRight weight="bold" className="size-5" /></Link>
          </div>
        ) : r.today === "pausado" ? (
          <p className="flex items-start gap-2.5 text-ink"><Pause weight="duotone" className="mt-0.5 size-6 shrink-0" /><span><b className="block text-lg font-extrabold">Programa en pausa</b><span className="text-sm text-muted">Reanúdalo desde su página cuando quieras.</span></span></p>
        ) : (
          <div>
            <p className="flex items-start gap-2.5 text-ink"><TreePalm weight="duotone" className="mt-0.5 size-6 shrink-0 text-sky" /><span>
              <b className="block text-lg font-extrabold">{r.today === "semana-completa" ? "Semana completa" : "Hoy descansas"}</b>
              <span className="text-sm text-muted">{r.today === "semana-completa" ? (r.nextOn ? `La semana ${r.week + 1} empieza el ${fmtDay(r.nextOn)}. Camina y estira.` : "Camina y estira.") : `${x?.restDay ? `${x.restDay}. ` : ""}Tu próxima sesión es el ${r.nextOn ? fmtDay(r.nextOn) : "próximo día"}: ${r.next?.session.title ?? ""}. El músculo crece cuando descansas.`}</span>
            </span></p>
            {r.next && <Link href="/app/entreno" className="btn-ghost mt-4 h-12 w-full sm:w-auto px-5">Adelantar la sesión de {r.next.session.title}<ArrowRight weight="bold" className="size-4" /></Link>}
          </div>
        )}
        {tip && r.today !== "terminado" && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl bg-white p-3 shadow-[0_1px_0_var(--color-line)]">
            {coach.id === "banana"
              ? <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-banana text-ink"><Monkey weight="duotone" className="size-5" /></span>
              : <CoachPic src={coach.avatar} size={48} className="size-12 shrink-0 rounded-2xl object-cover" />}
            <p className="min-w-0 text-sm text-body"><b className="block text-[11px] font-extrabold uppercase tracking-[.12em] text-banana-ink">{first ? `${coach.name} te da la bienvenida` : r.byDays ? `${coach.name}, ${weekDaysLabel(p.meta, r.week)}` : `${coach.name}, semana ${r.week}`}</b>{tip}</p>
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line pt-3 text-xs font-semibold text-ink/75">
          {r.milestone && r.today !== "terminado" && <span className="inline-flex items-center gap-1.5"><CalendarCheck weight="duotone" className="size-4 text-banana-ink" />Próximo hito: {r.milestone.label}{milestoneWhen(p)}</span>}
          <Link href={`/app/retos/${p.slug}/progreso`} className="tap inline-flex min-h-11 items-center gap-1 font-bold text-ink hover:underline underline-offset-4">Ver avance<ArrowRight weight="bold" className="size-3.5" /></Link>
        </div>
      </div>
    </section>
  );
}
