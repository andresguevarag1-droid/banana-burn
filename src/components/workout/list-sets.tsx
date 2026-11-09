"use client";
import { useState } from "react";
import { Barbell, Check, Minus, Plus } from "@/components/icons";
import { EFFORTS, effortOf, kgFmt, num, type Effort, type Row } from "./logic";
import { XpPop } from "./ui";
import { fieldKg, fieldShown, wNum, wUnit } from "./lang";
import { useLang } from "./use-lang";

/** Valor editable. En la serie activa lleva − y + de 44 px; en las demás es un campo compacto (se edita tocándolo). */
function Stepper({ label, value, placeholder, inputMode, disabled, compact, onMinus, onPlus, onChange, onBlur }: { label: string; value: string; placeholder?: string; inputMode: "decimal" | "numeric"; disabled?: boolean; compact?: boolean; onMinus: () => void; onPlus: () => void; onChange: (v: string) => void; onBlur?: () => void }) {
  const { t } = useLang();
  return (
    <div className={`flex-1 min-w-0 rounded-2xl ${disabled ? "bg-white/60" : "bg-cream"}`}>
      <div className="flex items-center h-12">
        {!compact && <button type="button" onClick={onMinus} className="tap pressable grid place-items-center size-12 shrink-0 rounded-2xl text-ink/70 hover:text-ink hover:bg-banana-soft" aria-label={t("Menos {label}", { label })}><Minus weight="bold" className="size-5" /></button>}
        <input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} inputMode={inputMode} placeholder={placeholder} onFocus={(e) => e.target.select()}
          className="w-full min-w-0 bg-transparent text-center text-xl font-extrabold text-ink outline-none tabular-nums placeholder:text-faint disabled:text-ink/70 rounded-xl focus-visible:ring-4 focus-visible:ring-banana/60" aria-label={label} />
        {!compact && <button type="button" onClick={onPlus} className="tap pressable grid place-items-center size-12 shrink-0 rounded-2xl text-ink/70 hover:text-ink hover:bg-banana-soft" aria-label={t("Más {label}", { label })}><Plus weight="bold" className="size-5" /></button>}
      </div>
      <p aria-hidden className="-mt-1.5 pb-1 text-center text-[10px] font-bold text-muted">{label}</p>
    </div>
  );
}

/** Vista de lista: todas las series a la vista, para quien prefiere anotar a su ritmo. */
export function ListSets({ rows, active, bw, noBallast = false, unit, unitLabel, plates, last, needsKg, pop, onStep, onChange, onToggle, onEffort, timedSlot }: {
  rows: Row[]; active: number; bw: boolean; /** Sin campo de lastre para el peso corporal (programa de piso). */ noBallast?: boolean; unit?: string; unitLabel: string; plates: number[] | null; last: ({ kg: number | null; reps: number } | undefined)[];
  /** Ejercicio con carga: no se puede marcar una serie sin peso */
  needsKg?: boolean;
  pop: { si: number; xp: number; k: number } | null;
  onStep: (si: number, f: "kg" | "reps", d: number) => void; onChange: (si: number, f: "kg" | "reps", v: string) => void; onToggle: (si: number) => void; onEffort: (si: number, e: Effort) => void;
  timedSlot?: React.ReactNode;
}) {
  const L = useLang(); const { t } = L;
  // Peso en lb: lo que se escribe se ve tal cual mientras el campo tiene el foco (convertir en cada tecla redondea a 2.5).
  const [draft, setDraft] = useState<{ si: number; v: string } | null>(null);
  const showKg = !(bw && (unit === "s" || noBallast));
  const u = wUnit(L);
  const kgField = (si: number, r: Row, compact: boolean) => showKg && <Stepper label={bw ? t("lastre {u}", { u }) : u} value={draft?.si === si ? draft.v : fieldShown(r.kg, L)} placeholder={bw ? t("PC") : "0"} inputMode="decimal" disabled={r.done} compact={compact}
    onMinus={() => onStep(si, "kg", -1)} onPlus={() => onStep(si, "kg", 1)}
    onChange={(v) => { if (L.units === "imperial") setDraft({ si, v }); onChange(si, "kg", fieldKg(v, L)); }} onBlur={() => setDraft(null)} />;
  const repsField = (si: number, r: Row, compact: boolean) => <Stepper label={unitLabel} value={r.reps} inputMode="numeric" disabled={r.done} compact={compact}
    onMinus={() => onStep(si, "reps", -1)} onPlus={() => onStep(si, "reps", 1)} onChange={(v) => onChange(si, "reps", v.replace(/\D/g, ""))} />;
  return (
    <div className="space-y-2">
      {rows.map((r, si) => {
        const on = si === active;
        const prev = last[si];
        const noKg = !r.done && !!needsKg && num(r.kg) <= 0;
        return (
          <div key={si} className={`rounded-3xl border transition-[background-color,border-color,box-shadow] duration-(--dur-base) ease-out ${r.done ? "bg-peel/10 border-peel/30" : on ? "bg-white border-ink shadow-lift" : "bg-white/70 border-line"}`}>
            <div className="flex items-center gap-2 p-2 pl-3">
              <div className="w-9 shrink-0 text-center">
                <p className={`text-lg font-extrabold leading-none ${r.done ? "text-peel" : "text-ink"}`}>{si + 1}</p>
                {prev && <p className="mt-1 text-[10px] font-semibold text-faint leading-none tabular-nums" title={t("Última vez")}>{prev.kg != null ? (L.units === "metric" ? prev.kg : wNum(prev.kg, L)) : t("PC")}×{prev.reps}</p>}
              </div>
              {on ? (
                <p className="flex-1 min-w-0 text-sm font-bold text-ink">{t("Serie actual")}{noKg && <span className="block text-xs font-semibold text-ember-ink">{t("Escribe el peso para marcarla")}</span>}</p>
              ) : <>
                {kgField(si, r, true)}
                {repsField(si, r, true)}
              </>}
              <button type="button" onClick={() => onToggle(si)} disabled={noKg} className={`relative pressable grid place-items-center size-14 shrink-0 rounded-2xl disabled:opacity-40 ${r.done ? "bg-peel text-white" : on ? "bg-ink text-white" : "bg-line text-muted"}`} aria-label={t(r.done ? "Desmarcar serie {n}" : noKg ? "Serie {n}: escribe el peso para marcarla" : "Completar serie {n}", { n: si + 1 })}>
                {pop?.si === si && <XpPop k={pop.k} xp={pop.xp} />}
                <Check weight="bold" className="size-7" />
              </button>
            </div>
            {on && <div className="flex gap-2 px-2 pb-2">{kgField(si, r, false)}{repsField(si, r, false)}</div>}
            {on && timedSlot}
            {on && plates && plates.length > 0 && <p className="flex items-center gap-1.5 px-4 pb-2.5 -mt-0.5 text-[12px] font-semibold text-muted"><Barbell weight="duotone" className="size-4 shrink-0" />{t("Por lado: {p}", { p: plates.map(kgFmt).join(" + ") })} {u} <span className="text-faint">{t("(barra {w})", { w: wNum(20, L), u })}</span></p>}
            {r.done && (
              <div role="group" aria-label={t("¿Cómo se sintió la serie {n}?", { n: si + 1 })} className="flex gap-1.5 px-3 pb-2.5 -mt-0.5">
                {EFFORTS.map((e) => {
                  const sel = effortOf(r) === e.id;
                  return <button key={e.id} type="button" onClick={() => onEffort(si, e.id)} aria-pressed={sel} className={`chip h-11 flex-1 justify-center ${sel ? "bg-ink text-white" : "bg-white text-ink border border-line"}`}>{t(e.label)}</button>;
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
