"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, BananaFlame, Banana, Bed, Syringe } from "@/components/icons";
import { setDaily } from "@/app/actions/daily";

const OPTS = [
  { v: 1, I: Bed, t: "Cansado", tip: "Modo suave: una serie menos por ejercicio y 3 reps en reserva. Entrenar suave también suma a tu racha.", q: "?modo=suave" },
  { v: 2, I: Banana, t: "Normal", tip: "Plan normal: tempo 3-1-1 y 1 a 2 reps en reserva.", q: "" },
  { v: 3, I: BananaFlame, t: "Con todo", tip: "Aprovecha: intenta 1 rep extra en la última serie de cada básico.", q: "?modo=fuerte" },
];

/** Check-in de energía (estilo "readiness") que ajusta el entreno de hoy. */
export function Readiness({ initial, dateKey, demo, mins, suggestSoft = false }: { initial: number; dateKey: string; demo: boolean; mins: number; suggestSoft?: boolean }) {
  const key = `bb.ready.${dateKey}`;
  const [v, setV] = useState(initial);
  const [, start] = useTransition();
  useEffect(() => { if (demo) try { const s = Number(localStorage.getItem(key)); if (s) setV(s); } catch { /* */ } }, [demo, key]);
  const pick = (n: number) => {
    setV(n); try { navigator.vibrate?.(15); } catch { /* */ }
    if (demo) { try { localStorage.setItem(key, String(n)); } catch { /* */ } return; }
    start(() => { setDaily("energy", n); });
  };
  const sel = OPTS.find((o) => o.v === v);
  return (
    <div className="relative">
      <p className="text-sm font-bold text-ink/75">¿Cómo te sientes hoy?</p>
      {suggestSoft && !v && <p className="mt-1 flex gap-1.5 text-xs font-semibold text-ink/75"><Syringe weight="duotone" className="size-4 shrink-0" />Cerca de tu inyección: si hay náusea o poca energía, elige “Cansado” para el modo suave.</p>}
      <div className="mt-2 grid grid-cols-3 gap-2">
        {OPTS.map((o) => (
          <button key={o.v} onClick={() => pick(o.v)} className={`flex items-center justify-center gap-1.5 h-14 rounded-2xl font-bold text-sm transition active:scale-95 ${v === o.v ? "bg-ink text-white shadow-lift" : "bg-white/70 text-ink"}`} aria-pressed={v === o.v}>
            <span className={`grid place-items-center size-8 shrink-0 rounded-xl ${v === o.v ? "bg-white/10 text-banana" : o.v === 3 ? "bg-ember/10 text-ember-ink" : "bg-banana-soft text-banana-ink"}`}><o.I weight={v === o.v ? "fill" : "duotone"} className="size-5" /></span>{o.t}
          </button>
        ))}
      </div>
      {sel && <p className="mt-2.5 text-[13px] font-semibold text-ink/80 animate-rise">{sel.tip}</p>}
      <Link href={`/app/entreno${sel?.q ?? ""}`} className="mt-4 btn-primary w-full sm:w-auto h-14 px-7 text-base">
        {sel?.v === 1 ? "Empezar modo suave" : "Empezar entreno"} · {sel?.v === 1 ? Math.round(mins * 0.75) : mins} min <ArrowRight weight="bold" className="size-5" />
      </Link>
    </div>
  );
}
