"use client";
import { Eye, Target, X } from "@/components/icons";
import css from "./workout.module.css";

/**
 * Antes de la primera serie de cada ejercicio, una sola tarjeta que se lee en segundos: el plan en chips
 * ("4 series", "8 a 12 reps", "Descanso 2 min"), dónde se siente el trabajo, cómo hacerlo en máximo 3 pasos y el error
 * más común. Se empieza con un solo botón grande (en el pie). La ficha completa queda a un toque.
 */
export function ExerciseBrief({ chips, muscles, steps, mistake, tempo, firstTime, onHow, extra }: {
  chips: string[]; muscles: string | null; steps: string[]; mistake: string | null; tempo?: string | null;
  /** Primera vez en el reproductor: una línea de cómo funciona (reemplaza el recorrido de varios pasos). */
  firstTime?: boolean;
  onHow: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <section aria-labelledby="plan-ejercicio" className={`${css.next} rounded-[2rem] bg-white border-2 border-ink p-4 shadow-lift`}>
      <h2 id="plan-ejercicio" className="text-[20px] leading-tight font-extrabold tracking-tight text-ink">Tu plan en este ejercicio</h2>
      <ul aria-label="Plan" className="mt-2 flex flex-wrap gap-1.5">
        {chips.map((c) => <li key={c} className="inline-flex items-center h-9 px-3 rounded-full bg-banana-soft text-[15px] font-extrabold text-ink tabular-nums">{c}</li>)}
      </ul>
      {muscles && (
        <p className="mt-3 flex items-start gap-2 text-[15px] leading-snug text-body">
          <Target weight="duotone" className="mt-0.5 size-5 shrink-0 text-banana-ink" aria-hidden />
          <span><span className="font-extrabold text-ink">Siente el trabajo en:</span> {muscles}</span>
        </p>
      )}
      {steps.length > 0 && (
        <div className="mt-3">
          <h3 className="text-[15px] font-extrabold text-ink">Cómo hacerlo</h3>
          <ol className="mt-1.5 space-y-1.5">
            {steps.map((h, i) => (
              <li key={i} className="flex gap-2.5 text-[15px] leading-snug text-body">
                <span aria-hidden className="grid place-items-center size-6 shrink-0 rounded-full bg-ink text-[13px] font-extrabold text-white">{i + 1}</span>
                <span className="min-w-0 pt-px">{h}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {tempo && <p className="mt-2 text-[15px] leading-snug font-semibold text-body"><span className="font-extrabold text-ink">Ritmo:</span> {tempo}</p>}
      {mistake && (
        <p className="mt-2.5 flex items-start gap-2 rounded-2xl bg-ember/10 p-2.5 text-[14px] leading-snug text-ink">
          <X weight="bold" className="mt-0.5 size-4 shrink-0 text-ember-ink" aria-hidden />
          <span><span className="font-extrabold">Evita:</span> {mistake.replace(/\.$/, "")}.</span>
        </p>
      )}
      <button type="button" onClick={onHow} className="tap mt-2 inline-flex items-center gap-1.5 h-11 text-[15px] font-bold text-ink underline underline-offset-4 decoration-2 decoration-banana">
        <Eye weight="bold" className="size-4" aria-hidden />Ver el movimiento paso a paso
      </button>
      {firstTime && (
        <p className="mt-1 rounded-2xl bg-cream p-3 text-[14px] leading-snug text-body">
          <span className="font-extrabold text-ink">Cómo funciona:</span> haz la serie y toca Terminé la serie. El descanso arranca solo y te avisamos cuando toca seguir.
        </p>
      )}
      {extra}
    </section>
  );
}
