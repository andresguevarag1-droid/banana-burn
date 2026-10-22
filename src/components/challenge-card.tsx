"use client";
import { useState, useTransition } from "react";
import { BrandIcon, Check, PushPin } from "@/components/icons";
import { checkInChallenge, leaveChallenge } from "@/app/actions/challenges";
import type { Challenge } from "@/lib/challenges";

type Cell = { n: number; iso: string; done: boolean; past: boolean; today: boolean };
export type ChallengeView = { ucId: string; c: Pick<Challenge, "id" | "title" | "icon" | "days" | "verify" | "color" | "xp">; task: string; day: number; completed: number; todayDone: boolean; cells: Cell[]; autoOk: boolean; hint: string };

export function ChallengeCard({ v, compact = false }: { v: ChallengeView; compact?: boolean }) {
  const [done, setDone] = useState(v.todayDone);
  const [cells, setCells] = useState(v.cells);
  const [showCal, setShowCal] = useState(!compact);
  const [leaving, setLeaving] = useState(false);
  const [, start] = useTransition();
  const completed = cells.filter((c) => c.done).length;
  const manual = v.c.verify === "manual";

  function check() {
    setDone(true);
    setCells((cs) => cs.map((c) => (c.today ? { ...c, done: true } : c)));
    try { navigator.vibrate?.([30, 40, 60]); } catch { /* */ }
    start(() => { checkInChallenge(v.ucId); });
  }

  return (
    <div className={`rounded-[1.5rem] border border-line/70 p-4 sm:p-5 ${v.c.color} `}>
      <div className="flex items-start gap-3">
        <span className="grid place-items-center size-12 shrink-0 rounded-2xl bg-white text-banana-ink shadow-soft"><BrandIcon name={v.c.icon} className="size-7" /></span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-ink/75">Día {v.day} de {v.c.days}</p>
          <p className="font-extrabold text-ink leading-tight">{v.c.title}</p>
          <div className="mt-2 h-2 rounded-full bg-white/70 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={v.c.days} aria-valuenow={completed} aria-label={`${completed} de ${v.c.days} días`}>
            <div className="h-full rounded-full bg-ink transition-all duration-700" style={{ width: `${(completed / v.c.days) * 100}%` }} />
          </div>
        </div>
        <span className="text-sm font-extrabold text-ink tabular-nums">{completed}/{v.c.days}</span>
      </div>
      <div className="mt-3 rounded-2xl bg-white/80 p-3 flex items-center gap-3">
        <p className="flex-1 flex gap-1.5 text-sm font-semibold text-ink"><PushPin weight="duotone" className="mt-0.5 size-4 shrink-0 text-ink/70" /><span>Hoy: {v.task}</span></p>
        {done ? (
          <span className="chip h-9 bg-peel text-white"><Check weight="bold" className="size-4" />Hecho</span>
        ) : manual ? (
          <button onClick={check} className="tap pressable inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-ink text-white text-sm font-bold hover:bg-black">Hecho <Check weight="bold" className="size-4" /></button>
        ) : (
          <span className="text-[11px] font-semibold text-muted max-w-28 text-right">{v.hint}</span>
        )}
      </div>
      {compact && <button onClick={() => setShowCal((s) => !s)} className="tap mt-2 text-xs font-bold text-ink/75 hover:text-ink" aria-expanded={showCal}>{showCal ? "Ocultar calendario" : "Ver calendario"}</button>}
      {showCal && (
        <ol className="mt-3 grid grid-cols-10 gap-1" aria-label="Calendario del reto">
          {cells.map((c) => (
            <li key={c.n} title={`Día ${c.n}`} className={`aspect-square grid place-items-center rounded-md text-[10px] font-bold ${c.done ? "bg-ink text-banana" : c.today ? "border-2 border-ink text-ink bg-white" : c.past ? "bg-white/40 text-faint line-through" : "bg-white/60 text-ink/60"}`}>
              {c.done ? <Check weight="bold" className="size-3" /> : c.n}<span className="sr-only">{c.done ? " cumplido" : c.past ? " no cumplido" : ""}</span>
            </li>
          ))}
        </ol>
      )}
      {!compact && (leaving ? (
        <div className="mt-3 flex items-center gap-2 text-xs"><span className="font-semibold text-ink">¿Seguro? Pierdes tu progreso.</span>
          <button onClick={() => start(async () => { await leaveChallenge(v.ucId); location.reload(); })} className="tap px-1 font-bold text-bad underline">Sí, abandonar</button>
          <button onClick={() => setLeaving(false)} className="tap px-2 font-bold text-ink underline">No</button></div>
      ) : <button onClick={() => setLeaving(true)} className="tap mt-3 text-xs font-semibold text-muted underline hover:text-ink">Abandonar reto</button>)}
    </div>
  );
}
