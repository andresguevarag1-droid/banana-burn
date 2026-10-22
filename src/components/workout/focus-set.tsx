"use client";
import { ArrowCounterClockwise, Barbell, Check, Minus, Plus, Timer } from "@/components/icons";
import { EFFORTS, effortOf, kgFmt, num, restLabel, targetText, type Row } from "./logic";
import css from "./workout.module.css";

type Props = {
  rows: Row[]; active: number; bw: boolean; unit?: string; restSec: number; plates: number[] | null;
  /** Pesos para empezar (calibración o serie sin peso): un toque y listo */
  chips?: { kg: number; label?: string }[] | null;
  onPickKg?: (si: number, kg: number) => void;
  prev: { kg: number | null; reps: number } | undefined;
  onStep: (si: number, field: "kg" | "reps", d: number) => void;
  onChange: (si: number, field: "kg" | "reps", v: string) => void;
  onCopy: (si: number, kg: string, reps: string) => void;
  onUndo: (si: number) => void;
};

/** Número gigante editable con − y + debajo. El objetivo de la serie ES el editor: no hay dos lugares para lo mismo. */
function Big({ label, unit, value, placeholder, inputMode, onMinus, onPlus, onChange }: {
  label: string; unit: string; value: string; placeholder?: string; inputMode: "decimal" | "numeric"; onMinus: () => void; onPlus: () => void; onChange: (v: string) => void;
}) {
  return (
    <div className="flex-1 min-w-0 flex flex-col items-center">
      <label className="w-full text-center">
        <span className="sr-only">{label}</span>
        <input value={value} onChange={(e) => onChange(e.target.value)} inputMode={inputMode} placeholder={placeholder} onFocus={(e) => e.target.select()} enterKeyHint="done"
          className={`w-full min-w-0 bg-transparent text-center ${value.length > 4 ? "text-[42px]" : "text-[56px]"} h-[60px] leading-none font-extrabold tracking-tight text-ink outline-none tabular-nums rounded-2xl placeholder:text-faint focus-visible:bg-cream focus-visible:ring-4 focus-visible:ring-banana/60`} />
        <span aria-hidden className="block text-sm font-bold text-muted">{unit}</span>
      </label>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onMinus} className="pressable grid place-items-center size-14 rounded-2xl bg-cream text-ink hover:bg-banana-soft" aria-label={`Menos ${label}`}><Minus weight="bold" className="size-6" /></button>
        <button type="button" onClick={onPlus} className="pressable grid place-items-center size-14 rounded-2xl bg-cream text-ink hover:bg-banana-soft" aria-label={`Más ${label}`}><Plus weight="bold" className="size-6" /></button>
      </div>
    </div>
  );
}

/** Serie ya hecha: una línea con lo que levantaste, el esfuerzo y deshacer. */
export function DoneRow({ si, row, unit, bw, onUndo }: { si: number; row: Row; unit?: string; bw: boolean; onUndo: (si: number) => void }) {
  const eff = effortOf(row);
  return (
    <div className="flex items-center gap-2.5 rounded-2xl bg-peel/10 pl-3 pr-1 h-12">
      <span aria-hidden className="grid place-items-center size-6 shrink-0 rounded-full bg-peel text-white"><Check weight="bold" className="size-3.5" /></span>
      <span className="shrink-0 whitespace-nowrap text-sm font-bold text-ink tabular-nums">Serie {si + 1}</span>
      <span className="flex-1 min-w-0 truncate text-sm font-semibold text-muted tabular-nums">{targetText(row, { unit, bw })}</span>
      {eff && <span className="chip h-6 shrink-0 bg-white text-ink">{EFFORTS.find((e) => e.id === eff)?.label}</span>}
      <button type="button" onClick={() => onUndo(si)} className="pressable grid place-items-center size-11 shrink-0 rounded-full text-muted hover:bg-white hover:text-ink" aria-label={`Deshacer serie ${si + 1}`}>
        <ArrowCounterClockwise weight="bold" className="size-5" />
      </button>
    </div>
  );
}

export function FocusSet({ rows, active, bw, unit, restSec, plates, prev, chips, onPickKg, onStep, onChange, onCopy, onUndo }: Props) {
  const r = rows[active];
  const n = rows.length;
  const lastDone = [...rows.slice(0, active)].reverse().find((x) => x.done);
  const same = lastDone && (lastDone.kg !== r.kg || lastDone.reps !== r.reps);
  const fromPrev = prev && (String(prev.kg ?? "") !== r.kg || String(prev.reps) !== r.reps) && !same;
  const timed = unit === "s";
  const ul = unit === "s" ? "segundos" : unit === "m" ? "metros" : "reps";
  const showKg = !(bw && timed);
  const last = rows.filter((x) => !x.done).length === 1;

  return (
    <div className="space-y-2">
      {/* Series hechas: compactas, con deshacer */}
      {rows.map((x, si) => x.done && (
        <DoneRow key={si} si={si} row={x} unit={unit} bw={bw} onUndo={onUndo} />
      ))}

      {/* Serie actual */}
      <section key={active} aria-labelledby="serie-actual" className={`${css.next} rounded-[2rem] bg-white border-2 border-ink p-4 pb-5 shadow-lift`}>
        <div className="flex items-center justify-between gap-3">
          <h2 id="serie-actual" className="text-lg font-extrabold text-ink tabular-nums">
            {last && n > 1 ? "Última serie" : `Serie ${active + 1}`} <span className="font-bold text-muted">de {n}</span>
          </h2>
          <div aria-hidden className="flex gap-1.5">
            {rows.map((x, si) => <span key={si} className={`h-2 rounded-full transition-[width,background-color] duration-(--dur-base) ease-out ${si === active ? "w-6 bg-ink" : x.done ? "w-2 bg-peel" : "w-2 bg-line"}`} />)}
          </div>
        </div>

        {chips && chips.length > 0 && (
          <div className="mt-3">
            <p className="text-center text-[13px] font-semibold text-muted">{num(r.kg) > 0 ? "Peso sugerido para empezar. Ajústalo si hace falta:" : "Elige un peso para empezar:"}</p>
            <div role="group" aria-label="Pesos para empezar" className="mt-2 flex flex-wrap justify-center gap-2">
              {chips.map((c) => {
                const on = num(r.kg) === c.kg;
                return <button key={c.kg} type="button" onClick={() => onPickKg?.(active, c.kg)} aria-pressed={on} className={`chip h-11 px-4 ${on ? "bg-ink text-white" : "bg-cream text-ink border border-line"}`}>{c.label ? `${c.label} ${kgFmt(c.kg)} kg` : `${kgFmt(c.kg)} kg`}</button>;
              })}
            </div>
          </div>
        )}

        <div className="mt-3 flex items-start">
          {showKg && <>
            <Big label={bw ? "lastre en kg" : "kilos"} unit={bw ? "lastre kg" : "kg"} value={r.kg} placeholder={bw ? "PC" : "0"} inputMode="decimal"
              onMinus={() => onStep(active, "kg", -1)} onPlus={() => onStep(active, "kg", 1)} onChange={(v) => onChange(active, "kg", v)} />
            <span aria-hidden className="mt-3 text-4xl font-extrabold text-faint">×</span>
          </>}
          <Big label={ul} unit={ul} value={r.reps} inputMode="numeric"
            onMinus={() => onStep(active, "reps", -1)} onPlus={() => onStep(active, "reps", 1)} onChange={(v) => onChange(active, "reps", v.replace(/\D/g, ""))} />
        </div>

        {(same || fromPrev) && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {same && lastDone && <button type="button" onClick={() => onCopy(active, lastDone.kg, lastDone.reps)} className="chip h-11 px-4 bg-cream text-ink border border-line">Igual que la anterior: {targetText(lastDone, { unit, bw })}</button>}
            {fromPrev && prev && <button type="button" onClick={() => onCopy(active, prev.kg != null ? String(prev.kg) : "", String(prev.reps))} className="chip h-11 px-4 bg-cream text-ink border border-line">La vez pasada: {prev.kg != null ? `${kgFmt(prev.kg)} × ` : ""}{prev.reps}</button>}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[13px] font-semibold text-muted">
          <span data-tour="rest" className="inline-flex items-center gap-1.5"><Timer weight="duotone" className="size-4" />Descanso de {restLabel(restSec)} al marcar</span>
          {plates && plates.length > 0 && <span className="inline-flex items-center gap-1.5"><Barbell weight="duotone" className="size-4" />Por lado: {plates.map(kgFmt).join(" + ")}</span>}
          {num(r.kg) > 0 && plates && plates.length === 0 && <span className="inline-flex items-center gap-1.5"><Barbell weight="duotone" className="size-4" />Barra sola</span>}
        </div>
      </section>

      {/* Lo que viene */}
      {rows.map((x, si) => !x.done && si !== active && (
        <div key={si} className="flex items-center gap-3 rounded-2xl border border-dashed border-line pl-3 pr-4 h-11 text-sm">
          <span className="font-bold text-muted tabular-nums">Serie {si + 1}</span>
          <span className="ml-auto font-semibold text-muted tabular-nums">{targetText(x, { unit, bw })}</span>
        </div>
      ))}
    </div>
  );
}
