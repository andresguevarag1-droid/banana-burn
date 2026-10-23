import { getViewer } from "@/lib/supabase/server";
import { dashboard, getAthlete } from "@/lib/athlete";
import { getDaily } from "@/lib/daily";
import { WeekTabs } from "./week-tabs";
import Link from "next/link";
import { mondayOf } from "@/lib/today";
import { ArrowRight, Books, BrandIcon, CaretRight, Lightning, TreePalm } from "@/components/icons";
import { templatesDoneToday } from "../entreno/done-today";
import { ChallengeCover, coverInk } from "@/components/retos/cover";
import { ProgramWeek } from "@/components/programas/program-week";
import { weekLabel } from "@/components/programas/program-hero";
import { sessionViews } from "@/lib/programs-server";
import { daysLabel } from "@/lib/programs";

import { LIB_COUNT } from "@/lib/library";
export const metadata = { title: "Entrenar" };

export default async function Entrenar() {
  const v = (await getViewer())!;
  const a = await getAthlete(v);
  const d = dashboard(a);
  const g = await getDaily(v, a.startWeight, a.currentWeight);
  const block = (d.week % 6) + 1;
  const doneTpls = await templatesDoneToday(v);
  const todayTpl = d.weekPlan.find((p) => p.dow === d.today.dow)?.tpl ?? null;
  // Hoy cuenta como hecho si ya entrenaste hoy (la plantilla del día u otra sesión); los días anteriores, por actividad registrada.
  const doneToday = doneTpls.length > 0 || g.trainedToday;
  const done = g.week.filter((w) => w.active && w.d < d.today.iso && w.d >= mondayOf(d.today.iso)).map((w) => new Date(w.d + "T12:00:00").getDay())
    .concat(doneToday ? [d.today.dow] : []).filter((dow) => d.weekPlan.find((p) => p.dow === dow)?.tpl);
  const p = d.program;
  return (
    <div className="space-y-5 animate-enter">
      {p ? (
        <>
          {/* Programa activo: su portada, la semana del programa y sus sesiones */}
          <header className="overflow-hidden rounded-[1.75rem] shadow-soft">
            <ChallengeCover c={{ cover: p.cover, icon: p.icon }} chip={false} className="p-5 sm:p-6">
              <div className={`relative ${coverInk(p.cover)}`}>
                <p className="inline-flex h-7 items-center gap-1.5 rounded-full bg-ink px-2.5 text-[11px] font-extrabold uppercase tracking-[.1em] text-banana"><BrandIcon name={p.icon} className="size-3.5" />Programa activo</p>
                <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-balance">{p.title}</h1>
                <p className="mt-1 text-sm font-bold opacity-85">{weekLabel(p)}{p.run.phase.phase.deload && <span className="whitespace-nowrap">, descarga <TreePalm weight="duotone" className="inline size-4 align-[-0.15em]" aria-hidden /></span>}</p>
                <div className="mt-3 flex gap-1" role="progressbar" aria-valuemin={1} aria-valuemax={p.run.weeks} aria-valuenow={p.run.week} aria-label={`Semana ${p.run.week} de ${p.run.weeks}`}>
                  {Array.from({ length: p.run.weeks }, (_, i) => i + 1).map((w) => <span key={w} className={`h-2 flex-1 rounded-full ${w < p.run.week ? (p.cover === "noche" ? "bg-banana" : "bg-ink") : w === p.run.week ? "bg-ember" : "bg-white/30"}`} />)}
                </div>
              </div>
            </ChallengeCover>
            <div className="bg-cream px-5 py-4 sm:px-6">
              <p className="text-sm font-bold text-ink">Fase {p.run.phase.index}: {p.run.phase.phase.name}</p>
              {p.run.phase.phase.focus && <p className="mt-0.5 max-w-[65ch] text-sm text-muted">{p.run.phase.phase.focus}</p>}
              <p className="mt-2 text-xs font-semibold text-muted">{daysLabel(p.meta, p.run.weekSessions.map((w) => w.session))}. Haz las sesiones en orden; si se te pasa un día, hazla al siguiente. Las cargas suben solas con tu historial.</p>
              <Link href={`/app/retos/${p.slug}/progreso`} className="tap mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-ink hover:underline underline-offset-4">Avance y opciones del programa<ArrowRight weight="bold" className="size-4" /></Link>
            </div>
          </header>
          <ProgramWeek current={p.run.next?.day ?? null} label={`Sesiones de la semana ${p.run.week}`}
            sessions={sessionViews(p, p.icon, p.run.weekSessions.map((w) => w.session), p.run.week, d.equipment, (day) => p.run.weekSessions.some((w) => w.day === day && w.done), (day) => (day === p.run.next?.day ? "/app/entreno" : `/app/entreno?sesion=${day}`))} />
        </>
      ) : (
        <>
          <header>
            <p className="text-sm font-semibold text-muted">{a.mode === "recomp" ? "Programa Recomposición Banana" : a.mode === "fuerza" ? "Programa Fuerza Banana" : "Programa Quema Banana"}{a.glp1.on ? " con Banana Shield" : ""}</p>
            <h1 className="mt-0.5 text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">Semana {block} de 6{d.deload && <span className="whitespace-nowrap">, descarga <TreePalm weight="duotone" className="inline size-7 align-[-0.15em] text-sky" aria-hidden /></span>}</h1>
            <div className="mt-3 flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={6} aria-valuenow={block} aria-label={`Semana ${block} de 6`}>
              {[1, 2, 3, 4, 5, 6].map((w) => <span key={w} className={`h-2 flex-1 rounded-full ${w < block ? "bg-ink" : w === block ? "bg-ember" : w === 6 ? "bg-sky/30" : "bg-line"}`} />)}
            </div>
            <p className="mt-2 max-w-[65ch] text-sm text-muted">{a.trainDays} días por semana, nivel {a.level}{a.minutes ? `, ${a.minutes} min por sesión` : ""}. Haz el día que te toca. Si se te pasa uno, hazlo mañana y sigue con el orden: el motor ajusta los pesos solo.</p>
          </header>
          <WeekTabs days={d.weekPlan} todayDow={d.today.dow} done={done} todayDone={!!todayTpl && doneTpls.includes(todayTpl)} />
        </>
      )}
      <section className="rounded-[1.75rem] bg-ink text-white p-5 sm:p-6">
        <h2 className="flex items-start gap-2.5 text-2xl font-extrabold"><Lightning weight="fill" className="mt-1 size-6 shrink-0 text-banana" aria-hidden />¿Día ocupado? Entrena donde estés</h2>
        <p className="mt-1 text-sm text-white/70">Exprés sin equipo: cuerpo completo con tu peso en un espacio de 2 × 2 m. Cuenta para tu racha{p ? ", aunque no reemplaza la sesión del programa" : ""}.</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[[10, "Activa"], [20, "Quema"], [30, "Completo"]].map(([m, l]) => (
            <Link key={m} href={`/app/entreno?expres=${m}`} className="pressable rounded-2xl bg-white/10 hover:bg-white/15 px-2 py-4 text-center">
              <p className="text-3xl font-extrabold text-banana tabular-nums leading-none">{m}<span className="ml-0.5 text-sm font-bold">min</span></p><p className="mt-1.5 text-xs font-bold text-white/70">{l}</p>
            </Link>
          ))}
        </div>
      </section>
      <Link href="/app/ejercicios" className="card p-4 flex items-center gap-3"><span className="grid place-items-center size-11 shrink-0 rounded-xl bg-banana-soft text-banana-ink" aria-hidden><Books weight="duotone" className="size-6" /></span><span className="flex-1"><span className="block font-extrabold text-ink">Biblioteca de {LIB_COUNT.toLocaleString("es-419")} ejercicios</span><span className="block text-sm text-muted">Busca por músculo o equipo, con pasos en español.</span></span><CaretRight weight="bold" className="size-5 shrink-0 text-faint" /></Link>
    </div>
  );
}
