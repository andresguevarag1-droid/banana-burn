"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { BrandIcon, CheckCircle, Clock, Copy, Egg, MagnifyingGlass, Plus, WarningCircle, X } from "@/components/icons";
import { FOODS, FOOD_GROUPS, FOOD_GROUP_ICON, type Food, type FoodGroup } from "@/lib/foods";
import { SLOTS_MEAL, sumMeals, type MealItem, type Slot } from "@/lib/meals-shared";
import { addMeal, copyMeals, removeMeal } from "@/app/actions/meals";
import { Toast } from "@/components/toast";
import { ProgressBar } from "@/components/progress-bar";
import { useSticky } from "@/components/use-presence";
import { Sheet, SheetTitle } from "@/components/sheet";

type Targets = { kcal: number; protein: number; carbs: number; fat: number };
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const n0 = (n: number) => Math.round(n).toLocaleString("es-419");
const QTY: [string, number][] = [["½", 0.5], ["1", 1], ["1½", 1.5], ["2", 2]];

function defaultSlot(): Slot {
  const h = new Date().getHours();
  return h < 10 ? "desayuno" : h < 14 ? "almuerzo" : h < 18 ? "merienda" : "cena";
}

export function FoodLog({ initial, yesterday, targets, dateKey, demo, quick = { kcal: 0, protein: 0 } }: { initial: MealItem[]; yesterday: MealItem[]; targets: Targets; dateKey: string; demo: boolean; quick?: { kcal: number; protein: number } }) {
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
  const [toast, setToast] = useState<{ ok: boolean; t: string } | null>(null);
  const shownSlot = useSticky(sheet);

  useEffect(() => {
    try {
      if (demo) { const s = localStorage.getItem(key); if (s) setItems(JSON.parse(s)); }
      const r = localStorage.getItem("bb.recentFoods"); if (r) { const arr = JSON.parse(r); setRecent(arr); if (arr.length) setGroup("recent"); }
    } catch { /* */ }
  }, [demo, key]);
  useEffect(() => { if (demo) try { localStorage.setItem(key, JSON.stringify(items)); } catch { /* */ } }, [demo, key, items]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2200); return () => clearTimeout(t); }, [toast]);

  const [fine, setFine] = useState(false);
  useEffect(() => { try { setFine(window.matchMedia("(pointer: fine)").matches); } catch { /* */ } }, []);
  const meal = sumMeals(items);
  // Lo anotado rápido en Hoy (+20 g de proteína, +250 kcal) también cuenta aquí.
  const tot = { ...meal, kcal: meal.kcal + quick.kcal, protein: meal.protein + quick.protein };
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
    setToast({ ok: true, t: `${f.n}, ${temp.kcal} kcal` });
    setPick(null); setQty(1);
    start(async () => {
      const r = await addMeal({ slot, foodId: f.id, qty: n });
      if (r.ok && r.item) setItems((x) => x.map((i) => (i.id === temp.id ? r.item! : i)));
      else { setItems((x) => x.filter((i) => i.id !== temp.id)); setToast({ ok: false, t: "No pudimos guardarlo. Intenta de nuevo." }); }
    });
  }

  function addCustom(fd: FormData) {
    const slot = sheet ?? defaultSlot();
    const name = String(fd.get("name") || "").trim(), kcal = Number(fd.get("kcal")), protein = Number(fd.get("protein") || 0);
    if (!name || !(kcal >= 0)) return;
    const temp: MealItem = { id: `tmp-${Date.now()}`, slot, name, qty: 1, kcal: Math.round(kcal), protein, carbs: 0, fat: 0 };
    setItems((x) => [...x, temp]); setCustom(false); setToast({ ok: true, t: `${name} agregado` });
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
    start(async () => { const r = await copyMeals(src); if (r.ok && r.items) { setItems((x) => [...x, ...r.items!]); setToast({ ok: true, t: `Copiado: ${r.items.length} alimentos de ayer` }); } });
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
        <ProgressBar value={tot.kcal / targets.kcal} className="mt-3 h-3" fill={left >= 0 ? "bg-ink" : "bg-ember"} />
        {(quick.kcal > 0 || quick.protein > 0) && <p className="mt-2 text-xs text-muted">Incluye lo que anotaste rápido en Hoy: {[quick.protein > 0 && `${n0(quick.protein)} g de proteína`, quick.kcal > 0 && `${n0(quick.kcal)} kcal`].filter(Boolean).join(" y ")}.</p>}
        <div className="mt-4 grid grid-cols-3 gap-3">
          {bars.map(([n, v, g, u, c]) => (
            <div key={n}>
              <p className="text-xs font-bold text-muted">{n}</p>
              <p className="text-sm font-extrabold text-ink tabular-nums">{n0(v)}<span className="text-muted font-semibold"> de {n0(g)} {u}</span></p>
              <ProgressBar value={v / g} className="mt-1 h-1.5" fill={c} />
            </div>
          ))}
        </div>
        {targets.protein - tot.protein > 25 && tot.kcal > 0 && <p className="mt-4 flex items-start gap-2.5 rounded-2xl bg-ember/10 p-3 text-sm font-semibold text-ember-ink"><Egg weight="duotone" className="size-5 shrink-0" /><span>Te faltan {n0(targets.protein - tot.protein)} g de proteína: pechuga 150 g (46 g) o yogur griego 200 g (20 g).</span></p>}
      </section>

      {!items.length && yesterday.length > 0 && (
        <button onClick={copyYesterday} className="btn-ghost w-full h-12"><Copy weight="bold" className="size-4" />Copiar lo de ayer: {yesterday.length} alimentos, {n0(sumMeals(yesterday).kcal)} kcal</button>
      )}

      {/* Comidas */}
      {SLOTS_MEAL.map((s) => {
        const its = items.filter((i) => i.slot === s.id);
        const k = its.reduce((a, i) => a + i.kcal, 0);
        return (
          <section key={s.id} className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h2 className="flex items-center gap-2.5 font-extrabold text-ink"><span className="grid place-items-center size-9 shrink-0 rounded-xl bg-banana-soft text-banana-ink"><BrandIcon name={s.icon} className="size-5" /></span>{s.n}</h2>
              <span className="text-sm font-semibold text-muted tabular-nums">{k ? `${n0(k)} kcal` : ""}</span>
            </div>
            {its.length > 0 && (
              <ul className="px-4 divide-y divide-line">
                {its.map((i) => (
                  <li key={i.id} className="py-2.5 flex items-center gap-3 animate-enter">
                    <div className="flex-1 min-w-0"><p className="font-semibold text-ink truncate">{i.name}{i.qty !== 1 && <span className="text-muted"> ×{i.qty.toLocaleString("es-419")}</span>}</p><p className="text-xs text-muted tabular-nums">{n0(i.kcal)} kcal, {n0(i.protein)} g de proteína</p></div>
                    <button onClick={() => remove(i.id)} className="tap pressable grid place-items-center size-8 rounded-full text-faint hover:bg-cream hover:text-ink" aria-label={`Quitar ${i.name}`}><X weight="bold" className="size-4" /></button>
                  </li>
                ))}
              </ul>
            )}
            <button onClick={() => open(s.id)} className="w-full flex items-center gap-2 px-4 py-3 min-h-11 text-sm font-bold text-banana-ink transition-colors hover:bg-cream active:bg-cream focus-visible:outline-offset-[-2px]"><Plus weight="bold" className="size-4" />Agregar a {s.n.split(" ")[0].toLowerCase()}</button>
          </section>
        );
      })}

      {/* Hoja para agregar */}
      <Sheet open={!!sheet} onClose={() => setSheet(null)} className="h-[85dvh] sm:h-[75vh] flex flex-col">
            <div className="px-4 pb-2">
              <SheetTitle className="text-xl font-extrabold text-ink">Agregar a {SLOTS_MEAL.find((s) => s.id === shownSlot)?.n.toLowerCase()}</SheetTitle>
              <label className="mt-3 flex items-center gap-2 h-12 rounded-2xl bg-white border border-line px-3 transition-[border-color,box-shadow] focus-within:border-ink focus-within:ring-4 focus-within:ring-banana/40">
                <MagnifyingGlass weight="bold" className="size-5 text-faint" /><input value={q} onChange={(e) => setQ(e.target.value)} data-autofocus={fine || undefined} placeholder="Busca: pinto, pollo, casado…" className="flex-1 min-w-0 bg-transparent text-[16px] text-ink outline-none" aria-label="Buscar alimento" />
              </label>
              {!q && (
                <div className="mt-3 -mx-4 px-4 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
                  {recent.length > 0 && <button onClick={() => setGroup("recent")} className={`chip h-8 shrink-0 gap-1.5 ${group === "recent" ? "bg-ink text-white" : "bg-white border border-line text-ink"}`}><Clock weight="duotone" className="size-4" />Recientes</button>}
                  {FOOD_GROUPS.map(([g, l]) => <button key={g} onClick={() => setGroup(g)} className={`chip h-8 shrink-0 gap-1.5 ${group === g ? "bg-ink text-white" : "bg-white border border-line text-ink"}`}><BrandIcon name={FOOD_GROUP_ICON[g]} className={`size-4 ${group === g ? "text-banana" : "text-banana-ink"}`} />{l}</button>)}
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
                        <p className="text-xs text-muted tabular-nums">{f.p} × {qty.toLocaleString("es-419")}, {n0(f.pr * qty)} g de proteína</p>
                        <div className="mt-3 flex gap-1.5">
                          {QTY.map(([l, n]) => <button key={l} onClick={() => setQty(n)} className={`tap pressable flex-1 h-10 rounded-xl text-sm font-bold ${qty === n ? "bg-banana text-ink" : "bg-cream text-muted"}`}>{l}</button>)}
                          <button onClick={() => add(f, qty)} className="tap pressable flex-[1.4] h-10 rounded-xl bg-ink text-white text-sm font-bold hover:bg-black">Agregar</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 rounded-2xl bg-white border border-line pr-2 transition-colors hover:border-ink/40">
                        <button onClick={() => { setPick(f); setQty(1); }} className="flex-1 min-w-0 rounded-2xl p-3 text-left focus-visible:outline-offset-[-2px]" aria-label={`${f.n}: elegir porción`}>
                          <p className="font-semibold text-ink truncate">{f.n}</p><p className="text-xs text-muted tabular-nums">{f.p}, {f.k} kcal, {f.pr} g de proteína</p>
                        </button>
                        <button onClick={() => add(f, 1)} aria-label={`Agregar ${f.n}`} className="tap pressable grid place-items-center size-9 shrink-0 rounded-full bg-banana text-ink hover:brightness-95"><Plus weight="bold" className="size-4" /></button>
                      </div>
                    )}
                  </li>
                ))}
                {!list.length && <li className="text-center text-muted py-6">No encontramos “{q}”.</li>}
              </ul>
              {custom ? (
                <form action={addCustom} className="mt-3 rounded-2xl bg-white border border-line p-3 space-y-2">
                  <label className="block text-xs font-bold text-ink">Nombre<input name="name" required placeholder="Pinto de la tía" className="input mt-1 h-11" defaultValue={q} /></label>
                  <div className="flex gap-2">
                    <label className="block flex-1 text-xs font-bold text-ink">Calorías (kcal)<input name="kcal" required inputMode="numeric" placeholder="350" className="input mt-1 h-11" /></label>
                    <label className="block flex-1 text-xs font-bold text-ink">Proteína (g)<input name="protein" inputMode="decimal" placeholder="20" className="input mt-1 h-11" /></label>
                  </div>
                  <button className="btn-primary w-full h-11">Agregar</button>
                </form>
              ) : (
                <button onClick={() => setCustom(true)} className="pressable mt-3 w-full h-11 rounded-2xl border border-dashed border-line text-sm font-bold text-muted hover:border-ink/40 hover:text-ink inline-flex items-center justify-center gap-1.5"><Plus weight="bold" className="size-4" />Alimento personalizado</button>
              )}
              <p className="mt-3 text-center text-[11px] text-faint">Valores aproximados por porción típica.</p>
            </div>
      </Sheet>
      <Toast side="bottom">{toast && <>{toast.ok ? <CheckCircle weight="fill" className="size-5 shrink-0 text-banana" /> : <WarningCircle weight="fill" className="size-5 shrink-0 text-ember" />}<span className="truncate">{toast.t}</span></>}</Toast>
    </div>
  );
}
