"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DAY_NAMES, type PlannedDay } from "@/lib/engine";

const fmtRest = (s: number) => (s >= 120 ? `${s / 60} min` : `${s} s`);

export function WeekTabs({ days, todayDow, done }: { days: PlannedDay[]; todayDow: number; done: number[] }) {
  const [sel, setSel] = useState(todayDow);
  const p = days.find((d) => d.dow === sel)!;
  const isToday = sel === todayDow;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const active = d.dow === sel, today = d.dow === todayDow, ok = done.includes(d.dow);
          return (
            <button key={d.dow} onClick={() => setSel(d.dow)} className={`relative rounded-2xl py-2.5 text-center transition ${active ? "bg-ink text-white shadow-lift" : d.tpl ? "bg-white border border-line" : "bg-transparent border border-dashed border-line"}`} aria-pressed={active}>
              <p className={`text-[11px] font-bold uppercase ${active ? "text-banana" : today ? "text-ember-ink" : "text-muted"}`}>{DAY_NAMES[d.dow].slice(0, 3)}</p>
              <p className="text-xl mt-0.5">{d.emoji}</p>
              {ok && <span className="absolute -top-1 -right-1 grid place-items-center size-5 rounded-full bg-peel text-white text-[10px] font-bold">✓</span>}
              {today && !active && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 size-1.5 rounded-full bg-ember" />}
            </button>
          );
        })}
      </div>

      <section key={sel} className={`rounded-[1.75rem] p-5 sm:p-6 animate-rise ${isToday && p.tpl ? "bg-banana" : "card"}`}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-ink/60">{DAY_NAMES[p.dow]}{isToday && " · hoy"}</p>
          <span className="chip bg-ink/5 text-ink">{p.tag}</span>
        </div>
        <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-ink">{p.emoji} {p.name}</h2>
        {p.exercises.length > 0 ? (
          <>
            <p className="mt-1 text-sm font-semibold text-ink/60">{p.exercises.length} ejercicios · ~{p.mins ?? 55} min · tempo 3-1-1</p>
            <ol className="mt-4 space-y-2">
              {p.exercises.map((e, i) => (
                <li key={e.id} className="flex items-center gap-3 rounded-2xl bg-white/80 px-3.5 py-3">
                  <span className="grid place-items-center size-8 shrink-0 rounded-xl bg-ink text-white text-sm font-bold">{i + 1}</span>
                  <div className="flex-1 min-w-0"><p className="font-bold text-ink leading-tight">{e.name}</p><p className="text-xs text-muted">{e.muscle} · descanso {fmtRest(e.cfg.rest)}</p></div>
                  <p className="shrink-0 whitespace-nowrap font-extrabold text-ink tabular-nums">{e.cfg.sets}×{e.cfg.lo}–{e.cfg.hi}{e.cfg.unit === "s" ? " s" : e.cfg.unit === "m" ? " m" : ""}</p>
                </li>
              ))}
            </ol>
            {p.cardio && <p className="mt-3 text-sm font-semibold text-ink/70">🚶 Al final: {p.cardio}</p>}
            <Link href={isToday ? "/app/entreno" : `/app/entreno?dia=${p.dow}`} className={`mt-5 w-full sm:w-auto h-13 px-6 ${isToday ? "btn-primary" : "btn-ghost"}`}>{isToday ? "Empezar entreno de hoy" : `Hacer ${p.name} ahora`} <ArrowRight className="size-5" /></Link>
          </>
        ) : (
          <p className="mt-3 text-ink/80">🌴 {p.cardio}. El músculo crece cuando descansas.</p>
        )}
      </section>
    </div>
  );
}
