import { getViewer } from "@/lib/supabase/server";
import { dashboard, getAthlete } from "@/lib/athlete";
import { getDaily, prefetchDaily } from "@/lib/daily";
import { WeekTabs } from "./week-tabs";
import Link from "next/link";
import { ExpressCard } from "@/components/express-chips";
import { mondayOf } from "@/lib/today";
import { ArrowRight, Books, BrandIcon, CaretRight, TreePalm } from "@/components/icons";
import { templatesDoneToday } from "../entreno/done-today";
import { ChallengeCover, coverInk } from "@/components/retos/cover";
import { ProgramWeek } from "@/components/programas/program-week";
import { weekLabel } from "@/components/programas/program-hero";
import { sessionViews } from "@/lib/programs-server";
import { daysLabel, programDayOf, weekDaysLabel } from "@/lib/programs";
import { coachOf } from "@/lib/coaches";

import { LIB_COUNT } from "@/lib/library";
import { FirstTip } from "@/components/guide/first-tip";
import { getVoice } from "@/lib/voice-server";
import { t } from "@/lib/voice";
import { techniqueHref } from "@/components/hoy/exercise-tiles";
import { getLearnState } from "@/lib/primeros-pasos-server";
import { MarkLearn } from "@/components/primeros-pasos/mark-learn";
import { HowToButton, PageTour } from "@/components/primeros-pasos/page-tour";
import { STEP_KEY } from "@/lib/primeros-pasos";
export const metadata = { title: "Entrenar" };

export default async function Entrenar() {
  const v = (await getViewer())!;
  prefetchDaily(v); // el registro del día se lee en paralelo con el atleta (getDaily lo reutiliza)
  const [a, voice, doneTpls, learnState] = await Promise.all([getAthlete(v), getVoice(v), templatesDoneToday(v), getLearnState(v)]);
  const d = dashboard(a);
  const g = await getDaily(v, a.startWeight, a.currentWeight);
  const block = (d.week % 6) + 1;
  const todayTpl = d.weekPlan.find((p) => p.dow === d.today.dow)?.tpl ?? null;
  // Hoy cuenta como hecho si ya entrenaste hoy (la plantilla del día u otra sesión); los días anteriores, por actividad registrada.
  const doneToday = doneTpls.length > 0 || g.trainedToday;
  const done = g.week.filter((w) => w.active && w.d < d.today.iso && w.d >= mondayOf(d.today.iso)).map((w) => new Date(w.d + "T12:00:00").getDay())
    .concat(doneToday ? [d.today.dow] : []).filter((dow) => d.weekPlan.find((p) => p.dow === dow)?.tpl);
  const p = d.program;
  // Programa con su propia coach (Coach Platanita): ella da el consejo y presenta el exprés.
  const pc = p ? coachOf(p.meta.experience) : null;
  const coach = pc && pc.id !== "banana" ? pc : null;
  const daysOfWeek = p?.run.byDays ? weekDaysLabel(p.meta, p.run.week) : null;
  // Tocar un ejercicio abre su técnica (antes la lista no se podía tocar).
  const tech: Record<string, string> = {};
  for (const day of d.weekPlan) for (const e of day.exercises) tech[e.id] ??= techniqueHref(e);
  const views = p ? sessionViews(p, p.icon, p.run.weekSessions.map((w) => w.session), p.run.week, d.equipment, (day) => p.run.weekSessions.some((w) => w.day === day && w.done), (day) => (day === p.run.next?.day ? "/app/entreno" : `/app/entreno?sesion=${day}`)) : [];
  for (const w of views) for (const e of w.exercises) tech[e.id] ??= techniqueHref(e);
  const tourSteps = [
    { target: "ent-dias", title: "Toca un día para ver sus ejercicios", body: p ? "Cada pestaña es una sesión de tu programa. La que te toca ya está elegida." : "Cada día de la semana tiene su entreno. Los días sin entreno son de descanso." },
    { target: "ent-ejercicio", title: "Toca un ejercicio para ver cómo se hace", body: "Verás el movimiento, el músculo que trabaja y los pasos para hacerlo bien." },
    { target: "ent-empezar", title: "Este botón empieza tu entrenamiento", body: "La app te lleva paso a paso. Tú haces el ejercicio y anotas lo que hiciste." },
  ];
  return (
    <div className="space-y-5 animate-enter">
      <MarkLearn k={STEP_KEY.semana} />
      <PageTour tour="entrenar" steps={tourSteps} serverKeys={learnState.keys} finalLabel="A entrenar" />
      <div className="-mb-3 flex justify-end"><HowToButton tour="entrenar" /></div>
      <FirstTip id="entrenar" coach={coach} title={p ? "Las sesiones de tu programa" : "Tu semana de entreno"}>{p ? "Haz las sesiones en orden. Si se te pasa un día, hazla al siguiente: la progresión sube sola con tu historial." : t(voice, { basico: "Toca el día de hoy para empezar. Si se te pasa uno, hazlo mañana: Coach Banana mantiene el orden y te dice qué peso usar.", intermedio: "Toca el día que te toca para empezar. Si se te pasa uno, hazlo mañana: el orden se mantiene y los pesos se ajustan solos.", tecnico: "Sigue el orden de la semana. Si saltas un día, retómalo al siguiente: la progresión de cargas se recalcula con tu historial." })}</FirstTip>
      {/* Exprés arriba: la salida para los días ocupados (antes quedaba al final y casi nadie la veía). */}
      <ExpressCard program={!!p} coach={coach} />
      {p ? (
        <>
          {/* Programa activo: su portada, la semana del programa y sus sesiones */}
          <header className="overflow-hidden rounded-[1.75rem] shadow-soft">
            <ChallengeCover c={{ id: p.slug, cover: p.cover, icon: p.icon }} chip={false} className="p-5 sm:p-6">
              <div className={`relative ${coverInk(p.cover)}`}>
                <p className="inline-flex h-7 items-center gap-1.5 rounded-full bg-ink px-2.5 text-[11px] font-extrabold uppercase tracking-[.1em] text-banana"><BrandIcon name={p.icon} className="size-3.5" />Programa activo</p>
                <h1 className="mt-3 max-w-[72%] text-3xl sm:text-4xl font-extrabold tracking-tight text-balance">{p.title}</h1>
                <p className="mt-1 text-sm font-bold opacity-85">{weekLabel(p)}{p.run.phase.phase.deload && <span className="whitespace-nowrap">, descarga <TreePalm weight="duotone" className="inline size-4 align-[-0.15em]" aria-hidden /></span>}</p>
                <div className="mt-3 flex gap-1" role="progressbar" aria-valuemin={1} aria-valuemax={p.run.weeks} aria-valuenow={p.run.week} aria-label={p.run.byDays ? weekLabel(p) : `Semana ${p.run.week} de ${p.run.weeks}`}>
                  {Array.from({ length: p.run.weeks }, (_, i) => i + 1).map((w) => <span key={w} className={`h-2 flex-1 rounded-full ${w < p.run.week ? (p.cover === "noche" ? "bg-banana" : "bg-ink") : w === p.run.week ? "bg-ember" : "bg-white/30"}`} />)}
                </div>
              </div>
            </ChallengeCover>
            <div className="bg-cream px-5 py-4 sm:px-6">
              <p className="text-sm font-bold text-ink">Fase {p.run.phase.index}: {p.run.phase.phase.name}</p>
              {p.run.phase.phase.focus && <p className="mt-0.5 max-w-[65ch] text-sm text-muted">{p.run.phase.phase.focus}</p>}
              <p className="mt-2 text-xs font-semibold text-muted">{daysLabel(p.meta, p.run.weekSessions.map((w) => w.session))}. Haz las sesiones en orden; si se te pasa un día, hazla al siguiente. La progresión sube sola con tu historial: más peso, repeticiones o segundos.</p>
              <Link href={`/app/retos/${p.slug}/progreso`} className="tap mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-ink hover:underline underline-offset-4">Avance y opciones del programa<ArrowRight weight="bold" className="size-4" /></Link>
            </div>
          </header>
          <ProgramWeek current={p.run.next?.day ?? null} label={daysOfWeek ? `Sesiones de los ${daysOfWeek}` : `Sesiones de la semana ${p.run.week}`} dayLabel={p.run.byDays ? Object.fromEntries(p.run.weekSessions.map((w) => [w.day, programDayOf({ meta: p.meta, sessions: p.run.weekSessions.map((x) => x.session) }, p.run.week, w.day)])) : undefined}
            voice={voice} tech={tech} sessions={views} />
        </>
      ) : (
        <>
          <header>
            <p className="text-sm font-semibold text-muted">{a.mode === "recomp" ? "Programa Recomposición Banana" : a.mode === "fuerza" ? "Programa Fuerza Banana" : "Programa Quema Banana"}{a.glp1.on ? " con Banana Shield" : ""}</p>
            <h1 className="mt-0.5 text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">Semana {block} de 6{d.deload && <span className="whitespace-nowrap">, descarga <TreePalm weight="duotone" className="inline size-7 align-[-0.15em] text-sky" aria-hidden /></span>}</h1>
            <div className="mt-3 flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={6} aria-valuenow={block} aria-label={`Semana ${block} de 6`}>
              {[1, 2, 3, 4, 5, 6].map((w) => <span key={w} className={`h-2 flex-1 rounded-full ${w < block ? "bg-ink" : w === block ? "bg-ember" : w === 6 ? "bg-sky/30" : "bg-line"}`} />)}
            </div>
            <p className="mt-2 max-w-[65ch] text-sm text-muted">{a.trainDays} días por semana, nivel {a.level}{a.minutes ? `, ${a.minutes} min por sesión` : ""}. Haz el día que te toca. Si se te pasa uno, hazlo mañana y sigue con el orden: Coach Banana ajusta los pesos solo.</p>
          </header>
          <WeekTabs voice={voice} tech={tech} days={d.weekPlan} todayDow={d.today.dow} done={done} todayDone={!!todayTpl && doneTpls.includes(todayTpl)} />
        </>
      )}
      <Link href="/app/ejercicios" className="card p-4 flex items-center gap-3"><span className="grid place-items-center size-11 shrink-0 rounded-xl bg-banana-soft text-banana-ink" aria-hidden><Books weight="duotone" className="size-6" /></span><span className="flex-1"><span className="block font-extrabold text-ink">Biblioteca de {LIB_COUNT.toLocaleString("es-419")} ejercicios</span><span className="block text-sm text-muted">Busca por músculo o equipo, con pasos en español.</span></span><CaretRight weight="bold" className="size-5 shrink-0 text-faint" /></Link>
    </div>
  );
}
