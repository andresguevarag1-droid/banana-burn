"use client";
import { Barbell, Check, Minus, Plus } from "@/components/icons";
import { EFFORTS, effortOf, kgFmt, type Effort, type Row } from "./logic";
import { XpPop } from "./ui";

function Stepper({ label, value, placeholder, inputMode, disabled, onMinus, onPlus, onChange }: { label: string; value: string; placeholder?: string; inputMode: "decimal" | "numeric"; disabled?: boolean; onMinus: () => void; onPlus: () => void; onChange: (v: string) => void }) {
  return (
    <div className={`flex-1 min-w-0 rounded-2xl ${disabled ? "bg-white/60" : "bg-cream"}`}>
      <div className="flex items-center h-12">
        <button type="button" disabled={disabled} onClick={onMinus} className="tap pressable grid place-items-center w-9 h-full text-muted hover:text-ink active:text-ink disabled:invisible" aria-label={`Menos ${label}`}><Minus weight="bold" className="size-4" /></button>
        <input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} inputMode={inputMode} placeholder={placeholder} onFocus={(e) => e.target.select()}
          className="w-full min-w-0 bg-transparent text-center text-xl font-extrabold text-ink outline-none tabular-nums placeholder:text-faint disabled:text-ink/70" aria-label={label} />
        <button type="button" disabled={disabled} onClick={onPlus} className="tap pressable grid place-items-center w-9 h-full text-muted hover:text-ink active:text-ink disabled:invisible" aria-label={`Más ${label}`}><Plus weight="bold" className="size-4" /></button>
      </div>
      <p aria-hidden className="-mt-1.5 pb-1 text-center text-[10px] font-bold text-muted">{label}</p>
    </div>
  );
}

/** Vista de lista: todas las series a la vista, para quien prefiere anotar a su ritmo. */
export function ListSets({ rows, active, bw, unit, unitLabel, plates, last, pop, onStep, onChange, onToggle, onEffort, timedSlot }: {
  rows: Row[]; active: number; bw: boolean; unit?: string; unitLabel: string; plates: number[] | null; last: ({ kg: number | null; reps: number } | undefined)[];
  pop: { si: number; xp: number; k: number } | null;
  onStep: (si: number, f: "kg" | "reps", d: number) => void; onChange: (si: number, f: "kg" | "reps", v: string) => void; onToggle: (si: number) => void; onEffort: (si: number, e: Effort) => void;
  timedSlot?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      {rows.map((r, si) => {
        const on = si === active;
        const prev = last[si];
        return (
          <div key={si} className={`rounded-3xl border transition-[background-color,border-color,box-shadow] duration-(--dur-base) ease-out ${r.done ? "bg-peel/10 border-peel/30" : on ? "bg-white border-ink shadow-lift" : "bg-white/70 border-line"}`}>
            <div className="flex items-center gap-2 p-2 pl-3">
              <div className="w-9 shrink-0 text-center">
                <p className={`text-lg font-extrabold leading-none ${r.done ? "text-peel" : "text-ink"}`}>{si + 1}</p>
                {prev && <p className="mt-1 text-[10px] font-semibold text-faint leading-none tabular-nums" title="Última vez">{prev.kg ?? "PC"}×{prev.reps}</p>}
              </div>
              {!(bw && unit === "s") && <Stepper label={bw ? "lastre kg" : "kg"} value={r.kg} placeholder={bw ? "PC" : "0"} inputMode="decimal" disabled={r.done}
                onMinus={() => onStep(si, "kg", -1)} onPlus={() => onStep(si, "kg", 1)} onChange={(v) => onChange(si, "kg", v)} />}
              <Stepper label={unitLabel} value={r.reps} inputMode="numeric" disabled={r.done}
                onMinus={() => onStep(si, "reps", -1)} onPlus={() => onStep(si, "reps", 1)} onChange={(v) => onChange(si, "reps", v.replace(/\D/g, ""))} />
              <button type="button" onClick={() => onToggle(si)} className={`relative pressable grid place-items-center size-14 shrink-0 rounded-2xl ${r.done ? "bg-peel text-white" : on ? "bg-ink text-white" : "bg-line text-muted"}`} aria-label={r.done ? `Desmarcar serie ${si + 1}` : `Completar serie ${si + 1}`}>
                {pop?.si === si && <XpPop k={pop.k} xp={pop.xp} />}
                <Check weight="bold" className="size-7" />
              </button>
            </div>
            {on && timedSlot}
            {on && plates && plates.length > 0 && <p className="flex items-center gap-1.5 px-4 pb-2.5 -mt-0.5 text-[12px] font-semibold text-muted"><Barbell weight="duotone" className="size-4 shrink-0" />Por lado: {plates.map(kgFmt).join(" + ")} kg <span className="text-faint">(barra 20)</span></p>}
            {r.done && (
              <div role="group" aria-label={`Esfuerzo de la serie ${si + 1}`} className="flex gap-1.5 px-3 pb-2.5 -mt-0.5">
                {EFFORTS.map((e) => {
                  const sel = effortOf(r) === e.id;
                  return <button key={e.id} type="button" onClick={() => onEffort(si, e.id)} aria-pressed={sel} className={`chip h-8 ${sel ? "bg-ink text-white" : "bg-white text-ink border border-line"}`}>{e.label}</button>;
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
