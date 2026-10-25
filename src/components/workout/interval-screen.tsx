"use client";
import { Pause, Play, SkipForward, Timer, X } from "@/components/icons";
import { ExerciseMotion } from "@/components/exercise-motion";
import { clock, type IvPhase } from "./logic";
import { SIDE_LABEL } from "./sides";
import { CountRing } from "./ui";
import css from "./workout.module.css";

export type { IvPhase };
type Ex = { name: string; anim?: string; setNo: number; sets: number; exNo: number; exTotal: number };

/**
 * Modo intervalos (exprés): pantalla completa con estados de color que se leen de lejos.
 * TRABAJA = banana, DESCANSA = tinta, PREPÁRATE y CAMBIA DE LADO = tinta con el aro naranja. Avanza solo.
 * Por lado (`side`), el trabajo dice qué lado va: "Lado derecho", cambio de lado, "Lado izquierdo".
 */
export function IntervalScreen({ title, phase, side, left, total, paused, cur, next, plan, done, all, elapsed, workSec, restSec, onStart, onPause, onResume, onSkip, onExit, onFinish }: {
  title: string; phase: IvPhase; side?: 1 | 2; left: number; total: number; paused: boolean; cur: Ex | null; next: Ex | null; plan: { name: string; anim?: string; sets: number; done: number; perSide?: boolean }[]; done: number; all: number; elapsed: number; workSec: number; restSec: number;
  onStart: () => void; onPause: () => void; onResume: () => void; onSkip: () => void; onExit: () => void; onFinish: () => void;
}) {
  const work = phase === "work";
  const show = phase === "rest" || phase === "prep" ? next ?? cur : cur;
  const pause = phase === "prep" || phase === "switch";
  const bg = work ? "bg-banana text-ink" : phase === "ready" ? "bg-paper text-ink" : "bg-ink text-white";
  const sub = work ? "text-ink/70" : phase === "ready" ? "text-muted" : "text-white/65";
  const word = phase === "work" ? (side ? SIDE_LABEL[side] : "Trabaja") : phase === "rest" ? "Descansa" : phase === "prep" ? "Prepárate" : phase === "switch" ? "Cambia de lado" : "";

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${bg} transition-colors duration-(--dur-base) ease-out`}>
      <header className="px-4 pt-[max(.75rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <button type="button" onClick={onExit} className={`tap pressable grid place-items-center size-11 shrink-0 rounded-full ${phase === "ready" ? "bg-white border border-line" : work ? "bg-ink/10" : "bg-white/10"}`} aria-label="Salir del entreno"><X weight="bold" className="size-5" /></button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between text-xs font-bold tabular-nums">
              <span className={sub}>{done} de {all} intervalos</span>
              <span className={`inline-flex items-center gap-1 ${sub}`}><Timer weight="bold" className="size-3.5" aria-hidden /><span className="sr-only">Tiempo </span>{clock(elapsed)}</span>
            </div>
            <div aria-hidden className={`mt-1.5 h-2 rounded-full overflow-hidden ${work ? "bg-ink/15" : phase === "ready" ? "bg-line" : "bg-white/15"}`}>
              <div className={`bar-fill h-full w-full rounded-full ${work || phase === "ready" ? "bg-ink" : "bg-banana"}`} style={{ transform: `translateX(${(done / Math.max(1, all) - 1) * 100}%)` }} />
            </div>
          </div>
        </div>
      </header>

      {phase === "ready" ? (
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-md px-5 pt-6 pb-4">
            <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
            <p className="mt-1 text-muted">{workSec} s de trabajo y {restSec} s de descanso. La app avanza sola: tú solo muévete.</p>
            <ol className="mt-5 space-y-2">
              {plan.map((p, i) => (
                <li key={i} className="flex items-center gap-3 rounded-[1.25rem] bg-white border border-line/70 p-2 pr-4">
                  <span className="relative block size-14 shrink-0 overflow-hidden rounded-xl bg-banana">{p.anim ? <ExerciseMotion anim={p.anim} label={false} className="absolute inset-0.5" /> : null}</span>
                  <span className="flex-1 min-w-0 font-bold text-ink leading-tight">{p.name}</span>
                  <span className="text-sm font-bold text-muted tabular-nums">{p.done ? `${p.done} de ${p.sets}` : `${p.sets} × ${workSec} s${p.perSide ? " por lado" : ""}`}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center px-5 py-4 text-center">
            <p key={`${phase}-${side ?? 0}`} aria-hidden className={`${css.phase} ${word.length > 10 ? "text-[38px]" : "text-[44px]"} leading-none font-extrabold tracking-tight`}>{word}</p>
            <div className="mt-4">
              <CountRing left={left} total={total} size={256} stroke={16}
                track={work ? "rgb(27 21 5 / .14)" : "rgb(255 255 255 / .12)"} color={work ? "#1B1505" : pause ? "var(--color-ember)" : "var(--color-banana)"}
                tip={work ? "text-banana" : "text-ink"} text={work ? "text-ink" : "text-white"}>
                {paused && <span className="mt-1 block text-sm font-extrabold">En pausa</span>}
              </CountRing>
            </div>
            {show && (
              <div key={`${phase}-${show.name}`} className={`${css.phase} mt-5 flex w-full items-center gap-3 rounded-[1.5rem] p-3 text-left ${work ? "bg-ink/[.07]" : "bg-white/[.07]"}`}>
                <span className={`relative block size-24 shrink-0 overflow-hidden rounded-2xl ${work ? "bg-white/70" : "bg-banana"}`}>
                  {show.anim ? <ExerciseMotion anim={show.anim} label={false} className="absolute inset-1" /> : null}
                </span>
                <div className="min-w-0">
                  <p className={`text-xs font-bold ${work ? "text-ink/70" : "text-banana"}`}>{work ? "Ahora" : phase === "prep" ? "Empiezas con" : phase === "switch" ? "Segundo lado" : "Sigue"}</p>
                  <p className="text-xl font-extrabold leading-tight line-clamp-2">{show.name}</p>
                  <p className={`mt-0.5 text-sm font-semibold tabular-nums ${sub}`}>Ejercicio {show.exNo} de {show.exTotal}, ronda {show.setNo} de {show.sets}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <footer className="px-5 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-md gap-2">
          {phase === "ready" ? (
            <button type="button" onClick={onStart} className="btn-banana flex-1 h-16 text-lg font-extrabold"><Play weight="fill" className="size-5" />{done > 0 ? "Seguir" : "Empezar"}</button>
          ) : (
            <>
              <button type="button" onClick={paused ? onResume : onPause} aria-label={paused ? "Seguir" : "Pausa"}
                className={`pressable flex-1 inline-flex items-center justify-center gap-2 h-16 rounded-full text-lg font-extrabold ${work ? "bg-ink text-white" : "bg-banana text-ink"}`}>
                {paused ? <><Play weight="fill" className="size-5" />Seguir</> : <><Pause weight="fill" className="size-5" />Pausa</>}
              </button>
              {paused ? (
                <button type="button" onClick={onFinish} className={`pressable h-16 px-5 rounded-full text-base font-extrabold ${work ? "bg-ink/10" : "bg-white/10"}`}>Terminar</button>
              ) : (
                <button type="button" onClick={onSkip} aria-label={work ? (side === 1 ? "Terminar este lado" : "Terminar este intervalo") : phase === "switch" ? "Saltar el cambio de lado" : "Saltar descanso"}
                  className={`pressable grid place-items-center size-16 rounded-full ${work ? "bg-ink/10" : "bg-white/10"}`}><SkipForward weight="fill" className="size-6" /></button>
              )}
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
