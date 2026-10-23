"use client";
// Piezas de la hoja "Agregar": fila de alimento, panel de porción (porciones o gramos), armar plato y comida personalizada.
import { useMemo, useState } from "react";
import { CookingPot, Lightbulb, Minus, Plus, Trash, X } from "@/components/icons";
import type { Food } from "@/lib/foods";
import { byGrams, clampQty, extrasFor, kcalFromMacros, portion } from "@/lib/foods-catalog";
import { ingAmount, perServing, RECIPE_MAX_SERVINGS, sumIngs, type RecipeIng } from "@/lib/user-recipes";

export const n0 = (n: number) => Math.round(n).toLocaleString("es-CO");
/** Gramos de macros: enteros desde 10, con un decimal por debajo. */
export const g1 = (n: number) => (n >= 10 ? Math.round(n) : Math.round(n * 10) / 10).toLocaleString("es-CO");
const QTY: [string, number][] = [["½", 0.5], ["1", 1], ["1½", 1.5], ["2", 2]];

/** Proteína, carbos y grasa en una línea compacta. */
export function MacroLine({ pr, c, f, className = "" }: { pr: number; c: number; f: number; className?: string }) {
  return (
    <span className={`flex flex-wrap gap-x-2.5 text-[11px] font-semibold text-muted tabular-nums ${className}`}>
      <span><b className="text-ember-ink">P</b> {g1(pr)} g</span><span><b className="text-banana-ink">C</b> {g1(c)} g</span><span><b className="text-peel">G</b> {g1(f)} g</span>
    </span>
  );
}

/** Fila de resultado: nombre, porción, kcal y macros; botón para agregar 1 porción en un toque. */
export function FoodRow({ f, chain, onPick, onQuick, extra }: { f: Food; chain?: string | null; onPick: () => void; onQuick: () => void; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 rounded-2xl bg-white border border-line pr-1 transition-colors hover:border-ink/40">
      <button onClick={onPick} className="flex-1 min-w-0 rounded-2xl px-3 py-2.5 text-left focus-visible:outline-offset-[-2px]" aria-label={`${f.n}${chain ? ` de ${chain}` : ""}, ${n0(f.k)} kcal: elegir porción`}>
        <span className="flex items-baseline justify-between gap-2"><span className="font-semibold leading-snug text-ink line-clamp-2">{f.n}</span><span className="shrink-0 text-sm font-bold text-ink tabular-nums">{n0(f.k)} kcal</span></span>
        <span className="block text-xs text-muted truncate">{chain && <span className="font-bold text-ink/70">{chain}, </span>}{f.p}</span>
        <MacroLine pr={f.pr} c={f.c} f={f.f} className="mt-0.5" />
      </button>
      {extra}
      <button onClick={onQuick} aria-label={`Agregar ${f.n}`} className="tap pressable grid place-items-center size-11 shrink-0 rounded-full"><span className="grid place-items-center size-9 rounded-full bg-banana text-ink"><Plus weight="bold" className="size-4" /></span></button>
    </div>
  );
}

export type Sel = { qty: number; grams?: undefined } | { grams: number; qty?: undefined };
export type Calc = { kcal: number; protein: number; carbs: number; fat: number };

/** Macros de lo elegido (porciones o gramos). */
export function calcSel(f: Food, sel: Sel): Calc & { label: string; m: number } {
  const g = sel.grams ? byGrams(f, sel.grams) : null;
  if (g) return { ...g, label: `${n0(g.grams)} g`, m: g.grams / (f.gr || 1) };
  const p = portion(f, sel.qty ?? 1);
  return { ...p, label: p.qty === 1 ? f.p : `${f.p} × ${p.qty.toLocaleString("es-CO")}`, m: p.qty };
}

/** Panel de porción: ½, 1, 1½, 2 u otra cantidad, o gramos si el alimento los conoce. Macros en vivo. */
export function PickPanel({ f, chain, unit = "porción", onAdd, onPlate, hint }: { f: Food; chain?: string | null; unit?: string; onAdd: (s: Sel) => void; onPlate?: (s: Sel) => void; hint?: React.ReactNode }) {
  const [mode, setMode] = useState<"qty" | "g">("qty");
  const [qty, setQty] = useState(1);
  const [other, setOther] = useState("");
  const [grams, setGrams] = useState(String(f.gr ?? 100));
  const gNum = Number(grams.replace(",", "."));
  const sel: Sel = mode === "g" && f.gr && gNum > 0 ? { grams: gNum } : { qty: other ? clampQty(other) : qty };
  const r = calcSel(f, sel);
  const ex = extrasFor(f, r.m);
  const valid = mode === "qty" || gNum > 0;
  const gUnit = /\bml\b/.test(f.p) ? "ml" : "g";
  return (
    <div id={`pick-${f.id}`} className="rounded-2xl bg-white border-2 border-ink p-3 scroll-my-3 animate-enter">
      <div className="flex justify-between gap-2"><p className="font-bold text-ink">{f.n}</p><p className="shrink-0 text-lg font-extrabold text-ink tabular-nums">{n0(r.kcal)} kcal</p></div>
      <p className="text-xs text-muted">{chain ? `${chain}, ` : ""}{r.label}</p>
      <dl className="mt-2 grid grid-cols-3 gap-1.5 text-center">
        {([["Proteína", r.protein, "bg-ember/10"], ["Carbos", r.carbs, "bg-banana-soft"], ["Grasa", r.fat, "bg-peel/10"]] as const).map(([l, v, bg]) => (
          <div key={l} className={`rounded-xl ${bg} py-1.5`}><dt className="text-[11px] font-bold text-muted">{l}</dt><dd className="text-sm font-extrabold text-ink tabular-nums">{g1(v)} g</dd></div>
        ))}
      </dl>
      {(ex.fiber != null || ex.sugar != null) && <p className="mt-1.5 text-[11px] text-muted tabular-nums">{ex.fiber != null && <>Fibra {g1(ex.fiber)} g</>}{ex.fiber != null && ex.sugar != null && ", "}{ex.sugar != null && <>azúcar {g1(ex.sugar)} g</>}</p>}
      {f.gr ? (
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-cream p-1" role="radiogroup" aria-label="Medir por">
          {([["qty", "Porciones"], ["g", gUnit === "ml" ? "Mililitros" : "Gramos"]] as const).map(([m, l]) => (
            <button key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={`tap pressable h-10 rounded-lg text-sm font-bold ${mode === m ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}>{l}</button>
          ))}
        </div>
      ) : null}
      {mode === "qty" ? (
        <div className="mt-2 flex gap-1.5" role="group" aria-label={`Cantidad de ${unit}`}>
          {QTY.map(([l, n]) => <button key={l} onClick={() => { setQty(n); setOther(""); }} aria-pressed={!other && qty === n} className={`tap pressable flex-1 h-11 rounded-xl text-sm font-bold ${!other && qty === n ? "bg-banana text-ink" : "bg-cream text-muted hover:text-ink"}`}>{l}</button>)}
          <label className={`flex-[1.4] flex items-center h-11 rounded-xl px-2 text-sm font-bold ${other ? "bg-banana text-ink" : "bg-cream text-muted"}`}>
            <span className="sr-only">Otra cantidad</span>
            <input value={other} onChange={(e) => setOther(e.target.value.replace(/[^0-9.,]/g, "").slice(0, 5))} inputMode="decimal" placeholder="Otra" aria-label={`Otra cantidad de ${unit}`} className="w-full min-w-0 bg-transparent text-center text-[16px] outline-none placeholder:text-muted" />
          </label>
        </div>
      ) : (
        <div className="mt-2 flex gap-1.5">
          <label className="flex flex-1 items-center gap-1 h-11 rounded-xl border border-line bg-white px-3 focus-within:border-ink">
            <span className="sr-only">Cantidad en {gUnit}</span>
            <input value={grams} onChange={(e) => setGrams(e.target.value.replace(/[^0-9.,]/g, "").slice(0, 5))} inputMode="decimal" className="w-full min-w-0 bg-transparent text-[16px] font-bold text-ink outline-none tabular-nums" aria-label={`Cantidad en ${gUnit}`} />
            <span className="text-sm font-bold text-muted">{gUnit}</span>
          </label>
          {[50, 100, 200].map((g) => <button key={g} onClick={() => setGrams(String(g))} className="tap pressable h-11 px-2.5 rounded-xl bg-cream text-sm font-bold text-muted hover:text-ink tabular-nums">{g}</button>)}
        </div>
      )}
      <div className="mt-2 flex gap-1.5">
        <button disabled={!valid} onClick={() => onAdd(sel)} className="tap pressable flex-1 h-11 rounded-xl bg-ink text-white text-sm font-bold hover:bg-black disabled:opacity-50">Agregar</button>
        {onPlate && <button disabled={!valid} onClick={() => onPlate(sel)} className="tap pressable inline-flex items-center justify-center gap-1.5 h-11 px-3 rounded-xl border border-line bg-white text-sm font-bold text-ink hover:border-ink/40 disabled:opacity-50"><CookingPot weight="duotone" className="size-4.5" />Al plato</button>}
      </div>
      {hint}
    </div>
  );
}

/** Escala un ingrediente (cambia gramos o porciones) manteniendo la proporción de macros. */
export function scaleIng(i: RecipeIng, next: { grams?: number; qty?: number }): RecipeIng {
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const k = next.grams && i.grams ? next.grams / i.grams : next.qty && i.qty ? next.qty / i.qty : 1;
  if (!(k > 0) || k === 1) return i;
  return { ...i, ...(next.grams ? { grams: next.grams, portion: `${n0(next.grams)} g` } : { qty: next.qty! }), kcal: Math.round(i.kcal * k), protein: r1(i.protein * k), carbs: r1(i.carbs * k), fat: r1(i.fat * k) };
}

/** Armar plato o editar una receta: ingredientes, porciones que rinde, totales y por porción en vivo. */
export function PlateBuilder(p: {
  items: RecipeIng[]; setItems: (f: (x: RecipeIng[]) => RecipeIng[]) => void;
  servings: number; setServings: (n: number) => void; name: string; setName: (s: string) => void; autoName: string;
  editing: boolean; slotName: string; busy: boolean;
  onLog: () => void; onSave: () => void; onDelete?: () => void; onAddMore: () => void; onClear: () => void;
}) {
  const tot = useMemo(() => sumIngs(p.items), [p.items]);
  const per = perServing(tot, p.servings);
  const empty = !p.items.length;
  return (
    <div className="space-y-3 animate-enter">
      {empty ? (
        <div className="rounded-2xl border border-dashed border-line p-4 text-center text-sm text-muted">
          <CookingPot weight="duotone" className="mx-auto size-8 text-banana-ink" />
          <p className="mt-1">Busca cada ingrediente y toca <b className="text-ink">Al plato</b>. Por ejemplo: bagel, huevo, queso crema.</p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {p.items.map((i, ix) => (
            <li key={`${i.ref ?? i.name}-${ix}`} className="rounded-2xl bg-white border border-line p-2.5">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink truncate">{i.name}</p>
                  <p className="text-xs text-muted tabular-nums">{ingAmount(i)}, {n0(i.kcal)} kcal</p>
                  <MacroLine pr={i.protein} c={i.carbs} f={i.fat} />
                </div>
                <button onClick={() => p.setItems((x) => x.filter((_, j) => j !== ix))} aria-label={`Quitar ${i.name} del plato`} className="tap pressable -m-1 grid place-items-center size-11 shrink-0 rounded-full text-muted hover:bg-cream hover:text-ink"><X weight="bold" className="size-4" /></button>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                {i.grams ? (
                  <label className="flex items-center gap-1 h-11 w-32 rounded-xl border border-line px-3 focus-within:border-ink">
                    <input defaultValue={String(i.grams)} inputMode="decimal" aria-label={`Gramos de ${i.name}`} className="w-full min-w-0 bg-transparent text-[16px] font-bold text-ink outline-none tabular-nums"
                      onBlur={(e) => { const g = Math.round(Number(e.target.value.replace(",", "."))); if (g > 0 && g <= 3000) p.setItems((x) => x.map((y, j) => (j === ix ? scaleIng(y, { grams: g }) : y))); else e.target.value = String(i.grams); }} />
                    <span className="text-sm font-bold text-muted">g</span>
                  </label>
                ) : (
                  <div className="flex items-center gap-1" role="group" aria-label={`Porciones de ${i.name}`}>
                    <button onClick={() => p.setItems((x) => x.map((y, j) => (j === ix ? scaleIng(y, { qty: Math.max(0.25, y.qty - 0.25) }) : y)))} disabled={i.qty <= 0.25} aria-label="Menos" className="tap pressable grid place-items-center size-11 rounded-xl bg-cream text-ink disabled:opacity-40"><Minus weight="bold" className="size-4" /></button>
                    <span className="w-12 text-center text-sm font-extrabold text-ink tabular-nums">× {i.qty.toLocaleString("es-CO")}</span>
                    <button onClick={() => p.setItems((x) => x.map((y, j) => (j === ix ? scaleIng(y, { qty: Math.min(10, y.qty + 0.25) }) : y)))} disabled={i.qty >= 10} aria-label="Más" className="tap pressable grid place-items-center size-11 rounded-xl bg-cream text-ink disabled:opacity-40"><Plus weight="bold" className="size-4" /></button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <button onClick={p.onAddMore} className="pressable w-full h-11 rounded-2xl border border-dashed border-line text-sm font-bold text-muted hover:border-ink/40 hover:text-ink inline-flex items-center justify-center gap-1.5"><Plus weight="bold" className="size-4" />Agregar ingrediente</button>

      <div className="rounded-2xl bg-cream p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-ink">Porciones que rinde</span>
          <div className="flex items-center gap-1" role="group" aria-label="Porciones que rinde">
            <button onClick={() => p.setServings(Math.max(1, p.servings - 1))} disabled={p.servings <= 1} aria-label="Menos porciones" className="tap pressable grid place-items-center size-11 rounded-xl bg-white text-ink disabled:opacity-40"><Minus weight="bold" className="size-4" /></button>
            <span className="w-8 text-center font-extrabold text-ink tabular-nums" aria-live="polite">{p.servings}</span>
            <button onClick={() => p.setServings(Math.min(RECIPE_MAX_SERVINGS, p.servings + 1))} disabled={p.servings >= RECIPE_MAX_SERVINGS} aria-label="Más porciones" className="tap pressable grid place-items-center size-11 rounded-xl bg-white text-ink disabled:opacity-40"><Plus weight="bold" className="size-4" /></button>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-ink">
          <div className="rounded-xl bg-white p-2.5"><p className="text-[11px] font-bold text-muted">Total</p><p className="text-lg font-extrabold tabular-nums">{n0(tot.kcal)} kcal</p><MacroLine pr={tot.protein} c={tot.carbs} f={tot.fat} /></div>
          <div className="rounded-xl bg-white p-2.5"><p className="text-[11px] font-bold text-muted">Por porción</p><p className="text-lg font-extrabold tabular-nums">{n0(per.kcal)} kcal</p><MacroLine pr={per.protein} c={per.carbs} f={per.fat} /></div>
        </div>
      </div>

      <label className="block text-xs font-bold text-ink">Nombre
        <input value={p.name} onChange={(e) => p.setName(e.target.value.slice(0, 80))} placeholder={p.autoName} maxLength={80} className="input mt-1 h-11" />
      </label>
      <div className="grid gap-1.5">
        <button disabled={empty || p.busy} onClick={p.onLog} className="btn-primary w-full h-12 disabled:opacity-50">Registrar 1 porción en {p.slotName}</button>
        <button disabled={empty || p.busy} onClick={p.onSave} className="btn-ghost w-full h-11 disabled:opacity-50">{p.editing ? "Guardar cambios" : "Guardar en Mis recetas"}</button>
        {p.editing && p.onDelete
          ? <button onClick={p.onDelete} disabled={p.busy} className="tap pressable inline-flex items-center justify-center gap-1.5 h-11 rounded-xl text-sm font-bold text-ember-ink hover:bg-ember/10"><Trash weight="bold" className="size-4" />Eliminar receta</button>
          : !empty && <button onClick={p.onClear} className="tap pressable h-11 rounded-xl text-sm font-bold text-muted hover:text-ink">Vaciar plato</button>}
      </div>
    </div>
  );
}

export type CustomOut = { name: string; portion: string; kcal: number; protein: number; carbs: number; fat: number; save: boolean; saveAs: { portion: string; kcal: number; protein: number; carbs: number; fat: number } };

/**
 * Comida personalizada: calorías y macros por porción, o por 100 g con los gramos que comiste.
 * Si solo pones macros, las calorías se calculan (4/4/9). Se puede guardar en Mis comidas.
 */
export function CustomFoodForm({ defaultName, onSubmit }: { defaultName: string; onSubmit: (c: CustomOut) => void }) {
  const [per100, setPer100] = useState(false);
  const [save, setSave] = useState(true);
  const [v, setV] = useState({ name: defaultName, portion: "", kcal: "", protein: "", carbs: "", fat: "", grams: "100" });
  const num = (s: string) => { const n = Number(s.replace(",", ".")); return Number.isFinite(n) && n >= 0 ? n : 0; };
  const auto = kcalFromMacros(num(v.protein), num(v.carbs), num(v.fat));
  const base = { kcal: v.kcal.trim() ? num(v.kcal) : auto, protein: num(v.protein), carbs: num(v.carbs), fat: num(v.fat) };
  const g = Math.max(1, Math.round(num(v.grams)) || 0);
  const m = per100 ? g / 100 : 1;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const eaten = { kcal: Math.round(base.kcal * m), protein: r1(base.protein * m), carbs: r1(base.carbs * m), fat: r1(base.fat * m) };
  const ok = v.name.trim() && (v.kcal.trim() || auto > 0) && (!per100 || num(v.grams) > 0);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!ok) return; onSubmit({ name: v.name.trim(), portion: per100 ? `${g} g` : v.portion.trim() || "1 porción", ...eaten, save, saveAs: per100 ? { portion: "100 g", ...base, kcal: Math.round(base.kcal) } : { portion: v.portion.trim() || "1 porción", ...eaten } }); }}
      className="rounded-2xl bg-white border border-line p-3 space-y-2 animate-enter">
      <label className="block text-xs font-bold text-ink">Nombre<input value={v.name} onChange={set("name")} required maxLength={80} placeholder="Ej.: sopa de la abuela" className="input mt-1 h-11" /></label>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-cream p-1" role="radiogroup" aria-label="Valores">
        {([[false, "Por porción"], [true, "Por 100 g"]] as const).map(([b, l]) => <button type="button" key={l} role="radio" aria-checked={per100 === b} onClick={() => setPer100(b)} className={`tap pressable h-10 rounded-lg text-sm font-bold ${per100 === b ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}>{l}</button>)}
      </div>
      <div className="flex gap-2">
        <label className="block flex-1 text-xs font-bold text-ink">Calorías{per100 ? " por 100 g" : ""}<input value={v.kcal} onChange={set("kcal")} inputMode="decimal" placeholder={auto ? String(auto) : "350"} className="input mt-1 h-11" /></label>
        {per100
          ? <label className="block flex-1 text-xs font-bold text-ink">Gramos que comiste<input value={v.grams} onChange={set("grams")} inputMode="decimal" className="input mt-1 h-11" /></label>
          : <label className="block flex-1 text-xs font-bold text-ink">Porción<input value={v.portion} onChange={set("portion")} maxLength={40} placeholder="1 plato" className="input mt-1 h-11" /></label>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className="block text-xs font-bold text-ink">Proteína (g)<input value={v.protein} onChange={set("protein")} inputMode="decimal" placeholder="0" className="input mt-1 h-11" /></label>
        <label className="block text-xs font-bold text-ink">Carbos (g)<input value={v.carbs} onChange={set("carbs")} inputMode="decimal" placeholder="0" className="input mt-1 h-11" /></label>
        <label className="block text-xs font-bold text-ink">Grasa (g)<input value={v.fat} onChange={set("fat")} inputMode="decimal" placeholder="0" className="input mt-1 h-11" /></label>
      </div>
      <p className="text-xs text-muted">{!v.kcal.trim() && auto > 0 ? <>Calculamos {n0(auto)} kcal con tus macros. </> : null}{per100 && ok ? <>Comiste {n0(g)} g: {n0(eaten.kcal)} kcal. </> : null}Si solo sabes las calorías, deja los macros vacíos.</p>
      <label className="flex items-center gap-2.5 min-h-11 text-sm font-semibold text-ink cursor-pointer">
        <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} className="size-5 accent-[var(--color-ink)]" />Guardar en Mis comidas para repetirla
      </label>
      <button disabled={!ok} className="btn-primary w-full h-11 disabled:opacity-50">Agregar{ok ? `, ${n0(eaten.kcal)} kcal` : ""}</button>
    </form>
  );
}

/** Aviso amable de opción más ligera en la misma cadena. */
export function BetterHint({ chain, better, onSee }: { chain: string; better: { n: string; k: number; pr: number }; onSee: () => void }) {
  return (
    <p className="mt-2.5 flex items-start gap-2 rounded-xl bg-cream p-2.5 text-xs text-muted">
      <Lightbulb weight="duotone" className="size-4 shrink-0 text-banana-ink" />
      <span className="flex-1">Si te antoja algo más ligero en {chain}: <b className="text-ink">{better.n}</b>, {n0(better.k)} kcal y {n0(better.pr)} g de proteína. Igual, lo que cuenta es registrarlo.</span>
      <button onClick={onSee} className="tap pressable -my-1 shrink-0 rounded-lg px-2 font-bold text-banana-ink hover:bg-white">Ver</button>
    </p>
  );
}

