"use client";
import { useEffect, useRef } from "react";
import { BananaCoin, BananaFlame, BananaTrophy, CaretDown, Check, FlagCheckered, LevelIcon, Lightbulb, Timer } from "@/components/icons";
import { ExerciseMotion } from "@/components/exercise-motion";
import { EFFORTS, clock, type Effort } from "./logic";
import { CountRing, GoldBanana, LevelMeter } from "./ui";
import css from "./workout.module.css";

export type RestInfo = {
  /** Serie que se acaba de terminar (para preguntar el esfuerzo) */
  setNo: number | null;
  effort: Effort | null;
  xp: number; xpKey: number;
  combo: number;
  pr: string | null;
  /** Serie marcada más rápido de lo posible: no suma XP (se dice, no se esconde) */
  rushed?: boolean;
  /** Pista de una línea la primera vez que aparece algo nuevo */
  tip?: "xp" | "combo" | null;
  /** Nombre del ejercicio que se acaba de completar entero */
  finished: string | null;
  bananas: { got: number; total: number };
  next: { title: string; detail: string; anim?: string; isNew: boolean; last: boolean } | null;
  /** Nivel al que se acaba de subir con esta serie */
  levelUp?: { idx: number; n: string } | null;
  /** Hito del entreno (mitad, último empujón...) la primera vez que se cruza */
  milestone?: string | null;
  /** Meta de nivel tras esta serie */
  goal?: { idx: number; progress: number; text: string } | null;
  /** Lo que vale terminar completo y la racha que se protege */
  finish?: string | null;
  /** Pistas de esfuerzo en el registro de la persona ("Me sobraban 1 o 2", "RIR 1-2"). */
  hints?: Partial<Record<Effort, string>>;
  /** Dato motivador con números reales (rota en cada descanso) */
  fact?: string | null;
};

/**
 * Descanso a pantalla completa: un momento, no un aviso. Primero la recompensa (XP, combo, récord),
 * luego una sola pregunta de un toque (¿cómo se sintió?), el reloj grande y lo que sigue.
 * Se puede minimizar para ajustar pesos mientras corre.
 */
export function RestScreen({ left, total, info, closing, onEffort, onAdjust, onSkip, onMinimize, minimizeLabel = "Ajustar pesos" }: {
  left: number; total: number; info: RestInfo; closing: boolean;
  /** "Ajustar pesos" o, sin carga (pilates, plancha), "Ajustar la serie". */
  minimizeLabel?: string;
  onEffort: (e: Effort) => void; onAdjust: (d: number) => void; onSkip: () => void; onMinimize: () => void;
}) {
  const go = useRef<HTMLButtonElement>(null);
  const min = useRef(onMinimize);
  useEffect(() => { min.current = onMinimize; }, [onMinimize]);
  // El foco entra al descanso y vuelve al botón Hecho al salir. Escape lo minimiza.
  useEffect(() => {
    go.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); min.current(); return; }
      if (e.key !== "Tab") return;
      const root = go.current?.closest<HTMLElement>('[role="dialog"]');
      if (!root) return;
      const els = Array.from(root.querySelectorAll<HTMLElement>("button:not([disabled])"));
      const first = els[0], last = els[els.length - 1], a = document.activeElement;
      if (e.shiftKey && (a === first || !root.contains(a))) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && (a === last || !root.contains(a))) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-tour="done"]')?.focus({ preventScroll: true }));
    };
  }, []);
  return (
    <div role="dialog" aria-modal="true" aria-label="Descanso" data-closing={closing || undefined}
      className={`${css.rest} fixed inset-0 z-[60] flex flex-col bg-ink text-white`}>
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto flex min-h-full max-w-md flex-col px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-white/70">Descanso</p>
            <button type="button" onClick={onMinimize} className="tap pressable inline-flex items-center gap-1.5 h-11 px-3.5 rounded-full bg-white/10 text-sm font-bold hover:bg-white/20">
              <CaretDown weight="bold" className="size-4" />{minimizeLabel}
            </button>
          </div>

          {info.goal && <LevelMeter tone="dark" idx={info.goal.idx} progress={info.goal.progress} text={info.goal.text} className="mt-3" />}

          {/* Recompensa */}
          <div className="mt-3 flex min-h-10 flex-wrap items-center justify-center gap-2">
            {info.xp > 0 && (
              <span key={info.xpKey} className={`${css.collect} inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-banana text-ink text-sm font-extrabold tabular-nums`}>
                <BananaCoin className="size-4" />+{info.xp} XP
              </span>
            )}
            {info.combo >= 2 && (
              <span className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-white/10 text-sm font-extrabold tabular-nums">
                <BananaFlame weight="fill" className="size-4 text-ember" />Combo x{info.combo}
              </span>
            )}
            {info.levelUp && (
              <span className={`${css.collect} inline-flex items-center gap-1.5 h-9 pl-2 pr-3.5 rounded-full bg-banana text-ink text-sm font-extrabold`}>
                <LevelIcon idx={info.levelUp.idx} className="size-5 text-ink!" />Nivel {info.levelUp.idx}: {info.levelUp.n}
              </span>
            )}
            {info.finished && (
              <span className="inline-flex items-center gap-1.5 h-9 pl-2 pr-3.5 rounded-full bg-white/10 text-sm font-extrabold tabular-nums">
                <GoldBanana className="size-6" pop />Banana {info.bananas.got} de {info.bananas.total}
              </span>
            )}
          </div>
          {info.milestone && (
            <p className={`${css.phase} mt-2 mx-auto flex w-fit max-w-full items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-[15px] font-extrabold text-banana`}>
              <FlagCheckered weight="fill" className="size-5 shrink-0" />{info.milestone}
            </p>
          )}
          {info.rushed && (
            <p className="mt-2 mx-auto flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-[13px] font-bold text-white/85">
              <Timer weight="bold" className="size-4 shrink-0" />Ritmo muy rápido: esta serie no suma XP
            </p>
          )}
          {info.tip === "xp" && <p className="mt-2 text-center text-[13px] font-semibold text-white/70">Cada serie suma 10 XP y terminar todo el entreno, 30 más.</p>}
          {info.tip === "combo" && <p className="mt-2 text-center text-[13px] font-semibold text-white/70">Combo: sube con cada serie que haces sin pasarte del descanso. Si te demoras mucho, vuelve a x1.</p>}
          {info.pr && (
            <div className={`${css.shine} ${css.collect} mt-3 flex items-center gap-3 rounded-[1.5rem] bg-banana p-3.5 text-ink`}>
              <BananaTrophy weight="fill" className="size-9 shrink-0" />
              <div className="min-w-0"><p className="font-extrabold leading-tight">Récord personal</p><p className="text-sm font-semibold text-ink/80 truncate">{info.pr}: tu mejor serie hasta hoy</p></div>
            </div>
          )}

          {/* Esfuerzo: una pregunta, un toque */}
          {info.setNo != null && (
            <fieldset className="mt-4">
              <legend className="w-full text-center text-[15px] font-bold">¿Cómo se sintió la serie {info.setNo}?</legend>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                {EFFORTS.map((e) => {
                  const on = info.effort === e.id;
                  return (
                    <button key={e.id} type="button" onClick={() => onEffort(e.id)} aria-pressed={on}
                      className={`pressable flex flex-col items-center justify-center gap-0.5 h-16 rounded-2xl px-1 text-center ${on ? "bg-banana text-ink" : "bg-white/10 text-white hover:bg-white/15"}`}>
                      <span className="inline-flex items-center gap-1 text-[15px] font-extrabold">{on && <Check weight="bold" className="size-4" />}{e.label}</span>
                      <span className={`text-[11px] font-semibold leading-tight ${on ? "text-ink/75" : "text-white/60"}`}>{info.hints?.[e.id] ?? e.hint}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {/* Reloj */}
          {/* En 360 px, 56 + 228 + 56 no cabía en el ancho (los botones quedaban cortados en los bordes): por debajo de
              380 px el reloj se escala al 90 % con margen negativo y los botones bajan a 48 px. */}
          <div className="my-auto flex items-center justify-center gap-1.5 py-5 min-[380px]:gap-3">
            <button type="button" onClick={() => onAdjust(-15)} className="pressable grid place-items-center size-12 min-[380px]:size-14 shrink-0 rounded-full bg-white/10 text-base font-extrabold hover:bg-white/20" aria-label="Quitar 15 segundos">−15</button>
            <div className="-mx-3 scale-90 min-[380px]:mx-0 min-[380px]:scale-100">
              <CountRing left={left} total={total} size={228} stroke={13}>
                <span className="mt-1 block text-xs font-bold text-white/60">de {clock(total)}</span>
              </CountRing>
            </div>
            <button type="button" onClick={() => onAdjust(15)} className="pressable grid place-items-center size-12 min-[380px]:size-14 shrink-0 rounded-full bg-white/10 text-base font-extrabold hover:bg-white/20" aria-label="Sumar 15 segundos">+15</button>
          </div>

          {/* Lo que sigue */}
          {info.next && (
            <div className="flex items-center gap-3 rounded-[1.5rem] bg-white/[.07] p-3">
              {info.next.isNew && info.next.anim ? (
                <span className="relative block size-16 shrink-0 overflow-hidden rounded-2xl bg-banana"><ExerciseMotion anim={info.next.anim} label={false} className="absolute inset-1" /></span>
              ) : (
                <span className="grid place-items-center size-16 shrink-0 rounded-2xl bg-white/10 text-2xl font-extrabold tabular-nums">{info.next.title.match(/\d+/)?.[0] ?? ""}</span>
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold text-banana">{info.next.last ? "Última serie" : info.next.isNew ? "Siguiente ejercicio" : "Sigue"}</p>
                <p className="font-extrabold leading-tight truncate">{info.next.title}</p>
                <p className="text-sm font-semibold text-white/70 tabular-nums truncate">{info.next.detail}</p>
              </div>
            </div>
          )}
          {(info.finish || info.fact) && (
            <div className="mt-2 space-y-1.5 px-1">
              {info.finish && <p className="flex gap-2 text-[13px] font-semibold text-white/80"><BananaCoin className="mt-px size-4 shrink-0 text-banana" /><span>{info.finish}</span></p>}
              {info.fact && <p className="flex gap-2 text-[13px] font-semibold text-white/80"><Lightbulb weight="fill" className="mt-px size-4 shrink-0 text-banana" /><span>{info.fact}</span></p>}
            </div>
          )}
        </div>
      </div>
      <div className="px-5 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button ref={go} type="button" onClick={onSkip} className="btn-banana mx-auto flex w-full max-w-md h-16 text-lg font-extrabold">Listo, vamos</button>
      </div>
    </div>
  );
}

/** Descanso minimizado: el reloj sigue visible abajo mientras ajustas la siguiente serie. */
export function RestPill({ left, onOpen, onSkip }: { left: number; onOpen: () => void; onSkip: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(6.25rem+env(safe-area-inset-bottom))] z-[55] px-4 pointer-events-none">
      <div className={`${css.phase} pointer-events-auto mx-auto flex max-w-md items-center gap-2 rounded-full bg-ink p-1.5 pl-2 text-white shadow-lift`}>
        <button type="button" onClick={onOpen} className="pressable flex flex-1 items-center gap-2.5 rounded-full pl-2 pr-3 h-11 text-left hover:bg-white/10" aria-label={`Descanso, quedan ${Math.ceil(left)} segundos. Abrir`}>
          <CaretDown weight="bold" className="size-4 rotate-180 text-white/70" />
          <span className="text-sm font-bold text-white/70">Descanso</span>
          <span className="ml-auto text-xl font-extrabold tabular-nums">{clock(left)}</span>
        </button>
        <button type="button" onClick={onSkip} className="pressable h-11 px-4 rounded-full bg-banana text-ink text-sm font-extrabold hover:brightness-95">Saltar</button>
      </div>
    </div>
  );
}
