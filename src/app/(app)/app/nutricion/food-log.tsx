"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { BrandIcon, CheckCircle, Clock, Copy, Egg, Lightbulb, MagnifyingGlass, PencilSimple, Plus, Star, Trash, WarningCircle, X } from "@/components/icons";
import { FOOD_TABS, FOOD_GROUP_ICON, sortForCountry, type Food, type FoodGroup } from "@/lib/foods";
import { CATALOG, CATALOG_BY_ID, chainItems, cleanCustom, mealName, portion, searchFoods, type SavedFood } from "@/lib/foods-catalog";
import { CHAIN_BY_ID, betterChoice, chainsForCountry, type ChainId } from "@/lib/foods-chains";
import { LIBRE } from "@/lib/foods-antojos";
import { overMessage, weeklyBalance } from "@/lib/foods-gamify";
import { MEAL_XP_DAILY_MAX, mealXpFor } from "@/lib/gamify";
import { SLOTS_MEAL, sumMeals, type MealItem, type Slot } from "@/lib/meals-shared";
import { addMeal, copyMeals, deleteSavedFood, removeMeal, saveFood } from "@/app/actions/meals";
import { NutriProgress } from "./nutri-progress";
import { Toast } from "@/components/toast";
import { ProgressBar } from "@/components/progress-bar";
import { useSticky } from "@/components/use-presence";
import { Sheet, SheetTitle } from "@/components/sheet";

type Targets = { kcal: number; protein: number; carbs: number; fat: number };
type Extras = { week: { day: string; kcal: number }[]; mealDays: string[]; xpToday: number; saved: SavedFood[] };
const n0 = (n: number) => Math.round(n).toLocaleString("es-419");
const QTY: [string, number][] = [["½", 0.5], ["1", 1], ["1½", 1.5], ["2", 2], ["3", 3]];
const MY = "my-";
/** "Mis comidas" como alimento del buscador (id con prefijo para distinguirlas del catálogo). */
const savedAsFood = (s: SavedFood): Food => ({ id: MY + s.id, n: s.name, p: s.portion, k: s.kcal, pr: s.protein, c: s.carbs, f: s.fat, g: "extra" });

function defaultSlot(): Slot {
  const h = new Date().getHours();
  return h < 10 ? "desayuno" : h < 14 ? "almuerzo" : h < 18 ? "merienda" : "cena";
}

type Note = { ok: boolean; t: string; undo?: () => void };
const scaled = (i: MealItem, q: number): MealItem => {
  const k = q / (i.qty || 1), r1 = (n: number) => Math.round(n * k * 10) / 10;
  return { ...i, qty: q, kcal: Math.round(i.kcal * k), protein: r1(i.protein), carbs: r1(i.carbs), fat: r1(i.fat) };
};
const row = ({ slot, name, qty, kcal, protein, carbs, fat }: MealItem) => ({ slot, name, qty, kcal, protein, carbs, fat });

const EMPTY_EXTRAS: Extras = { week: [], mealDays: [], xpToday: 0, saved: [] };

export function FoodLog({ initial, yesterday, targets, dateKey, demo, country = null, quick: quick0 = { kcal: 0, protein: 0 }, extras = EMPTY_EXTRAS }: { initial: MealItem[]; yesterday: MealItem[]; targets: Targets; dateKey: string; demo: boolean; country?: string | null; quick?: { kcal: number; protein: number }; extras?: Extras }) {
  const key = `bb.meals.${dateKey}`;
  const [items, setItems] = useState<MealItem[]>(initial);
  const [sheet, setSheet] = useState<Slot | null>(null);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<FoodGroup | "recent" | "mine">("tica");
  const [chain, setChain] = useState<ChainId | null>(null);
  const [saved, setSaved] = useState<SavedFood[]>(extras.saved);
  const [xpCount, setXpCount] = useState(extras.xpToday);
  const [saveIt, setSaveIt] = useState(true);
  const chains = useMemo(() => chainsForCountry(country), [country]);
  const [pick, setPick] = useState<Food | null>(null);
  const [qty, setQty] = useState(1);
  const [custom, setCustom] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [, start] = useTransition();
  const [toast, setToast] = useState<Note | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [quick, setQuick] = useState(quick0);
  const shownSlot = useSticky(sheet);

  useEffect(() => {
    try {
      if (demo) {
        const s = localStorage.getItem(key); if (s) setItems(JSON.parse(s));
        // Lo anotado rápido en Hoy (demo) vive en este navegador.
        const d = localStorage.getItem(`bb.daily.${dateKey}`); if (d) { const l = JSON.parse(d); setQuick({ kcal: Number(l.kcal) || 0, protein: Number(l.protein) || 0 }); }
      }
      if (demo) {
        const m = localStorage.getItem("bb.myFoods"); if (m) setSaved(JSON.parse(m));
        const x = localStorage.getItem(`bb.mealXp.${dateKey}`); if (x) setXpCount(Number(x) || 0);
      }
      const r = localStorage.getItem("bb.recentFoods"); if (r) { const arr = (JSON.parse(r) as string[]).filter((id) => CATALOG_BY_ID[id]); setRecent(arr); if (arr.length) setGroup("recent"); }
    } catch { /* */ }
  }, [demo, key, dateKey]);
  useEffect(() => { if (demo) try { localStorage.setItem("bb.myFoods", JSON.stringify(saved)); localStorage.setItem(`bb.mealXp.${dateKey}`, String(xpCount)); } catch { /* */ } }, [demo, saved, xpCount, dateKey]);
  useEffect(() => { if (demo) try { localStorage.setItem(key, JSON.stringify(items)); } catch { /* */ } }, [demo, key, items]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), toast.undo ? 5000 : 2200); return () => clearTimeout(t); }, [toast]);

  const [fine, setFine] = useState(false);
  useEffect(() => { try { setFine(window.matchMedia("(pointer: fine)").matches); } catch { /* */ } }, []);
  const meal = sumMeals(items);
  // Lo anotado rápido en Hoy (+20 g de proteína, +250 kcal) también cuenta aquí.
  const tot = { ...meal, kcal: meal.kcal + quick.kcal, protein: meal.protein + quick.protein };
  const left = targets.kcal - tot.kcal;
  const weekDiff = useMemo(() => weeklyBalance([...extras.week, { day: dateKey, kcal: tot.kcal }], targets.kcal, dateKey).diff, [extras.week, dateKey, tot.kcal, targets.kcal]);
  const over = overMessage(-left, extras.week.length ? weekDiff : undefined);
  const mine = useMemo(() => saved.map(savedAsFood), [saved]);
  // Al elegir un alimento, su panel de porción queda a la vista (sin animar el scroll si se pide menos movimiento).
  useEffect(() => {
    if (!pick) return;
    const el = document.getElementById(`pick-${pick.id}`);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [pick]);
  const list = useMemo(() => {
    if (q.trim()) return searchFoods(q, country, [...mine, ...CATALOG]);
    if (group === "recent") return recent.map((id) => CATALOG_BY_ID[id]).filter(Boolean);
    if (group === "mine") return mine;
    if (group === "resto") return chainItems(chain, chains.map((c) => c.id));
    return sortForCountry(CATALOG.filter((f) => f.g === group), country);
  }, [q, group, recent, country, chain, chains, mine]);

  function open(slot: Slot) { setSheet(slot); setQ(""); setPick(null); setQty(1); setCustom(false); }

  /** Guarda en el servidor; el XP se predice (tope diario) y se corrige con lo que diga el servidor. */
  function commit(temp: MealItem, label: string, req: Parameters<typeof addMeal>[0]) {
    const xp = mealXpFor(xpCount);
    setItems((x) => [...x, temp]);
    if (xp) setXpCount((c) => c + 1);
    try { navigator.vibrate?.(20); } catch { /* */ }
    setToast({ ok: true, t: xp ? `${label}, ${n0(temp.kcal)} kcal. +${xp} XP` : `${label}, ${n0(temp.kcal)} kcal. Registrado` });
    start(async () => {
      const r = await addMeal(req);
      if (r.ok && r.item) {
        setItems((x) => x.map((i) => (i.id === temp.id ? r.item! : i)));
        if (!demo && typeof r.xpCount === "number") setXpCount(Math.min(MEAL_XP_DAILY_MAX, r.xpCount));
      } else {
        setItems((x) => x.filter((i) => i.id !== temp.id));
        if (xp) setXpCount((c) => Math.max(0, c - 1));
        setToast({ ok: false, t: "No pudimos guardarlo. Intenta de nuevo." });
      }
    });
  }

  function add(f: Food, n: number) {
    const slot = sheet ?? defaultSlot();
    const p = portion(f, n);
    const isMine = f.id.startsWith(MY);
    const temp: MealItem = { id: `tmp-${Date.now()}`, slot, name: isMine ? f.n : mealName(f), ...p };
    if (!isMine && CATALOG_BY_ID[f.id] && !f.id.startsWith("libre-")) {
      const nr = [f.id, ...recent.filter((r) => r !== f.id)].slice(0, 12);
      setRecent(nr); try { localStorage.setItem("bb.recentFoods", JSON.stringify(nr)); } catch { /* */ }
    }
    setPick(null); setQty(1);
    commit(temp, f.n, isMine ? { slot, qty: n, custom: { name: f.n, kcal: f.k, protein: f.pr, carbs: f.c, fat: f.f, portion: f.p } } : { slot, foodId: f.id, qty: n });
  }

  function addCustom(fd: FormData) {
    const slot = sheet ?? defaultSlot();
    const c = cleanCustom({ name: fd.get("name"), portion: fd.get("portion"), kcal: fd.get("kcal"), protein: fd.get("protein"), carbs: fd.get("carbs"), fat: fd.get("fat") });
    if (!c || !String(fd.get("kcal") ?? "").trim()) return;
    const temp: MealItem = { id: `tmp-${Date.now()}`, slot, name: c.name, qty: 1, kcal: c.kcal, protein: c.protein, carbs: c.carbs, fat: c.fat };
    setCustom(false);
    commit(temp, c.name, { slot, custom: c });
    if (saveIt && !saved.some((s) => s.name.toLowerCase() === c.name.toLowerCase())) {
      const tmp: SavedFood = { ...c, id: `tmp-${Date.now()}` };
      setSaved((x) => [tmp, ...x]);
      start(async () => {
        const r = await saveFood(c);
        if (r.ok && r.food) setSaved((x) => x.map((s) => (s.id === tmp.id ? r.food! : s)));
        else setSaved((x) => x.filter((s) => s.id !== tmp.id));
      });
    }
  }

  function forget(f: Food) {
    const id = f.id.slice(MY.length);
    const prev = saved;
    setSaved((x) => x.filter((s) => s.id !== id));
    setToast({ ok: true, t: `Quitaste ${f.n} de Mis comidas` });
    start(async () => { const r = await deleteSavedFood(id); if (!r.ok) setSaved(prev); });
  }

  /** Vuelve a guardar un alimento borrado (nuevo id) en su mismo lugar de la lista. */
  function restore(item: MealItem, at: number) {
    const temp = { ...item, id: `tmp-${Date.now()}` };
    setItems((x) => [...x.slice(0, at), temp, ...x.slice(at)]);
    setToast(null);
    start(async () => {
      const r = await copyMeals([row(item)]);
      if (r.ok && r.items?.[0]) setItems((x) => x.map((i) => (i.id === temp.id ? r.items![0] : i)));
      else { setItems((x) => x.filter((i) => i.id !== temp.id)); setToast({ ok: false, t: "No pudimos recuperarlo. Agrégalo de nuevo." }); }
    });
  }

  function remove(item: MealItem) {
    const at = items.findIndex((i) => i.id === item.id);
    setItems((x) => x.filter((i) => i.id !== item.id));
    setEditing(null);
    setToast({ ok: true, t: `Quitaste ${item.name}`, undo: () => restore(item, at) });
    start(async () => {
      const r = await removeMeal(item.id);
      if (!r.ok) { setItems((x) => [...x.slice(0, at), item, ...x.slice(at)]); setToast({ ok: false, t: "No pudimos quitarlo. Intenta de nuevo." }); }
    });
  }

  /** Cambiar la porción: guarda el alimento con la nueva cantidad y borra el anterior. */
  function changeQty(item: MealItem, qn: number) {
    if (qn === item.qty) return;
    const next = scaled(item, qn);
    setItems((x) => x.map((i) => (i.id === item.id ? next : i)));
    start(async () => {
      const r = await copyMeals([row(next)]);
      const created = r.ok ? r.items?.[0] : undefined;
      if (!created) { setItems((x) => x.map((i) => (i.id === item.id ? item : i))); setToast({ ok: false, t: "No pudimos cambiar la porción. Intenta de nuevo." }); return; }
      const del = await removeMeal(item.id);
      if (!del.ok) { await removeMeal(created.id); setItems((x) => x.map((i) => (i.id === item.id ? item : i))); setToast({ ok: false, t: "No pudimos cambiar la porción. Intenta de nuevo." }); return; }
      setItems((x) => x.map((i) => (i.id === item.id ? created : i)));
      setEditing((e) => (e === item.id ? created.id : e));
    });
  }

  function copyYesterday() {
    start(async () => {
      const r = await copyMeals(yesterday.map(row));
      if (r.ok && r.items) { setItems((x) => [...x, ...r.items!]); setToast({ ok: true, t: `Copiado: ${r.items.length} alimentos de ayer` }); }
      else setToast({ ok: false, t: "No pudimos copiar lo de ayer. Intenta de nuevo." });
    });
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
            <p className="text-sm font-semibold text-muted">{left >= 0 ? "Te quedan" : "Por encima de tu meta"}</p>
            <p className="text-4xl font-extrabold tracking-tight tabular-nums text-ink">{left < 0 && "+"}{n0(Math.abs(left))} <span className="text-lg text-muted">kcal</span></p>
          </div>
          <p className="text-right text-sm text-muted tabular-nums"><b className="text-ink">{n0(tot.kcal)}</b> consumidas<br />de {n0(targets.kcal)} kcal</p>
        </div>
        <ProgressBar value={tot.kcal / targets.kcal} className="mt-3 h-3" fill={left >= 0 ? "bg-ink" : "bg-banana"} />
        {over && <p className="mt-3 flex items-start gap-2.5 rounded-2xl bg-banana-soft p-3 text-sm font-semibold text-ink"><Lightbulb weight="duotone" className="size-5 shrink-0 text-banana-ink" /><span>{over}</span></p>}
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

      <NutriProgress today={dateKey} todayKcal={tot.kcal} hasToday={items.length > 0} xpCount={xpCount} mealDays={extras.mealDays} week={extras.week} targetKcal={targets.kcal} />

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
                {its.map((i) => {
                  const open = editing === i.id, saving = i.id.startsWith("tmp-");
                  return (
                    <li key={i.id} className="py-1 animate-enter">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setEditing(open ? null : i.id)} disabled={saving} aria-expanded={open} className="pressable flex-1 min-w-0 min-h-11 rounded-xl -ml-2 px-2 py-1.5 text-left transition-colors hover:bg-cream disabled:opacity-60" aria-label={`${i.name}: cambiar porción`}>
                          <p className="flex items-center gap-1.5 font-semibold text-ink"><span className="truncate">{i.name}{i.qty !== 1 && <span className="text-muted"> ×{i.qty.toLocaleString("es-419")}</span>}</span><PencilSimple weight="bold" aria-hidden className="size-3.5 shrink-0 text-faint" /></p>
                          <p className="text-xs text-muted tabular-nums">{n0(i.kcal)} kcal, {n0(i.protein)} g de proteína</p>
                        </button>
                        <button onClick={() => remove(i)} disabled={saving} className="tap pressable grid place-items-center size-11 shrink-0 rounded-full text-muted hover:bg-cream hover:text-ink disabled:opacity-60" aria-label={`Quitar ${i.name}`}><X weight="bold" className="size-4" /></button>
                      </div>
                      {open && (
                        <div className="mt-1 mb-2 flex items-center gap-1.5 animate-enter" role="group" aria-label={`Porción de ${i.name}`}>
                          <span className="text-xs font-bold text-muted mr-1">Porción</span>
                          {QTY.map(([l, n]) => <button key={l} onClick={() => changeQty(i, n)} aria-pressed={i.qty === n} className={`tap pressable flex-1 h-10 rounded-xl text-sm font-bold ${i.qty === n ? "bg-banana text-ink" : "bg-cream text-muted hover:text-ink"}`}>{l}</button>)}
                        </div>
                      )}
                    </li>
                  );
                })}
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
                <MagnifyingGlass weight="bold" className="size-5 text-faint" /><input value={q} onChange={(e) => setQ(e.target.value)} data-autofocus={fine || undefined} placeholder="Busca: pollo, big mac, kfc, pizza…" className="flex-1 min-w-0 bg-transparent text-[16px] text-ink outline-none" aria-label="Buscar alimento o restaurante" />
                {q && <button onClick={() => setQ("")} className="tap pressable -mr-2 grid place-items-center size-11 shrink-0 rounded-full text-muted hover:text-ink" aria-label="Borrar búsqueda"><X weight="bold" className="size-4" /></button>}
              </label>
              {!q && (
                <div className="mt-3 -mx-4 px-4 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" role="group" aria-label="Grupos de alimentos">
                  {recent.length > 0 && <button onClick={() => setGroup("recent")} aria-pressed={group === "recent"} className={`chip h-8 shrink-0 gap-1.5 ${group === "recent" ? "bg-ink text-white" : "bg-white border border-line text-ink"}`}><Clock weight="duotone" className="size-4" />Recientes</button>}
                  <button onClick={() => setGroup("mine")} aria-pressed={group === "mine"} className={`chip h-8 shrink-0 gap-1.5 ${group === "mine" ? "bg-ink text-white" : "bg-white border border-line text-ink"}`}><Star weight="duotone" className={`size-4 ${group === "mine" ? "text-banana" : "text-banana-ink"}`} />Mis comidas</button>
                  {FOOD_TABS.map(([g, l]) => <button key={g} onClick={() => setGroup(g)} aria-pressed={group === g} className={`chip h-8 shrink-0 gap-1.5 ${group === g ? "bg-ink text-white" : "bg-white border border-line text-ink"}`}><BrandIcon name={FOOD_GROUP_ICON[g]} className={`size-4 ${group === g ? "text-banana" : "text-banana-ink"}`} />{l}</button>)}
                </div>
              )}
              {!q && group === "resto" && (
                <div className="mt-1.5 -mx-4 px-4 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" role="group" aria-label="Cadenas">
                  <button onClick={() => setChain(null)} aria-pressed={chain === null} className={`chip h-8 shrink-0 ${chain === null ? "bg-banana text-ink" : "bg-cream text-muted hover:text-ink"}`}>Todas</button>
                  {chains.map((c) => <button key={c.id} onClick={() => setChain(c.id)} aria-pressed={chain === c.id} className={`chip h-8 shrink-0 ${chain === c.id ? "bg-banana text-ink" : "bg-cream text-muted hover:text-ink"}`}>{c.n}</button>)}
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {!q && (
                <div className="mb-3 rounded-2xl bg-banana-soft p-3">
                  <p className="text-sm font-bold text-ink">Comida libre</p>
                  <p className="text-xs text-ink/70">¿No sabes exactamente qué comiste? Elige el tamaño y listo.</p>
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {LIBRE.map((f) => (
                      <button key={f.id} onClick={() => add(f, 1)} className="tap pressable min-h-14 rounded-xl bg-white px-2 py-1.5 text-center hover:shadow-lift" aria-label={`${f.n}, unas ${n0(f.k)} kcal`}>
                        <span className="block text-sm font-extrabold text-ink capitalize">{f.size}</span>
                        <span className="block text-[11px] font-semibold text-muted tabular-nums">~{n0(f.k)} kcal</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <ul className="space-y-1.5">
                {list.map((f) => {
                  const cad = f.cad ? CHAIN_BY_ID[f.cad as ChainId]?.n : null;
                  const isMine = f.id.startsWith(MY);
                  const better = pick?.id === f.id ? betterChoice({ id: f.id, cadena: f.cad, k: f.k * qty, best: f.best }) : null;
                  return (
                  <li key={f.id}>
                    {pick?.id === f.id ? (
                      <div id={`pick-${f.id}`} className="rounded-2xl bg-white border-2 border-ink p-3 scroll-my-3">
                        <div className="flex justify-between gap-2"><p className="font-bold text-ink">{f.n}</p><p className="text-sm font-bold text-ink tabular-nums">{n0(f.k * qty)} kcal</p></div>
                        <p className="text-xs text-muted tabular-nums">{cad ? `${cad}, ` : ""}{f.p} × {qty.toLocaleString("es-419")}, {n0(f.pr * qty)} g de proteína</p>
                        <div className="mt-3 flex gap-1.5" role="group" aria-label="Porciones">
                          {QTY.map(([l, n]) => <button key={l} onClick={() => setQty(n)} aria-pressed={qty === n} className={`tap pressable flex-1 h-11 rounded-xl text-sm font-bold ${qty === n ? "bg-banana text-ink" : "bg-cream text-muted"}`}>{l}</button>)}
                        </div>
                        <button onClick={() => add(f, qty)} className="tap pressable mt-1.5 w-full h-11 rounded-xl bg-ink text-white text-sm font-bold hover:bg-black">Agregar</button>
                        {better && (
                          <p className="mt-2.5 flex items-start gap-2 rounded-xl bg-cream p-2.5 text-xs text-muted">
                            <Lightbulb weight="duotone" className="size-4 shrink-0 text-banana-ink" />
                            <span className="flex-1">Si te antoja algo más ligero en {cad}: <b className="text-ink">{better.n}</b>, {n0(better.k)} kcal y {n0(better.pr)} g de proteína. Igual, lo que cuenta es registrarlo.</span>
                            <button onClick={() => { const b = CATALOG_BY_ID[better.id]; if (b) { setPick(b); setQty(1); } }} className="tap pressable -my-1 shrink-0 rounded-lg px-2 font-bold text-banana-ink hover:bg-white">Ver</button>
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 rounded-2xl bg-white border border-line pr-1.5 transition-colors hover:border-ink/40">
                        <button onClick={() => { setPick(f); setQty(1); }} className="flex-1 min-w-0 rounded-2xl p-3 text-left focus-visible:outline-offset-[-2px]" aria-label={`${f.n}${cad ? ` de ${cad}` : ""}: elegir porción`}>
                          <p className="font-semibold text-ink truncate">{f.n}</p>
                          <p className="text-xs text-muted tabular-nums truncate">{cad && <span className="font-bold text-ink/70">{cad}, </span>}{f.p}, {n0(f.k)} kcal, {n0(f.pr)} g de proteína</p>
                        </button>
                        {isMine && <button onClick={() => forget(f)} aria-label={`Quitar ${f.n} de Mis comidas`} className="tap pressable grid place-items-center size-11 shrink-0 rounded-full text-muted hover:bg-cream hover:text-ink"><Trash weight="bold" className="size-4" /></button>}
                        <button onClick={() => add(f, 1)} aria-label={`Agregar ${f.n}`} className="tap pressable grid place-items-center size-11 shrink-0 rounded-full"><span className="grid place-items-center size-9 rounded-full bg-banana text-ink"><Plus weight="bold" className="size-4" /></span></button>
                      </div>
                    )}
                  </li>
                  );
                })}
                {!list.length && (
                  <li className="text-center text-muted py-6 text-sm">
                    {q ? `No encontramos “${q}”. Usa Comida libre o agrégala como personalizada.` : group === "mine" ? "Aquí quedan las comidas personalizadas que guardes para repetirlas en un toque." : "Nada por aquí todavía."}
                  </li>
                )}
              </ul>
              {custom ? (
                <form action={addCustom} className="mt-3 rounded-2xl bg-white border border-line p-3 space-y-2">
                  <label className="block text-xs font-bold text-ink">Nombre<input name="name" required maxLength={80} placeholder="Ej.: sopa de la abuela" className="input mt-1 h-11" defaultValue={q} /></label>
                  <div className="flex gap-2">
                    <label className="block flex-1 text-xs font-bold text-ink">Calorías (kcal)<input name="kcal" required inputMode="numeric" placeholder="350" className="input mt-1 h-11" /></label>
                    <label className="block flex-1 text-xs font-bold text-ink">Porción<input name="portion" maxLength={40} placeholder="1 plato" className="input mt-1 h-11" /></label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="block text-xs font-bold text-ink">Proteína (g)<input name="protein" inputMode="decimal" placeholder="20" className="input mt-1 h-11" /></label>
                    <label className="block text-xs font-bold text-ink">Carbos (g)<input name="carbs" inputMode="decimal" placeholder="40" className="input mt-1 h-11" /></label>
                    <label className="block text-xs font-bold text-ink">Grasa (g)<input name="fat" inputMode="decimal" placeholder="10" className="input mt-1 h-11" /></label>
                  </div>
                  <label className="flex items-center gap-2.5 min-h-11 text-sm font-semibold text-ink cursor-pointer">
                    <input type="checkbox" checked={saveIt} onChange={(e) => setSaveIt(e.target.checked)} className="size-5 accent-[var(--color-ink)]" />Guardar en Mis comidas para repetirla
                  </label>
                  <button className="btn-primary w-full h-11">Agregar</button>
                </form>
              ) : (
                <button onClick={() => setCustom(true)} className="pressable mt-3 w-full h-11 rounded-2xl border border-dashed border-line text-sm font-bold text-muted hover:border-ink/40 hover:text-ink inline-flex items-center justify-center gap-1.5"><Plus weight="bold" className="size-4" />Comida personalizada</button>
              )}
              <p className="mt-3 text-center text-[11px] text-faint">
                {!q && group === "resto"
                  ? <>Datos de la cadena, pueden variar por país. {chain ? CHAIN_BY_ID[chain].fuente : "Cada producto indica su cadena."}</>
                  : "Valores aproximados por porción típica. Los de restaurantes son datos de la cadena y pueden variar por país."}
              </p>
            </div>
      </Sheet>
      <Toast side="bottom" className="[&_button]:pointer-events-auto">{toast && <>{toast.ok ? <CheckCircle weight="fill" className="size-5 shrink-0 text-banana" /> : <WarningCircle weight="fill" className="size-5 shrink-0 text-ember" />}<span className="truncate">{toast.t}</span>{toast.undo && <button onClick={toast.undo} className="tap pressable -my-2 -mr-2 ml-1 h-9 shrink-0 rounded-full bg-white/15 px-3 text-sm font-extrabold text-banana hover:bg-white/25">Deshacer</button>}</>}</Toast>
    </div>
  );
}
