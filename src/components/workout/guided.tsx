"use client";
import { useEffect, useRef } from "react";
// Primer entreno guiado (#226): un ejercicio por pantalla, la serie actual en una línea y un botón grande de Terminé la serie.
// Sin lista de series, kilos obligatorios ni tarjeta previa: del Empezar de Hoy a la primera serie marcada hay 2 toques.
import { ArrowsLeftRight, Barbell, Check, Eye, Minus, Play, Plus, X } from "@/components/icons";
import { ExerciseMotion } from "@/components/exercise-motion";
import { CoachArtFill } from "@/components/coach-pic";
import { formatExerciseTask } from "./task";
import { CountRing } from "./ui";
import { ES_LANG, wFmt, type Lang } from "./lang";
import { useLang } from "./use-lang";
import type { T } from "@/lib/i18n/t";

/** "Serie 1 de 2 · 10 repeticiones": el valor sugerido (sin rango de calibración, que asusta al empezar). */
export function guidedLine(o: { setNo: number; sets: number; reps: string; unit?: string; lo: number; hi: number; perSide?: boolean }, L: Lang = ES_LANG) {
  const t = formatExerciseTask({ unit: o.unit, reps: o.reps, kg: "", lo: o.lo, hi: o.hi, bw: true, perSide: !!o.perSide, setNo: o.setNo, sets: o.sets }, L);
  return `${L.t("Serie {n} de {of}", { n: o.setNo, of: o.sets })} · ${t.line}`;
}

/** La instrucción bajo la serie: qué hacer ahora y qué tocar después. */
export function guidedHint(timed: boolean, running: boolean, t: T = ES_LANG.t) {
  if (!timed) return t("Haz las repeticiones y después toca Terminé la serie.");
  return t(running ? "Sigue hasta que el reloj llegue a 0." : "Toca Empezar y sigue el reloj.");
}

export function GuidedSet({ name, cue, anim, art, line, exNo, exTotal, kg, kgMin = 0, timer, onDone, onStart, onKg, onHow, onExit, onSwap }: {
  name: string; cue?: string | null; anim?: string; art?: string | null; line: string; exNo: number; exTotal: number;
  /** Peso sugerido (solo si el ejercicio usa peso): se puede ajustar, no es obligatorio. */
  kg?: number | null;
  /** Menos peso se apaga al llegar aquí: un ejercicio con carga no se guarda en 0 kg. */
  kgMin?: number;
  /** Serie por tiempo: `null` sin empezar (el botón grande la inicia), o los segundos que quedan. */
  timer?: { left: number; label: string } | null;
  onDone: () => void; onStart?: () => void; onKg?: (d: number) => void; onHow: () => void; onExit: () => void;
  /** Hay un ejercicio equivalente (#273): quien no reconoce la máquina o no tiene el equipo lo cambia sin salir. */
  onSwap?: () => void;
}) {
  const L = useLang(); const { t } = L;
  const timed = timer !== undefined;
  const running = !!timer;
  return (
    <>
      <header className="px-4 pt-[max(.5rem,env(safe-area-inset-top))] pb-1.5">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <button type="button" onClick={onExit} className="tap pressable grid place-items-center size-12 shrink-0 rounded-full bg-white border border-line hover:bg-cream" aria-label={t("Salir del entreno")}><X weight="bold" className="size-5" /></button>
          <p className="flex-1 min-w-0 text-center text-[15px] font-extrabold text-ink tabular-nums">{t("Ejercicio {n} de {of}", { n: exNo, of: exTotal })}</p>
          <span aria-hidden className="size-12 shrink-0" />
        </div>
        <div aria-hidden className="mx-auto mt-1 flex max-w-md gap-1">
          {Array.from({ length: exTotal }, (_, i) => <span key={i} className={`h-1 flex-1 rounded-full ${i < exNo ? "bg-ink" : "bg-line"}`} />)}
        </div>
      </header>

      <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden" role="region" aria-label={t("Ejercicio de ahora")}>
        <div className="mx-auto max-w-md px-4 pt-3 pb-6">
          <button type="button" onClick={onHow} className={`pressable relative block w-full h-[clamp(170px,34dvh,420px)] rounded-[2rem] overflow-hidden ${art ? "bg-[#F3E8FF]" : "bg-banana"}`}>
            <span aria-hidden className="contents">{(() => {
              const still = anim ? <ExerciseMotion anim={anim} label={false} className="absolute inset-x-4 top-4 bottom-14" /> : <Barbell weight="duotone" className="absolute inset-0 m-auto size-24 text-ink/80" />;
              return art ? <CoachArtFill src={art} sizes="(min-width: 640px) 448px, 100vw" className="object-contain pb-12" fallback={still} /> : still;
            })()}</span>
            {running ? (
              <span className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-4 pt-16 text-left bg-gradient-to-t from-ink/85 via-ink/55 to-transparent text-white">
                <span className="text-[88px] leading-[.85] font-extrabold tracking-tight tabular-nums">{Math.ceil(timer.left)}</span>
                <span className="pb-2 text-xl font-extrabold uppercase tracking-wide">{timer.label}</span>
              </span>
            ) : (
              <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-ink text-white text-sm font-bold"><Eye weight="bold" className="size-4" aria-hidden />{t("Ver cómo se hace")}<span className="sr-only"> {name}</span></span>
            )}
          </button>
          <h1 className="mt-4 text-[clamp(26px,7.6vw,34px)] leading-[1.1] font-extrabold tracking-tight text-ink text-balance break-words">{name}</h1>
          {/* Qué hacer antes de tocar (#252): sin pantalla previa ni toque extra, el botón dice que la serie ya se hizo.
              El peso sugerido va en la misma tarjeta (#273): a 375 px queda a la vista sin desplazarse. */}
          <div className="mt-3 rounded-2xl bg-white border border-line/70 px-4 py-3">
            <p id="serie-guiada" className="text-xl font-extrabold text-ink tabular-nums">{line}</p>
            {kg != null && onKg && (
              <div className="mt-2 flex items-center gap-3">
                <p className="flex-1 min-w-0 text-sm text-body"><span className="block text-xl font-extrabold text-ink tabular-nums">{kg > 0 ? wFmt(kg, L) : t("Sin peso")}</span>{t("Sugerido. Ajústalo si quieres.")}</p>
                <button type="button" onClick={() => onKg(-1)} disabled={kg <= kgMin} className="tap pressable grid place-items-center size-12 shrink-0 rounded-full bg-cream border border-line disabled:opacity-40" aria-label={t("Menos peso")}><Minus weight="bold" className="size-5" /></button>
                <button type="button" onClick={() => onKg(1)} className="tap pressable grid place-items-center size-12 shrink-0 rounded-full bg-cream border border-line" aria-label={t("Más peso")}><Plus weight="bold" className="size-5" /></button>
              </div>
            )}
            <p className="mt-1 text-[15px] leading-snug font-semibold text-body">{guidedHint(timed, running, t)}</p>
          </div>
          {cue && <p className="mt-3 text-[16px] leading-snug font-semibold text-body break-words">{t("Clave: {cue}", { cue: cue.replace(/^./, (c) => c.toLowerCase()) })}</p>}
          {onSwap && !running && (
            <button type="button" onClick={onSwap} className="tap pressable mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line bg-white px-4 text-[15px] font-bold text-ink">
              <ArrowsLeftRight weight="bold" className="size-5 shrink-0" aria-hidden />{t("¿No conoces este equipo? Usa otro")}
            </button>
          )}
        </div>
      </div>

      <footer className="px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-line bg-white/95">
        <div className="mx-auto max-w-md">
          {timed && !running ? (
            <button type="button" data-tour="done" onClick={onStart} className="pressable w-full h-20 inline-flex items-center justify-center gap-2 rounded-[1.75rem] bg-banana text-ink text-2xl font-extrabold shadow-[0_6px_16px_-8px_rgb(138_98_0/.5)]"><Play weight="fill" className="size-7" />{t("Empezar")}</button>
          ) : (
            <button type="button" data-tour="done" onClick={onDone} aria-describedby="serie-guiada" className="pressable w-full h-20 inline-flex items-center justify-center gap-2.5 rounded-[1.75rem] bg-banana text-ink text-2xl font-extrabold shadow-[0_6px_16px_-8px_rgb(138_98_0/.5)] hover:brightness-95">{t("Terminé la serie")}<Check weight="bold" className="size-7" /></button>
          )}
        </div>
      </footer>
    </>
  );
}

/** Descanso del modo guiado: la cuenta regresiva, lo que sigue y Saltar. `extra`: una sola línea debajo (pedido de tarjeta, #280). */
export function GuidedRest({ left, total, next, onSkip, extra }: { left: number; total: number; next: { name: string; line: string } | null; onSkip: () => void; extra?: React.ReactNode }) {
  const { t } = useLang();
  const skip = useRef<HTMLButtonElement>(null);
  useEffect(() => { skip.current?.focus({ preventScroll: true }); }, []);
  return (
    <div role="dialog" aria-modal="true" aria-label={t("Descanso")} className="fixed inset-0 z-[60] flex flex-col bg-ink text-white">
      <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-6 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-4 text-center">
          <p className="text-2xl font-extrabold">{t("Descansa")}</p>
          <CountRing left={left} total={total} size={220} />
          {next && <p className="max-w-full text-white/85"><span className="block text-sm font-bold uppercase tracking-wide text-banana">{t("Sigue")}</span><span className="block text-lg font-extrabold text-white break-words">{next.name}</span><span className="block tabular-nums">{next.line}</span></p>}
          {extra}
        </div>
      </div>
      <footer className="px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button ref={skip} type="button" onClick={onSkip} className="pressable mx-auto flex w-full max-w-md h-16 items-center justify-center rounded-[1.75rem] bg-banana text-ink text-xl font-extrabold">{t("Saltar")}</button>
      </footer>
    </div>
  );
}
