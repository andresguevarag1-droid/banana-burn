"use client";
import { Pause, Play, SkipForward } from "@/components/icons";
import { segLabel, skipLabel, timedView } from "./sides";

type View = ReturnType<typeof timedView>;

/**
 * Cuenta regresiva de una serie por tiempo (plancha, estiramiento). Por lado: el aviso dice qué lado va, el cambio de
 * lado se pinta de tinta para leerse de lejos y dos barras muestran cada lado. Pausa, saltar el tramo y parar.
 */
export function TimedBar({ view, size = "lg", onPause, onResume, onSkip, onStop }: {
  view: View; size?: "lg" | "sm"; onPause: () => void; onResume: () => void; onSkip: () => void; onStop: () => void;
}) {
  const { seg, left, frac, sides, paused, last } = view;
  const lg = size === "lg";
  const label = paused ? "En pausa" : seg.kind === "work" && !seg.side ? null : segLabel(seg);
  const dark = seg.kind === "switch";
  const btn = `tap pressable grid place-items-center size-11 shrink-0 rounded-full ${dark ? "bg-white/15" : "bg-white/20"}`;
  return (
    <div role="timer" aria-label={`Serie por tiempo${sides ? ", por lado" : ""}: ${paused ? "en pausa, " : ""}${segLabel(seg).toLowerCase()}, ${Math.ceil(left)} segundos`}
      className={`flex items-center gap-2 text-white transition-colors duration-(--dur-base) ease-out ${dark ? "bg-ink" : "bg-peel"} ${lg ? "h-[72px] rounded-[1.75rem] pl-3 pr-2" : "rounded-2xl p-2 pl-3"}`}>
      <span className={`${lg ? "w-[6.5rem]" : "w-24"} shrink-0 text-center leading-tight`}>
        {label && <span className={`block font-bold whitespace-nowrap ${dark ? "text-banana" : "text-white/85"} ${lg ? "text-xs" : "text-[11px]"}`}>{label}</span>}
        <span className={`font-extrabold tabular-nums ${label ? (lg ? "text-3xl" : "text-2xl") : lg ? "text-4xl" : "text-3xl"}`}>{Math.ceil(left)}</span>
      </span>
      <div aria-hidden className="flex flex-1 min-w-0 gap-1">
        {sides ? sides.map((p, k) => (
          <div key={k} className={`flex-1 rounded-full bg-white/30 overflow-hidden ${lg ? "h-2.5" : "h-2"}`}>
            <div className="h-full w-full rounded-full bg-white" style={{ transform: `translateX(${(p - 1) * 100}%)`, transition: "transform .25s linear" }} />
          </div>
        )) : (
          <div className={`flex-1 rounded-full bg-white/30 overflow-hidden ${lg ? "h-2.5" : "h-2"}`}>
            <div className="h-full w-full rounded-full bg-white" style={{ transform: `translateX(${-frac * 100}%)`, transition: "transform .25s linear" }} />
          </div>
        )}
      </div>
      <button type="button" onClick={paused ? onResume : onPause} className={btn} aria-label={paused ? "Seguir" : "Pausa"}>
        {paused ? <Play weight="fill" className="size-5" /> : <Pause weight="fill" className="size-5" />}
      </button>
      <button type="button" onClick={onSkip} className={btn} aria-label={skipLabel(seg, last)}><SkipForward weight="fill" className="size-5" /></button>
      <button type="button" onClick={onStop} className={`tap pressable h-11 px-3 shrink-0 rounded-full text-sm font-bold ${dark ? "bg-white/15" : "bg-white/20"}`}>Parar</button>
    </div>
  );
}
