"use client";
// Pantalla de entreno en vivo para el inicio: la animación real de técnica del mono, la serie, las repeticiones y el peso.
import { ExerciseMotion } from "@/components/exercise-motion";
import { Check, Minus, Plus, X } from "@/components/icons";

export function HeroPlayer({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-[2.6rem] bg-ink p-2 shadow-lift ${className}`} role="img" aria-label="Pantalla de entreno de Banana Burn: sentadilla con barra, serie 3 de 4, 60 kilos por 10 repeticiones, con la animación de la técnica">
      <div aria-hidden className="flex aspect-[390/800] flex-col overflow-hidden rounded-[2.1rem] bg-cream">
        <div className="flex items-center justify-between px-4 pt-4">
          <span className="grid size-8 place-items-center rounded-full bg-white text-ink"><X weight="bold" className="size-4" /></span>
          <p className="text-[13px] font-extrabold text-ink">Piernas de acero y pecho firme</p>
          <span className="rounded-full bg-banana px-2 py-0.5 text-[11px] font-extrabold tabular-nums text-ink">18:42</span>
        </div>
        <div className="mx-4 mt-3 flex gap-1">
          {[1, 1, 0.6, 0].map((v, i) => <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-ink/10"><span className="block h-full rounded-full bg-ink" style={{ width: `${v * 100}%` }} /></span>)}
        </div>
        <div className="px-4 pt-3">
          <p className="text-[11px] font-bold text-muted">Ejercicio 1 de 4, pierna</p>
          <p className="text-lg font-extrabold leading-tight text-ink">Sentadilla con barra</p>
        </div>
        <div className="mx-4 mt-2 min-h-0 flex-1">
          <ExerciseMotion anim="squat" mus="Cuádriceps, glúteos" cues={["Pecho arriba", "Rodillas hacia afuera", "Baja en 3 segundos"]} className="h-full" />
        </div>
        <div className="mx-3 mt-3 rounded-2xl bg-white p-3 shadow-[0_1px_0_var(--color-line)]">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-extrabold text-ink">Serie 3 <span className="text-muted">de 4</span></p>
            <p className="text-[11px] font-bold text-peel">+2,5 kg vs. la vez pasada</p>
          </div>
          <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="flex items-center justify-between rounded-xl bg-cream px-2 py-1.5">
              <span className="grid size-7 place-items-center rounded-lg bg-white"><Minus weight="bold" className="size-3.5" /></span>
              <span className="text-center"><span className="block text-2xl font-extrabold leading-none tabular-nums text-ink">60</span><span className="text-[10px] font-bold text-muted">kg</span></span>
              <span className="grid size-7 place-items-center rounded-lg bg-white"><Plus weight="bold" className="size-3.5" /></span>
            </div>
            <span className="text-lg font-extrabold text-muted">×</span>
            <div className="flex items-center justify-between rounded-xl bg-cream px-2 py-1.5">
              <span className="grid size-7 place-items-center rounded-lg bg-white"><Minus weight="bold" className="size-3.5" /></span>
              <span className="text-center"><span className="block text-2xl font-extrabold leading-none tabular-nums text-ink">10</span><span className="text-[10px] font-bold text-muted">reps</span></span>
              <span className="grid size-7 place-items-center rounded-lg bg-white"><Plus weight="bold" className="size-3.5" /></span>
            </div>
          </div>
        </div>
        <div className="m-3 flex h-12 items-center justify-center gap-2 rounded-2xl bg-banana text-base font-extrabold text-ink">
          <Check weight="bold" className="size-5" />Hecho
        </div>
      </div>
    </div>
  );
}
