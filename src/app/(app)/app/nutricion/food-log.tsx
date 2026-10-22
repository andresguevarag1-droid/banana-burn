"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Copy, Plus, Search, X } from "lucide-react";
import { FOODS, FOOD_GROUPS, type Food, type FoodGroup } from "@/lib/foods";
import { SLOTS_MEAL, sumMeals, type MealItem, type Slot } from "@/lib/meals-shared";
import { addMeal, copyMeals, removeMeal } from "@/app/actions/meals";
import { Portal } from "@/components/portal";

type Targets = { kcal: number; protein: number; carbs: number; fat: number };
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const n0 = (n: number) => Math.round(n).toLocaleString("es-CR");
const QTY: [string, number][] = [["½", 0.5], ["1", 1], ["1½", 1.5], ["2", 2]];

function defaultSlot(): Slot {
  const h = new Date().getHours();
  return h < 10 ? "desayuno" : h < 14 ? "almuerzo" : h < 18 ? "merienda" : "cena";
}

export function FoodLog({ initial, yesterday, targets, dateKey, demo }: { initial: MealItem[]; yesterday: MealItem[]; targets: Targets; dateKey: string; demo: boolean }) {
  const key = `bb.meals.${dateKey}`;
  const [items, setItems] = useState<MealItem[]>(initial);
  const [sheet, setSheet] = useState<Slot | null>(null);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<FoodGroup | "recent">("tica");
  const [pick, setPick] = useState<Food | null>(null);
  const [qty, setQty] = useState(1);
  const [custom, setCustom] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [, start] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (demo) { const s = localStorage.getItem(key); if (s) setItems(JSON.parse(s)); }
      const r = localStorage.getItem("bb.recentFoods"); if (r) { const arr = JSON.parse(r); setRecent(arr); if (arr.length) setGroup("recent"); }
    } catch { /* */ }
  }, [demo, key]);
  useEffect(() => { if (demo) try { localStorage.setItem(key, JSON.stringify(items)); } catch { /* */ } }, [demo, key, items]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2200); return () => clearTimeout(t); }, [toast]);

  const tot = sumMeals(items);
  const left = targets.kcal - tot.kcal;
  const list = useMemo(() => {
    if (q.trim()) return FOODS.filter((f) => norm(f.n).includes(norm(q.trim())));
    if (group === "recent") return recent.map((id) => FOODS.find((f) => f.id === id)).filter(Boolean) as Food[];
    return FOODS.filter((f) => f.g === group);
  }, [q, group, recent]);

  function open(slot: Slot) { setSheet(slot); setQ(""); setPick(null); setQty(1); setCustom(false); }

  function add(f: Food, n: number) {
    const slot = sheet ?? defaultSlot();
    const temp: MealItem = { id: `tmp-${Date.now()}`, slot, name: f.n, qty: n, kcal: Math.round(f.k * n), protein: Math.round(f.pr * n * 10) / 10, carbs: Math.round(f.c * n * 10) / 10, fat: Math.round(f.f * n * 10) / 10 };
    setItems((x) => [...x, temp]);
    const nr = [f.id, ...recent.filter((r) => r !== f.id)].slice(0, 12);
    setRecent(nr); try { localStorage.setItem("bb.recentFoods", JSON.stringify(nr)); } catch { /* */ }
    try { navigator.vibrate?.(20); } catch { /* */ }
    setToast(`✅ ${f.n} · ${temp.kcal} kcal`);
    setPick(null); setQty(1);
    start(async () => {
      const r = await addMeal({ slot, foodId: f.id, qty: n });
      if (r.ok && r.item) setItems((x) => x.map((i) => (i.id === temp.id ? r.item! : i)));
      else { setItems((x) => x.filter((i) => i.id !== temp.id)); setToast("⚠️ No se pudo guardar"); }
    });
  }

  function addCustom(fd: FormData) {
    const slot = sheet ?? defaultSlot();
    const name = String(fd.get("name") || "").trim(), kcal = Number(fd.get("kcal")), protein = Number(fd.get("protein") || 0);
    if (!name || !(kcal >= 0)) return;
    const temp: MealItem = { id: `tmp-${Date.now()}`, slot, name, qty: 1, kcal: Math.round(kcal), protein, carbs: 0, fat: 0 };
    setItems((x) => [...x, temp]); setCustom(false); setToast(`✅ ${name}`);
    start(async () => {
      const r = await addMeal({ slot, custom: { name, kcal, protein } });
      if (r.ok && r.item) setItems((x) => x.map((i) => (i.id === temp.id ? r.item! : i)));
    });
  }

  function remove(id: string) {
    const prev = items;
    setItems((x) => x.filter((i) => i.id !== id));
    start(async () => { const r = await removeMeal(id); if (!r.ok) setItems(prev); });
  }

  function copyYesterday() {
    const src = yesterday.map(({ slot, name, qty, kcal, protein, carbs, fat }) => ({ slot, name, qty, kcal, protein, carbs, fat }));
    start(async () => { const r = await copyMeals(src); if (r.ok && r.items) { setItems((x) => [...x, ...r.items!]); setToast(`📋 Copiado: ${r.items.length} alimentos de ayer`); } });
  }

  const bars: [string, number, number, string, string][] = [
    ["Proteína", tot.protein, targets.protein, "g", "bg-ember"],
    ["Carbos", tot.carbs, targets.carbs, "g", "bg-banana"],
    ["Grasa", tot.fat, targets.fat, "g", "bg-peel"],
  ];

  return (
    <div className="space-y-5">
      {/* Resumen */}
      <section className="card p-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-muted">{left >= 0 ? "Te quedan" : "Te pasaste por"}</p>
            <p className={`text-4xl font-extrabold tracking-tight tabular-nums ${left >= 0 ? "text-ink" : "text-ember-ink"}`}>{n0(Math.abs(left))} <span className="text-lg text-muted">kcal</span></p>
          </div>
          <p className="text-right text-sm text-muted tabular-nums"><b className="text-ink">{n0(tot.kcal)}</b> consumidas<br />de {n0(targets.kcal)} kcal</p>
        </div>
        <div className="mt-3 h-3 rounded-full bg-line overflow-hidden"><div className={`h-full rounded-full transition-all duration-700 ${left >= 0 ? "bg-ink" : "bg-ember"}`} style={{ width: `${Math.min(100, (tot.kcal / targets.kcal) * 100)}%` }} /></div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {bars.map(([n, v, g, u, c]) => (
            <div key={n}>
              <p className="text-xs font-bold text-muted">{n}</p>
              <p className="text-sm font-extrabold text-ink tabular-nums">{n0(v)}<span className="text-faint font-semibold">/{n0(g)} {u}</span></p>
              <div className="mt-1 h-1.5 rounded-full bg-line overflow-hidden"><div className={`h-full ${c} transition-all duration-700`} style={{ width: `${Math.min(100, (v / g) * 100)}%` }} /></div>
            </div>
          ))}
        </div>
        {targets.protein - tot.protein > 25 && tot.kcal > 0 && <p className="mt-4 rounded-2xl bg-ember/10 p-3 text-sm font-semibold text-ember-ink">🥩 Te faltan {n0(targets.protein - tot.protein)} g de proteína: pechuga 150 g (46 g) o yogur griego 200 g (20 g).</p>}
      </section>

      {!items.length && yesterday.length > 0 && (
        <button onClick={copyYesterday} className="btn-ghost w-full h-12"><Copy className="size-4" />Copiar lo de ayer ({yesterday.length} alimentos · {n0(sumMeals(yesterday).kcal)} kcal)</button>
      )}

      {/* Comidas */}
      {SLOTS_MEAL.map((s) => {
        const its = items.filter((i) => i.slot === s.id);
        const k = its.reduce((a, i) => a + i.kcal, 0);
        return (
          <section key={s.id} className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h3 className="font-extrabold text-ink">{s.e} {s.n}</h3>
              <span className="text-sm font-semibold text-muted tabular-nums">{k ? `${n0(k)} kcal` : ""}</span>
            </div>
            {its.length > 0 && (
              <ul className="px-4 divide-y divide-line">
                {its.map((i) => (
                  <li key={i.id} className="py-2.5 flex items-center gap-3 animate-rise">
                    <div className="flex-1 min-w-0"><p className="font-semibold text-ink truncate">{i.name}{i.qty !== 1 && <span className="text-muted"> ×{i.qty.toLocaleString("es-CR")}</span>}</p><p className="text-xs text-muted tabular-nums">{n0(i.kcal)} kcal · {n0(i.protein)} g P</p></div>
                    <button onClick={() => remove(i.id)} className="grid place-items-center size-8 rounded-full text-faint hover:bg-cream hover:text-ink" aria-label={`Quitar ${i.name}`}><X className="size-4" /></button>
                  </li>
                ))}
              </ul>
            )}
            <button onClick={() => open(s.id)} className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold text-banana-ink hover:bg-cream"><Plus className="size-4" strokeWidth={3} />Agregar a {s.n.split(" ")[0].toLowerCase()}</button>
          </section>
        );
      })}

      {/* Hoja para agregar */}
      {sheet && (<Portal>
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-ink/40 backdrop-blur-sm animate-[fade_.2s_both]" onClick={() => setSheet(null)}>
          <div className="w-full sm:max-w-lg h-[85dvh] sm:h-[75vh] flex flex-col rounded-t-[2rem] sm:rounded-[2rem] bg-paper animate-[sheet_.3s_cubic-bezier(.2,.9,.3,1)_both]" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Agregar alimento">
            <div className="p-4 pb-2">
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
              <div className="flex items-center justify-between"><h2 className="text-xl font-extrabold text-ink">Agregar a {SLOTS_MEAL.find((s) => s.id === sheet)?.n.toLowerCase()}</h2><button onClick={() => setSheet(null)} className="grid place-items-center size-9 rounded-full bg-white border border-line" aria-label="Cerrar"><X className="size-4" /></button></div>
              <label className="mt-3 flex items-center gap-2 h-12 rounded-2xl bg-white border border-line px-3 focus-within:border-ink">
                <Search className="size-5 text-faint" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca: pinto, pollo, casado…" className="flex-1 min-w-0 bg-transparent text-[16px] text-ink outline-none" aria-label="Buscar alimento" />
              </label>
              {!q && (
                <div className="mt-3 -mx-4 px-4 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
                  {recent.length > 0 && <button onClick={() => setGroup("recent")} className={`chip h-8 shrink-0 ${group === "recent" ? "bg-ink text-white" : "bg-white border border-line text-ink"}`}>🕑 Recientes</button>}
                  {FOOD_GROUPS.map(([g, l]) => <button key={g} onClick={() => setGroup(g)} className={`chip h-8 shrink-0 ${group === g ? "bg-ink text-white" : "bg-white border border-line text-ink"}`}>{l}</button>)}
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <ul className="space-y-1.5">
                {list.map((f) => (
                  <li key={f.id}>
                    {pick?.id === f.id ? (
                      <div className="rounded-2xl bg-white border-2 border-ink p-3">
                        <div className="flex justify-between gap-2"><p className="font-bold text-ink">{f.n}</p><p className="text-sm font-bold text-ink tabular-nums">{n0(f.k * qty)} kcal</p></div>
                        <p className="text-xs text-muted">{f.p} × {qty.toLocaleString("es-CR")} · {n0(f.pr * qty)} g proteína</p>
                        <div className="mt-3 flex gap-1.5">
                          {QTY.map(([l, n]) => <button key={l} onClick={() => setQty(n)} className={`flex-1 h-10 rounded-xl text-sm font-bold ${qty === n ? "bg-banana text-ink" : "bg-cream text-muted"}`}>{l}</button>)}
                          <button onClick={() => add(f, qty)} className="flex-[1.4] h-10 rounded-xl bg-ink text-white text-sm font-bold">Agregar</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => { setPick(f); setQty(1); }} className="w-full flex items-center gap-3 rounded-2xl bg-white border border-line p-3 text-left hover:border-ink transition">
                        <div className="flex-1 min-w-0"><p className="font-semibold text-ink truncate">{f.n}</p><p className="text-xs text-muted">{f.p} · {f.k} kcal · {f.pr} g P</p></div>
                        <span onClick={(e) => { e.stopPropagation(); add(f, 1); }} role="button" aria-label={`Agregar ${f.n}`} className="grid place-items-center size-9 rounded-full bg-banana text-ink"><Plus className="size-4" strokeWidth={3} /></span>
                      </button>
                    )}
                  </li>
                ))}
                {!list.length && <li className="text-center text-muted py-6">No encontramos “{q}”.</li>}
              </ul>
              {custom ? (
                <form action={addCustom} className="mt-3 rounded-2xl bg-white border border-line p-3 space-y-2">
                  <input name="name" required placeholder="Nombre (ej. Pinto de la tía)" className="input h-11" defaultValue={q} />
                  <div className="flex gap-2"><input name="kcal" required inputMode="numeric" placeholder="kcal" className="input h-11" /><input name="protein" inputMode="decimal" placeholder="proteína g" className="input h-11" /></div>
                  <button className="btn-primary w-full h-11">Agregar</button>
                </form>
              ) : (
                <button onClick={() => setCustom(true)} className="mt-3 w-full h-11 rounded-2xl border border-dashed border-line text-sm font-bold text-muted">+ Alimento personalizado</button>
              )}
              <p className="mt-3 text-center text-[11px] text-faint">Valores aproximados por porción típica.</p>
            </div>
          </div>
        </div>
      </Portal>)}
      {toast && <Portal><div role="status" className="fixed bottom-28 lg:bottom-8 inset-x-0 z-[90] flex justify-center px-4 animate-rise pointer-events-none"><p className="rounded-full bg-ink text-white font-bold px-5 py-3 shadow-lift">{toast}</p></div></Portal>}
    </div>
  );
}
