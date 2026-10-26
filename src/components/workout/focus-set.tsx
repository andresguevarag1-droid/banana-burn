"use client";
import { ArrowCounterClockwise, Barbell, Check, Minus, Plus, Timer } from "@/components/icons";
import { EFFORTS, effortOf, kgFmt, num, restLabel, targetText, type Row } from "./logic";
import type { Task } from "./task";
import css from "./workout.module.css";

type Props = {
  rows: Row[]; active: number; bw: boolean;
  /** La meta de la serie de ahora ya formateada (formatExerciseTask). */
  task: Task;
  /** Ritmo del programa explicado en simple ("Baja lento contando 3..."). */
  tempo?: string | null; unit?: string; restSec: number; plates: number[] | null;
  /** Por tiempo y por lado: el valor es de un lado ("35 segundos por lado"). */
  perSide?: boolean;
  /** Sin lastre: en un programa de piso (pilates) el peso corporal no lleva el campo de kilos. */
  noBallast?: boolean;
  /** Pesos para empezar (calibración o serie sin peso): un toque y listo */
  chips?: { kg: number; label?: string }[] | null;
  onPickKg?: (si: number, kg: number) => void;
  prev: { kg: number | null; reps: number } | undefined;
  onStep: (si: number, field: "kg" | "reps", d: number) => void;
  onChange: (si: number, field: "kg" | "reps", v: string) => void;
  onCopy: (si: number, kg: string, reps: string) => void;
  onUndo: (si: number) => void;
};

/** Ajuste compacto: − valor + en una fila. Sirve para anotar lo que de verdad hiciste (la meta va arriba, en grande). */
function Stepper({ label, unit, value, placeholder, inputMode, onMinus, onPlus, onChange }: {
  label: string; unit: string; value: string; placeholder?: string; inputMode: "decimal" | "numeric"; onMinus: () => void; onPlus: () => void; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-1 min-w-0 items-center gap-1 rounded-2xl bg-cream p-1">
      <button type="button" onClick={onMinus} className="pressable grid place-items-center size-12 shrink-0 rounded-xl bg-white text-ink hover:bg-banana-soft" aria-label={`Menos ${label}`}><Minus weight="bold" className="size-5" /></button>
      <label className="flex-1 min-w-0 text-center">
        <span className="sr-only">{label}</span>
        <input value={value} onChange={(e) => onChange(e.target.value)} inputMode={inputMode} placeholder={placeholder} onFocus={(e) => e.target.select()} enterKeyHint="done"
          className="w-full min-w-0 bg-transparent text-center text-[26px] h-8 leading-none font-extrabold tracking-tight text-ink outline-none tabular-nums rounded-lg placeholder:text-faint focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-banana/60" />
        <span aria-hidden className="block truncate text-[11px] font-bold text-muted">{unit}</span>
      </label>
      <button type="button" onClick={onPlus} className="pressable grid place-items-center size-12 shrink-0 rounded-xl bg-white text-ink hover:bg-banana-soft" aria-label={`Más ${label}`}><Plus weight="bold" className="size-5" /></button>
    </div>
  );
}

/** Serie ya hecha: una línea con lo que levantaste, el esfuerzo y deshacer. */
export function DoneRow({ si, row, unit, bw, perSide, onUndo }: { si: number; row: Row; unit?: string; bw: boolean; perSide?: boolean; onUndo: (si: number) => void }) {
  const eff = effortOf(row);
  return (
    <div className="flex items-center gap-2.5 rounded-2xl bg-peel/10 pl-3 pr-1 h-12">
      <span aria-hidden className="grid place-items-center size-6 shrink-0 rounded-full bg-peel text-white"><Check weight="bold" className="size-3.5" /></span>
      <span className="shrink-0 whitespace-nowrap text-sm font-bold text-ink tabular-nums">Serie {si + 1}</span>
      <span className="flex-1 min-w-0 truncate text-sm font-semibold text-muted tabular-nums">{targetText(row, { unit, bw, perSide })}</span>
      {eff && <span className="chip h-6 shrink-0 bg-white text-ink">{EFFORTS.find((e) => e.id === eff)?.label}</span>}
      <button type="button" onClick={() => onUndo(si)} className="pressable grid place-items-center size-11 shrink-0 rounded-full text-muted hover:bg-white hover:text-ink" aria-label={`Deshacer serie ${si + 1}`}>
        <ArrowCounterClockwise weight="bold" className="size-5" />
      </button>
    </div>
  );
}

const showKgFor = (bw: boolean, timed: boolean, noBallast: boolean) => !(bw && (timed || noBallast));

/**
 * La serie de ahora, de arriba hacia abajo: qué serie es (con puntos), la meta en grande ("12 repeticiones"), con qué
 * peso, el rango explicado en simple si aplica, y abajo, chico, dónde anotar lo que de verdad hiciste.
 * Las series hechas y las que faltan van debajo: lo primero siempre es qué hacer ahora.
 */
export function FocusSet({ rows, active, task, tempo, bw, noBallast = false, unit, perSide = false, restSec, plates, prev, chips, onPickKg, onStep, onChange, onCopy, onUndo }: Props) {
  const r = rows[active];
  const n = rows.length;
  const lastDone = [...rows.slice(0, active)].reverse().find((x) => x.done);
  const same = lastDone && (lastDone.kg !== r.kg || lastDone.reps !== r.reps);
  const fromPrev = prev && (String(prev.kg ?? "") !== r.kg || String(prev.reps) !== r.reps) && !same;
  const timed = unit === "s";
  const ul = unit === "s" ? (perSide ? "seg por lado" : "segundos") : unit === "m" ? "metros" : perSide ? "reps por lado" : "reps";
  const showKg = showKgFor(bw, timed, noBallast);
  const kgIsHint = !!task.load && !task.load.startsWith("con");

  return (
    <div className="space-y-2">
      {/* Serie actual */}
      <section key={active} aria-labelledby="serie-actual" aria-describedby="meta-actual" className={`${css.next} rounded-[2rem] bg-white border-2 border-ink p-4 shadow-lift`}>
        <div className="flex items-center justify-between gap-3">
          <h2 id="serie-actual" className="text-[22px] leading-tight font-extrabold tracking-tight text-ink tabular-nums">
            {task.step === "Última serie" ? "Última serie" : <>Serie {active + 1} <span className="font-bold text-muted">de {n}</span></>}
          </h2>
          <div aria-hidden className="flex shrink-0 gap-1.5">
            {rows.map((x, si) => <span key={si} className={`h-2.5 rounded-full transition-[width,background-color] duration-(--dur-base) ease-out ${si === active ? "w-7 bg-ink" : x.done ? "w-2.5 bg-peel" : "w-2.5 bg-line"}`} />)}
          </div>
        </div>

        {/* La meta: lo más grande de la tarjeta, del tamaño del reloj. */}
        <div id="meta-actual" className="mt-1">
          <p className="text-[12px] font-extrabold uppercase tracking-[.12em] text-muted">Haz ahora</p>
          <p className="flex flex-wrap items-baseline gap-x-2 leading-none text-ink">
            <span className={`${task.value.length > 4 ? "text-[44px]" : "text-[56px]"} font-extrabold tracking-tight tabular-nums`}>{task.value}</span>
            <span className="text-[22px] font-extrabold tracking-tight">{task.unit}</span>
          </p>
          {task.load && !kgIsHint && <p className="mt-1 text-[22px] leading-tight font-extrabold text-ink tabular-nums">{task.load}</p>}
          {task.load && kgIsHint && <p className="mt-1.5 text-[15px] leading-snug font-bold text-body">{task.load}</p>}
          {task.range && <p className="mt-1.5 text-[15px] leading-snug font-semibold text-body text-pretty">{task.range}</p>}
          {tempo && <p className="mt-1 text-[15px] leading-snug font-semibold text-body text-pretty"><span className="font-extrabold text-ink">Ritmo:</span> {tempo}</p>}
        </div>

        {chips && chips.length > 0 && (
          <div role="group" aria-label="Pesos para empezar" className="mt-3 flex flex-wrap gap-2">
            {chips.map((c) => {
              const on = num(r.kg) === c.kg;
              return <button key={c.kg} type="button" onClick={() => onPickKg?.(active, c.kg)} aria-pressed={on} className={`chip h-11 px-4 ${on ? "bg-ink text-white" : "bg-cream text-ink border border-line"}`}>{c.label ? `${c.label} ${kgFmt(c.kg)} kg` : `${kgFmt(c.kg)} kg`}</button>;
            })}
          </div>
        )}

        {/* Anotar lo que hiciste: secundario y compacto. */}
        <p className="mt-3 text-[13px] font-bold text-muted">{showKg ? "¿Usaste otro peso o hiciste otras? Ajústalo aquí:" : "¿Hiciste otro número? Ajústalo aquí:"}</p>
        <div className="mt-1.5 flex items-center gap-2">
          {showKg && <Stepper label={bw ? "lastre en kg" : "kilos"} unit={bw ? "kg extra" : "kg"} value={r.kg} placeholder="0" inputMode="decimal"
            onMinus={() => onStep(active, "kg", -1)} onPlus={() => onStep(active, "kg", 1)} onChange={(v) => onChange(active, "kg", v)} />}
          <Stepper label={ul} unit={ul} value={r.reps} inputMode="numeric"
            onMinus={() => onStep(active, "reps", -1)} onPlus={() => onStep(active, "reps", 1)} onChange={(v) => onChange(active, "reps", v.replace(/\D/g, ""))} />
        </div>

        {(same || fromPrev) && (
          <div className="mt-2 flex flex-wrap gap-2">
            {same && lastDone && <button type="button" onClick={() => onCopy(active, lastDone.kg, lastDone.reps)} className="chip h-11 px-4 bg-cream text-ink border border-line">Igual que la anterior: {targetText(lastDone, { unit, bw, perSide })}</button>}
            {fromPrev && prev && <button type="button" onClick={() => onCopy(active, prev.kg != null ? String(prev.kg) : "", String(prev.reps))} className="chip h-11 px-4 bg-cream text-ink border border-line">La vez pasada: {prev.kg != null ? `${kgFmt(prev.kg)} kg × ` : ""}{prev.reps}</button>}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] font-semibold text-muted">
          <span data-tour="rest" className="inline-flex items-center gap-1.5"><Timer weight="duotone" className="size-4" />Al terminar, descansas {restLabel(restSec)}</span>
          {plates && plates.length > 0 && <span className="inline-flex items-center gap-1.5"><Barbell weight="duotone" className="size-4" />Por lado: {plates.map(kgFmt).join(" + ")}</span>}
          {num(r.kg) > 0 && plates && plates.length === 0 && <span className="inline-flex items-center gap-1.5"><Barbell weight="duotone" className="size-4" />Barra sola</span>}
        </div>
      </section>

      {/* Hechas y las que faltan: debajo, para que la serie de ahora quede arriba. */}
      {rows.map((x, si) => x.done && (
        <DoneRow key={si} si={si} row={x} unit={unit} bw={bw} perSide={perSide} onUndo={onUndo} />
      ))}
      {rows.map((x, si) => !x.done && si !== active && (
        <div key={si} className="flex items-center gap-3 rounded-2xl border border-dashed border-line pl-3 pr-4 h-11 text-sm">
          <span className="font-bold text-muted tabular-nums">Serie {si + 1}</span>
          <span className="ml-auto font-semibold text-muted tabular-nums">{targetText(x, { unit, bw, perSide })}</span>
        </div>
      ))}
    </div>
  );
}
