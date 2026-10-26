"use client";
// Pantalla de entreno en vivo para el inicio, igual al reproductor de la app: el movimiento en grande (la animación real
// de técnica del mono), el nombre del ejercicio, la serie con su meta en palabras simples y el botón grande para marcarla.
import { ExerciseMotion } from "@/components/exercise-motion";
import { ArrowsLeftRight, Check, DotsThree, Eye, Minus, Plus, Timer, X } from "@/components/icons";

function Adjust({ v, u }: { v: string; u: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-cream px-1.5 py-1">
      <span className="grid size-6 place-items-center rounded-lg bg-white"><Minus weight="bold" className="size-3" /></span>
      <span className="text-center"><span className="block text-xl font-extrabold leading-none tabular-nums text-ink">{v}</span><span className="text-[9px] font-bold text-muted">{u}</span></span>
      <span className="grid size-6 place-items-center rounded-lg bg-white"><Plus weight="bold" className="size-3" /></span>
    </div>
  );
}

export function HeroPlayer({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-[2.6rem] bg-ink p-2 shadow-lift ${className}`} role="img" aria-label="Pantalla de entreno de Banana Burn: la animación de la sentadilla con barra en grande, ejercicio 1 de 4, faltan unos 32 minutos, serie 3 de 4, haz ahora 10 repeticiones con 60 kilos y el botón Terminé la serie">
      <div aria-hidden className="flex aspect-[390/800] flex-col overflow-hidden rounded-[2.1rem] bg-cream">
        <div className="flex items-center gap-2 px-3.5 pt-3.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-ink"><X weight="bold" className="size-4" /></span>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-[13px] font-extrabold leading-tight text-ink">Piernas de acero</p>
            <p className="inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums text-muted"><Timer weight="bold" className="size-3" />18:42</p>
          </div>
          <span className="grid size-8 shrink-0 place-items-center rounded-full border-[3px] border-banana text-[9px] font-extrabold tabular-nums text-ink">55%</span>
        </div>
        <div className="mx-3.5 mt-1.5 flex items-center justify-between text-[10px] font-bold tabular-nums">
          <span className="text-ink">Ejercicio 1 de 4</span><span className="text-muted">Faltan unos 32 min</span>
        </div>
        <div className="mx-3.5 mt-1 flex items-center gap-1">
          {[0.5, 0, 0, 0].map((v, i) => <span key={i} className={`flex-1 overflow-hidden rounded-full ${i === 0 ? "h-1.5 bg-ink/15" : "h-1 bg-ink/10"}`}><span className="block h-full rounded-full bg-ink" style={{ width: `${v * 100}%` }} /></span>)}
        </div>

        {/* El movimiento: lo más grande de la pantalla */}
        <div className="relative mx-3 mt-2.5 min-h-0 flex-1 overflow-hidden rounded-[1.5rem] bg-banana">
          <ExerciseMotion anim="squat" label={false} className="absolute inset-x-3 top-3 bottom-9" />
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[10px] font-bold text-white"><Eye weight="bold" className="size-3" />Ver cómo se hace</span>
        </div>

        <div className="px-3.5 pt-2">
          <p className="text-[22px] font-extrabold leading-tight tracking-tight text-ink">Sentadilla con barra</p>
          <p className="text-[12px] font-semibold text-body">Clave: rodillas hacia afuera</p>
        </div>

        <div className="mx-3 mt-2 rounded-2xl border-2 border-ink bg-white p-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[17px] font-extrabold leading-tight tabular-nums text-ink">Serie 3 <span className="font-bold text-muted">de 4</span></p>
            <span className="flex gap-1"><span className="size-1.5 rounded-full bg-peel" /><span className="size-1.5 rounded-full bg-peel" /><span className="h-1.5 w-4 rounded-full bg-ink" /><span className="size-1.5 rounded-full bg-line" /></span>
          </div>
          <p className="mt-0.5 text-[8px] font-extrabold uppercase tracking-[.12em] text-muted">Haz ahora</p>
          <p className="flex items-baseline gap-1 leading-none text-ink"><span className="text-[30px] font-extrabold tabular-nums">10</span><span className="text-[13px] font-extrabold">repeticiones</span></p>
          <p className="text-[13px] font-extrabold tabular-nums text-ink">con 60 kg</p>
          <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <Adjust v="60" u="kg" />
            <span className="text-base font-extrabold text-muted">×</span>
            <Adjust v="10" u="reps" />
          </div>
        </div>

        <div className="mx-3 mt-1.5 grid grid-cols-2 gap-1.5">
          <span className="inline-flex h-7 items-center justify-center gap-1 rounded-full border border-line bg-white text-[10px] font-bold text-ink"><ArrowsLeftRight weight="bold" className="size-3" />Cambiar</span>
          <span className="inline-flex h-7 items-center justify-center gap-1 rounded-full border border-line bg-white text-[10px] font-bold text-ink"><DotsThree weight="bold" className="size-3" />Más opciones</span>
        </div>

        <div className="m-3 mt-2 flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-banana text-base font-extrabold text-ink">
          <Check weight="bold" className="size-5" />Terminé la serie
        </div>
      </div>
    </div>
  );
}
