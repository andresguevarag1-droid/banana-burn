"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { setDaily } from "@/app/actions/daily";

const OPTS = [
  { v: 1, e: "😴", t: "Cansado", tip: "Modo suave: una serie menos por ejercicio y 3 reps en reserva. Entrenar suave también suma a tu racha.", q: "?modo=suave" },
  { v: 2, e: "🙂", t: "Normal", tip: "Plan normal: tempo 3-1-1 y 1–2 reps en reserva.", q: "" },
  { v: 3, e: "🔥", t: "Con todo", tip: "¡Aprovecha! Intenta 1 rep extra en la última serie de cada básico.", q: "?modo=fuerte" },
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
      {suggestSoft && !v && <p className="mt-1 text-xs font-semibold text-ink/75">💉 Cerca de tu inyección: si hay náusea o poca energía, elige “Cansado” para el modo suave.</p>}
      <div className="mt-2 grid grid-cols-3 gap-2">
        {OPTS.map((o) => (
          <button key={o.v} onClick={() => pick(o.v)} className={`h-14 rounded-2xl font-bold text-sm transition active:scale-95 ${v === o.v ? "bg-ink text-white shadow-lift" : "bg-white/70 text-ink"}`} aria-pressed={v === o.v}>
            <span className="text-lg mr-1">{o.e}</span>{o.t}
          </button>
        ))}
      </div>
      {sel && <p className="mt-2.5 text-[13px] font-semibold text-ink/80 animate-rise">{sel.tip}</p>}
      <Link href={`/app/entreno${sel?.q ?? ""}`} className="mt-4 btn-primary w-full sm:w-auto h-14 px-7 text-base">
        {sel?.v === 1 ? "Empezar modo suave" : "Empezar entreno"} · {sel?.v === 1 ? Math.round(mins * 0.75) : mins} min <ArrowRight className="size-5" />
      </Link>
    </div>
  );
}
