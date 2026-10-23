"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BananaFlame, Banana, Bed, Syringe } from "@/components/icons";
import { useDailySave } from "@/components/use-daily-save";
import { DEFAULT_VOICE, readinessEffects, readinessTips, t, type Voice } from "@/lib/voice";

const OPTS = [
  { v: 1, I: Bed, t: "Cansado", tip: "Modo suave: una serie menos por ejercicio y 3 reps en reserva. Entrenar suave también suma a tu racha.", q: "?modo=suave" },
  { v: 2, I: Banana, t: "Normal", tip: "Plan normal: tempo 3-1-1 y 1 a 2 reps en reserva.", q: "" },
  { v: 3, I: BananaFlame, t: "Con todo", tip: "Aprovecha: intenta 1 rep extra en la última serie de cada básico.", q: "?modo=fuerte" },
];

/**
 * Check-in de energía (estilo "readiness") que ajusta el entreno de hoy. `she`: "Cansada" para ella; `coachName`: la
 * coach del programa (Coach Platanita); `program`: el tempo lo marca cada ejercicio del programa, no el 3-1-1 del método.
 */
export function Readiness({ initial, dateKey, demo, mins, suggestSoft = false, voice = DEFAULT_VOICE, she = false, coachName = "Coach Banana", program = false }: { initial: number; dateKey: string; demo: boolean; mins: number; suggestSoft?: boolean; voice?: Voice; she?: boolean; coachName?: string; program?: boolean }) {
  const key = `bb.ready.${dateKey}`;
  const [v, setV] = useState(initial);
  const daily = useDailySave();
  useEffect(() => { if (demo) try { const s = Number(localStorage.getItem(key)); if (s) setV(s); } catch { /* */ } }, [demo, key]);
  const pick = (n: number) => {
    const prev = v;
    setV(n); try { navigator.vibrate?.(15); } catch { /* */ }
    if (demo) { try { localStorage.setItem(key, String(n)); } catch { /* */ } return; }
    daily.save("energy", n, () => setV((x) => (x === n ? prev : x)));
  };
  const tips = readinessTips(voice, program);
  const effects = readinessEffects(voice);
  const sel = OPTS.find((o) => o.v === v);
  return (
    <div className="relative">
      {daily.toast}
      <p className="text-sm font-bold text-ink/80">¿Cómo te sientes hoy?</p>
      <p className="text-xs font-semibold text-ink/75">{t(voice, { basico: `Elige y ${coachName} ajusta tu entreno a cómo llegas hoy.`, intermedio: "Ajusto el entreno a tu energía de hoy.", tecnico: "Autorregulación del día." })}</p>
      {suggestSoft && !v && <p className="mt-1 flex gap-1.5 text-xs font-semibold text-ink/75"><Syringe weight="duotone" className="size-4 shrink-0" />Cerca de tu inyección: si hay náusea o poca energía, elige “{she ? "Cansada" : "Cansado"}” para el modo suave.</p>}
      <div className="mt-2 grid grid-cols-3 gap-2">
        {OPTS.map((o) => (
          <button key={o.v} onClick={() => pick(o.v)} className={`pressable flex flex-col items-center justify-center gap-0.5 min-h-[4.5rem] rounded-2xl px-1 py-2 text-center ${v === o.v ? "bg-ink text-white shadow-lift" : "bg-white/75 text-ink"}`} aria-pressed={v === o.v}>
            <span className="inline-flex items-center gap-1.5 text-sm font-bold"><span className={`grid place-items-center size-7 shrink-0 rounded-lg ${v === o.v ? "bg-white/10 text-banana" : o.v === 3 ? "bg-ember/10 text-ember-ink" : "bg-banana-soft text-banana-ink"}`}><o.I weight={v === o.v ? "fill" : "duotone"} className="size-4" /></span>{o.v === 1 && she ? "Cansada" : o.t}</span>
            <span className={`text-[11px] font-semibold leading-tight ${v === o.v ? "text-white/80" : "text-ink/75"}`}>{effects[o.v - 1]}</span>
          </button>
        ))}
      </div>
      {sel && <p className="mt-2.5 text-[13px] font-semibold text-ink/80 animate-enter">{tips[sel.v - 1] ?? sel.tip}</p>}
      <Link href={`/app/entreno${sel?.q ?? ""}`} className="mt-4 btn-primary w-full sm:w-auto h-14 px-8 text-[17px] font-extrabold shadow-lift">
        {sel?.v === 1 ? "Empezar modo suave" : "Empezar entreno"} <span className="font-medium text-white/70 tabular-nums">{sel?.v === 1 ? Math.round(mins * 0.75) : mins} min</span> <ArrowRight weight="bold" className="size-5" />
      </Link>
    </div>
  );
}
