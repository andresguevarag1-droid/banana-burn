"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BrandIcon, Check, PersonSimpleWalk, Repeat, TreePalm } from "@/components/icons";
import { DAY_NAMES, hookLine, type PlannedDay } from "@/lib/engine";
import { DEFAULT_VOICE, muscleText, restText, sessionLine, setsReps, setsLegend, t, type Voice } from "@/lib/voice";


export function WeekTabs({ days, todayDow, done, todayDone = false, voice = DEFAULT_VOICE }: { days: PlannedDay[]; todayDow: number; done: number[]; todayDone?: boolean; voice?: Voice }) {
  const [sel, setSel] = useState(todayDow);
  const p = days.find((d) => d.dow === sel)!;
  const isToday = sel === todayDow;
  const doneHere = isToday && todayDone;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const active = d.dow === sel, today = d.dow === todayDow, ok = done.includes(d.dow);
          return (
            <button key={d.dow} onClick={() => setSel(d.dow)} className={`pressable relative rounded-2xl pt-3 pb-2.5 text-center ${active ? "bg-ink text-white shadow-lift" : d.tpl ? "bg-white border border-line" : "bg-transparent border border-dashed border-line"}`} aria-pressed={active}>
              <p className={`text-[11px] font-bold uppercase ${active ? "text-banana" : today ? "text-ember-ink" : "text-muted"}`}>{DAY_NAMES[d.dow].slice(0, 3)}</p>
              <span className={`mt-1 flex justify-center ${active ? "text-banana" : d.tpl ? "text-banana-ink" : "text-faint"}`}><BrandIcon name={d.icon} className="size-6" title={d.name} /></span>
              {ok && <span className="absolute -top-1.5 -right-1.5 grid place-items-center size-[18px] rounded-full bg-peel text-white ring-2 ring-paper" role="img" aria-label="Hecho"><Check weight="bold" className="size-2.5" /></span>}
              
            </button>
          );
        })}
      </div>

      <section key={sel} className={`rounded-[1.75rem] p-5 sm:p-6 animate-enter ${isToday && p.tpl ? "bg-banana" : "card"}`}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink/75 first-letter:uppercase">{isToday ? `Hoy, ${DAY_NAMES[p.dow]}` : DAY_NAMES[p.dow]}</p>
          {doneHere ? <span className="chip bg-peel text-white"><Check weight="bold" className="size-3.5" />Hecho hoy</span> : <span className="chip bg-ink/5 text-ink">{p.tag}</span>}
        </div>
        <h2 className="mt-1 flex items-start gap-2.5 text-3xl font-extrabold tracking-tight text-ink text-balance leading-[1.1]"><BrandIcon name={p.icon} className="mt-0.5 size-8 shrink-0 text-banana-ink" />{p.name}</h2>
        {p.hook && p.exercises.length > 0 && !doneHere && <p className="mt-2 text-[15px] font-bold text-ink/85 text-pretty">{hookLine(p.hook, p.mins ?? 55)}</p>}
        {p.exercises.length > 0 ? (
          <>
            <p className="mt-1 text-sm font-semibold text-ink/75 tabular-nums">{sessionLine(voice, { exercises: p.exercises.length, mins: p.mins ?? 55, cardio: !!p.cardio })}</p>
            <ol className="mt-4 space-y-2 stagger">
              {p.exercises.map((e, i) => (
                <li key={e.id} className="flex items-center gap-3 rounded-2xl bg-white/80 px-3.5 py-3">
                  <span className="grid place-items-center size-8 shrink-0 rounded-xl bg-ink text-white text-sm font-bold">{i + 1}</span>
                  <div className="flex-1 min-w-0"><p className="font-bold text-ink leading-tight">{e.name}</p><p className="text-xs text-muted">{muscleText(voice, e.muscle)}, {t(voice, { basico: "descansa", intermedio: "descanso de", tecnico: "descanso" })} {restText(e.cfg.rest)}</p></div>
                  <p className={`shrink-0 font-extrabold text-ink tabular-nums text-right ${voice === "basico" ? "max-w-[9rem] text-sm leading-tight" : "whitespace-nowrap"}`}>{setsReps(voice, e.cfg.sets, e.cfg.lo, e.cfg.hi, e.cfg.unit)}</p>
                </li>
              ))}
            </ol>
            {setsLegend(voice) && <p className="mt-2 text-xs font-semibold text-ink/70">{setsLegend(voice)}</p>}
            {p.cardio && <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-ink/70"><PersonSimpleWalk weight="duotone" className="size-5 shrink-0" />Al final: {p.cardio}</p>}
            {doneHere ? (
              <div className="mt-5">
                <p className="text-sm font-semibold text-ink/80">Listo por hoy. Descansar también es parte del plan.</p>
                <Link href="/app/entreno?repetir=1" className="btn-ghost mt-3 w-full sm:w-auto h-13 px-6"><Repeat weight="bold" className="size-5" />Repetir (no suma XP)</Link>
              </div>
            ) : (
              <Link href={isToday ? "/app/entreno" : `/app/entreno?dia=${p.dow}`} className={`mt-5 w-full sm:w-auto h-13 px-6 ${isToday ? "btn-primary" : "btn-ghost"}`}>{isToday ? "Empezar entreno de hoy" : `Hacer ${p.name} ahora`} <ArrowRight weight="bold" className="size-5" /></Link>
            )}
          </>
        ) : (
          <p className="mt-3 flex gap-2.5 text-ink/80"><TreePalm weight="duotone" className="mt-0.5 size-5 shrink-0 text-sky" /><span>{p.cardio}. El músculo crece cuando descansas.</span></p>
        )}
      </section>
    </div>
  );
}
