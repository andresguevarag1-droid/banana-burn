"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, BrandIcon, CaretDown, CheckCircle, Clock, CookingPot, Copy, Egg, Lightbulb, MagnifyingGlass, PencilSimple, Plus, Star, Trash, WarningCircle, X } from "@/components/icons";
import { FOOD_CATS, FOOD_CAT_LABEL, type Food, type FoodCat } from "@/lib/foods";
import { CATALOG, CATALOG_BY_ID, catItems, chainItems, gramsOf, groupHits, mealName, searchScored, type SavedFood } from "@/lib/foods-catalog";
import { CHAIN_BY_ID, betterChoice, chainsForCountry, type ChainId } from "@/lib/foods-chains";
import { LIBRE } from "@/lib/foods-antojos";
import { overMessage, weeklyBalance } from "@/lib/foods-gamify";
import { MEAL_XP_DAILY_MAX, mealXpFor } from "@/lib/gamify";
import { SLOTS_MEAL, sumMeals, type MealItem, type Slot } from "@/lib/meals-shared";
import { ingFrom, perServing, plateName, RC, recipeAsFood, sumIngs, type RecipeIng, type UserRecipe } from "@/lib/user-recipes";
import { addMeal, copyMeals, deleteRecipe, deleteSavedFood, removeMeal, saveFood, saveRecipe } from "@/app/actions/meals";
import { NutriProgress } from "./nutri-progress";
import { BetterHint, calcSel, CustomFoodForm, FoodRow, n0, PickPanel, PlateBuilder, type CustomOut, type Sel } from "./food-parts";
import { Toast } from "@/components/toast";
import { ProgressBar } from "@/components/progress-bar";
import { useSticky } from "@/components/use-presence";
import { Sheet, SheetTitle } from "@/components/sheet";
import { safeAction } from "@/lib/action-client";

type Targets = { kcal: number; protein: number; carbs: number; fat: number };
type Extras = { week: { day: string; kcal: number }[]; mealDays: string[]; xpToday: number; saved: SavedFood[]; recipes?: UserRecipe[] };
const QTY: [string, number][] = [["½", 0.5], ["1", 1], ["1½", 1.5], ["2", 2], ["3", 3]];
const MY = "my-";
const PAGE = 30;
/** "Mis comidas" como alimento del buscador (id con prefijo). Si la porción dice gramos, se puede registrar por peso. */
const savedAsFood = (s: SavedFood): Food => { const gr = gramsOf(s.portion); return { id: MY + s.id, n: s.name, p: s.portion, k: s.kcal, pr: s.protein, c: s.carbs, f: s.fat, g: "extra", ...(gr ? { gr } : {}) }; };

type Tab = FoodCat | "recent" | "mine" | "recetas";
type View = "list" | "plate" | "custom";
/** Plato en armado: ingredientes, porciones que rinde, nombre y, si se edita una receta guardada, su id. */
type Plate = { items: RecipeIng[]; servings: number; name: string; editId: string | null };
const EMPTY_PLATE: Plate = { items: [], servings: 1, name: "", editId: null };

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

const EMPTY_EXTRAS: Extras = { week: [], mealDays: [], xpToday: 0, saved: [], recipes: [] };
const groupLabel = (k: string) => (k === "top" ? "Mejores resultados" : k === "mis-recetas" ? "Mis recetas" : k === "mis-comidas" ? "Mis comidas" : FOOD_CAT_LABEL[k as FoodCat] ?? "Otros");

export function FoodLog({ initial, yesterday, targets, dateKey, demo, country = null, quick: quick0 = { kcal: 0, protein: 0 }, extras = EMPTY_EXTRAS }: { initial: MealItem[]; yesterday: MealItem[]; targets: Targets; dateKey: string; demo: boolean; country?: string | null; quick?: { kcal: number; protein: number }; extras?: Extras }) {
  const key = `bb.meals.${dateKey}`;
  const [items, setItems] = useState<MealItem[]>(initial);
  const [sheet, setSheet] = useState<Slot | null>(null);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("platos");
  const [chain, setChain] = useState<ChainId | null>(null);
  const [saved, setSaved] = useState<SavedFood[]>(extras.saved);
  const [recipes, setRecipes] = useState<UserRecipe[]>(extras.recipes ?? []);
  const [xpCount, setXpCount] = useState(extras.xpToday);
  const chains = useMemo(() => chainsForCountry(country), [country]);
  const [pick, setPick] = useState<Food | null>(null);
  const [view, setView] = useState<View>("list");
  const [plate, setPlate] = useState<Plate>(EMPTY_PLATE);
  const [shown, setShown] = useState(PAGE);
  const [recent, setRecent] = useState<string[]>([]);
  const [busy, start] = useTransition();
  const [toast, setToast] = useState<Note | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [quick, setQuick] = useState(quick0);
  const [wantRecipe, setWantRecipe] = useState<string | null>(null);
  const shownSlot = useSticky(sheet);
  const slotName = (SLOTS_MEAL.find((s) => s.id === (sheet ?? shownSlot))?.n ?? "").split(" ")[0].toLowerCase();

  useEffect(() => {
    try {
      if (demo) {
        const s = localStorage.getItem(key); if (s) setItems(JSON.parse(s));
        // Lo anotado rápido en Hoy (demo) vive en este navegador.
        const d = localStorage.getItem(`bb.daily.${dateKey}`); if (d) { const l = JSON.parse(d); setQuick({ kcal: Number(l.kcal) || 0, protein: Number(l.protein) || 0 }); }
        const m = localStorage.getItem("bb.myFoods"); if (m) setSaved(JSON.parse(m));
        const rc = localStorage.getItem("bb.myRecipes"); if (rc) setRecipes(JSON.parse(rc));
        const x = localStorage.getItem(`bb.mealXp.${dateKey}`); if (x) setXpCount(Number(x) || 0);
      }
      const r = localStorage.getItem("bb.recentFoods"); if (r) { const arr = (JSON.parse(r) as string[]).filter((id) => CATALOG_BY_ID[id]); setRecent(arr); }
    } catch { /* */ }
    // Enlaces desde Recetas: ?receta=<id> abre la receta para editarla; ?nueva-receta=1 abre "Armar plato".
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.has("nueva-receta") || sp.has("receta") || sp.has("mis-recetas")) {
        setSheet(defaultSlot());
        if (sp.get("receta")) setWantRecipe(sp.get("receta"));
        if (sp.has("mis-recetas")) setTab("recetas");
        else if (sp.has("nueva-receta")) { setPlate(EMPTY_PLATE); setView("plate"); }
        window.history.replaceState(null, "", window.location.pathname);
      }
    } catch { /* */ }
  }, [demo, key, dateKey]);
  useEffect(() => { if (demo) try { localStorage.setItem("bb.myFoods", JSON.stringify(saved)); localStorage.setItem("bb.myRecipes", JSON.stringify(recipes)); localStorage.setItem(`bb.mealXp.${dateKey}`, String(xpCount)); } catch { /* */ } }, [demo, saved, recipes, xpCount, dateKey]);
  useEffect(() => { if (demo) try { localStorage.setItem(key, JSON.stringify(items)); } catch { /* */ } }, [demo, key, items]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), toast.undo ? 5000 : 2200); return () => clearTimeout(t); }, [toast]);
  // ?receta=<id>: cuando ya cargaron las recetas (en la demo vienen del navegador), abre esa para editar.
  useEffect(() => {
    if (!wantRecipe) return;
    const r = recipes.find((x) => x.id === wantRecipe);
    if (r) { setPlate({ items: r.items, servings: r.servings, name: r.name, editId: r.id }); setView("plate"); setWantRecipe(null); }
  }, [wantRecipe, recipes]);

  const [fine, setFine] = useState(false);
  useEffect(() => { try { setFine(window.matchMedia("(pointer: fine)").matches); } catch { /* */ } }, []);
  const meal = sumMeals(items);
  // Lo anotado rápido en Hoy (+20 g de proteína, +250 kcal) también cuenta aquí.
  const tot = { ...meal, kcal: meal.kcal + quick.kcal, protein: meal.protein + quick.protein };
  const left = targets.kcal - tot.kcal;
  const weekDiff = useMemo(() => weeklyBalance([...extras.week, { day: dateKey, kcal: tot.kcal }], targets.kcal, dateKey).diff, [extras.week, dateKey, tot.kcal, targets.kcal]);
  const over = overMessage(-left, extras.week.length ? weekDiff : undefined);
  const mine = useMemo(() => saved.map(savedAsFood), [saved]);
  const myRecipes = useMemo(() => recipes.map(recipeAsFood), [recipes]);
  // Al elegir un alimento, su panel de porción queda a la vista (sin animar el scroll si se pide menos movimiento).
  useEffect(() => {
    if (!pick) return;
    const el = document.getElementById(`pick-${pick.id}`);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [pick]);
  useEffect(() => { setShown(PAGE); }, [q, tab, chain]);
  // Al cambiar de vista (lista, plato, personalizada) se empieza desde arriba.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { scroller.current?.scrollTo({ top: 0 }); }, [view, tab]);

  /** Resultados: con búsqueda, agrupados (mejores primero y luego por categoría); sin búsqueda, la pestaña elegida. */
  const groups = useMemo(() => {
    if (q.trim()) return groupHits(searchScored(q, country, [...myRecipes, ...mine, ...CATALOG]));
    const list = tab === "recent" ? recent.map((id) => CATALOG_BY_ID[id]).filter(Boolean)
      : tab === "mine" ? mine : tab === "recetas" ? myRecipes
      : tab === "resto" ? chainItems(chain, chains.map((c) => c.id)) : catItems(tab, country);
    return [{ key: "", items: list }];
  }, [q, tab, recent, country, chain, chains, mine, myRecipes]);
  const total = groups.reduce((a, g) => a + g.items.length, 0);

  function open(slot: Slot) {
    setSheet(slot); setQ(""); setPick(null); setView("list");
    setTab(recent.length ? "recent" : slot === "desayuno" ? "desayunos" : "platos");
  }

  /** Guarda en el servidor; el XP se predice (tope diario) y se corrige con lo que diga el servidor. */
  function commit(temp: MealItem, label: string, req: Parameters<typeof addMeal>[0]) {
    const xp = mealXpFor(xpCount);
    setItems((x) => [...x, temp]);
    if (xp) setXpCount((c) => c + 1);
    try { navigator.vibrate?.(20); } catch { /* */ }
    setToast({ ok: true, t: xp ? `${label}, ${n0(temp.kcal)} kcal. +${xp} XP` : `${label}, ${n0(temp.kcal)} kcal. Registrado` });
    start(async () => {
      const r = await safeAction(addMeal(req));
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

  function remember(f: Food) {
    if (!CATALOG_BY_ID[f.id] || f.id.startsWith("libre-")) return;
    const nr = [f.id, ...recent.filter((r) => r !== f.id)].slice(0, 15);
    setRecent(nr); try { localStorage.setItem("bb.recentFoods", JSON.stringify(nr)); } catch { /* */ }
  }

  /** Registra un alimento del catálogo, de Mis comidas o de Mis recetas, por porciones o por gramos. */
  function add(f: Food, sel: Sel = { qty: 1 }) {
    const slot = sheet ?? defaultSlot();
    const r = calcSel(f, sel);
    const isMine = f.id.startsWith(MY), isRecipe = f.id.startsWith(RC);
    const own = isMine || isRecipe;
    const name = (own ? f.n : mealName(f)) + (sel.grams ? `, ${r.label}` : "");
    const temp: MealItem = { id: `tmp-${Date.now()}`, slot, name, qty: sel.grams ? 1 : (r.m || 1), kcal: r.kcal, protein: r.protein, carbs: r.carbs, fat: r.fat };
    remember(f);
    setPick(null);
    const custom = { name: sel.grams ? name : f.n, kcal: sel.grams ? r.kcal : f.k, protein: sel.grams ? r.protein : f.pr, carbs: sel.grams ? r.carbs : f.c, fat: sel.grams ? r.fat : f.f, portion: f.p };
    const qty = sel.grams ? 1 : sel.qty;
    const req: Parameters<typeof addMeal>[0] = isRecipe
      ? { slot, qty, recipeId: f.id.slice(RC.length), custom }
      : isMine ? { slot, qty, custom }
      : sel.grams ? { slot, foodId: f.id, grams: sel.grams } : { slot, foodId: f.id, qty };
    commit(temp, f.n, req);
  }

  /** Suma un alimento al plato que se está armando. */
  function toPlate(f: Food, sel: Sel) {
    const ing = f.id.startsWith(MY) || f.id.startsWith(RC)
      ? (() => { const r = calcSel(f, sel); return { ref: f.id, name: f.n, portion: sel.grams ? `${n0(sel.grams)} g` : f.p, qty: sel.grams ? 1 : r.m, ...(sel.grams ? { grams: Math.round(sel.grams) } : {}), kcal: r.kcal, protein: r.protein, carbs: r.carbs, fat: r.fat }; })()
      : ingFrom(f, sel.grams ? { grams: sel.grams } : { qty: sel.qty });
    remember(f);
    setPlate((p) => ({ ...p, items: [...p.items, ing].slice(0, 30) }));
    setPick(null);
    setToast({ ok: true, t: `${f.n} va al plato` });
  }

  function addCustom(c: CustomOut) {
    const slot = sheet ?? defaultSlot();
    const label = c.portion !== "1 porción" ? `${c.name}, ${c.portion}` : c.name;
    const temp: MealItem = { id: `tmp-${Date.now()}`, slot, name: label, qty: 1, kcal: c.kcal, protein: c.protein, carbs: c.carbs, fat: c.fat };
    setView("list");
    commit(temp, c.name, { slot, custom: { name: label.slice(0, 80), kcal: c.kcal, protein: c.protein, carbs: c.carbs, fat: c.fat, portion: c.portion } });
    if (c.save && !saved.some((s) => s.name.toLowerCase() === c.name.toLowerCase())) {
      const food = { name: c.name, ...c.saveAs };
      const tmp: SavedFood = { ...food, id: `tmp-${Date.now()}` };
      setSaved((x) => [tmp, ...x]);
      start(async () => {
        const r = await safeAction(saveFood(food));
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
    start(async () => { const r = await safeAction(deleteSavedFood(id)); if (!r.ok) { setSaved(prev); setToast({ ok: false, t: "No pudimos quitarla. Intenta de nuevo." }); } });
  }

  // ───── Plato y recetas ─────
  const autoName = plateName(plate.items);
  function logPlate() {
    const slot = sheet ?? defaultSlot();
    const per = perServing(sumIngs(plate.items), plate.servings);
    const name = (plate.name.trim() || autoName).slice(0, 80);
    const temp: MealItem = { id: `tmp-${Date.now()}`, slot, name, qty: 1, ...per };
    commit(temp, name, { slot, custom: { name, ...per, portion: plate.servings > 1 ? `1 de ${plate.servings} porciones` : "1 plato" } });
    if (!plate.editId) setPlate(EMPTY_PLATE);
    setView("list"); setQ("");
  }
  function savePlate() {
    const name = (plate.name.trim() || autoName).slice(0, 80);
    const editId = plate.editId;
    start(async () => {
      const r = await safeAction(saveRecipe({ id: editId ?? undefined, name, servings: plate.servings, items: plate.items }));
      if (!r.ok || !r.recipe) { setToast({ ok: false, t: r.error ?? "No pudimos guardar la receta. Intenta de nuevo." }); return; }
      setRecipes((x) => (editId ? x.map((y) => (y.id === editId ? r.recipe! : y)) : [r.recipe!, ...x]));
      setToast({ ok: true, t: editId ? "Receta actualizada" : "Guardada en Mis recetas" });
      setPlate(EMPTY_PLATE); setView("list"); setQ(""); setTab("recetas");
    });
  }
  function editRecipe(f: Food) {
    const r = recipes.find((x) => RC + x.id === f.id);
    if (!r) return;
    setPlate({ items: r.items, servings: r.servings, name: r.name, editId: r.id });
    setPick(null); setView("plate");
  }
  function removeRecipe(id: string) {
    const prev = recipes;
    const r = recipes.find((x) => x.id === id);
    setRecipes((x) => x.filter((y) => y.id !== id));
    if (plate.editId === id) { setPlate(EMPTY_PLATE); setView("list"); }
    setToast({ ok: true, t: `Eliminaste ${r?.name ?? "la receta"}` });
    start(async () => { const res = await safeAction(deleteRecipe(id)); if (!res.ok) { setRecipes(prev); setToast({ ok: false, t: "No pudimos eliminarla. Intenta de nuevo." }); } });
  }

  /** Vuelve a guardar un alimento borrado (nuevo id) en su mismo lugar de la lista. */
  function restore(item: MealItem, at: number) {
    const temp = { ...item, id: `tmp-${Date.now()}` };
    setItems((x) => [...x.slice(0, at), temp, ...x.slice(at)]);
    setToast(null);
    start(async () => {
      const r = await safeAction(copyMeals([row(item)]));
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
      const r = await safeAction(removeMeal(item.id));
      if (!r.ok) { setItems((x) => [...x.slice(0, at), item, ...x.slice(at)]); setToast({ ok: false, t: "No pudimos quitarlo. Intenta de nuevo." }); }
    });
  }

  /** Cambiar la porción: guarda el alimento con la nueva cantidad y borra el anterior. */
  function changeQty(item: MealItem, qn: number) {
    if (qn === item.qty) return;
    const next = scaled(item, qn);
    setItems((x) => x.map((i) => (i.id === item.id ? next : i)));
    start(async () => {
      const r = await safeAction(copyMeals([row(next)]));
      const created = r.ok ? r.items?.[0] : undefined;
      if (!created) { setItems((x) => x.map((i) => (i.id === item.id ? item : i))); setToast({ ok: false, t: "No pudimos cambiar la porción. Intenta de nuevo." }); return; }
      const del = await safeAction(removeMeal(item.id));
      if (!del.ok) { await safeAction(removeMeal(created.id)); setItems((x) => x.map((i) => (i.id === item.id ? item : i))); setToast({ ok: false, t: "No pudimos cambiar la porción. Intenta de nuevo." }); return; }
      setItems((x) => x.map((i) => (i.id === item.id ? created : i)));
      setEditing((e) => (e === item.id ? created.id : e));
    });
  }

  function copyYesterday() {
    start(async () => {
      const r = await safeAction(copyMeals(yesterday.map(row)));
      if (r.ok && r.items) { setItems((x) => [...x, ...r.items!]); setToast({ ok: true, t: `Copiado: ${r.items.length} alimentos de ayer` }); }
      else setToast({ ok: false, t: "No pudimos copiar lo de ayer. Intenta de nuevo." });
    });
  }

  /** Una fila de la lista (o su panel de porción si está elegida). */
  function renderFood(f: Food) {
    const cad = f.cad ? CHAIN_BY_ID[f.cad as ChainId]?.n : null;
    const isMine = f.id.startsWith(MY), isRecipe = f.id.startsWith(RC);
    if (pick?.id === f.id) {
      const better = betterChoice({ id: f.id, cadena: f.cad, k: f.k, best: f.best });
      return (
        <PickPanel key={f.id} f={f} chain={cad} onAdd={(s) => add(f, s)} onPlate={(s) => { toPlate(f, s); }}
          hint={better && cad ? <BetterHint chain={cad} better={better} onSee={() => { const b = CATALOG_BY_ID[better.id]; if (b) setPick(b); }} /> : null} />
      );
    }
    const extra = isMine
      ? <button onClick={() => forget(f)} aria-label={`Quitar ${f.n} de Mis comidas`} className="tap pressable grid place-items-center size-11 shrink-0 rounded-full text-muted hover:bg-cream hover:text-ink"><Trash weight="bold" className="size-4" /></button>
      : isRecipe ? <>
          <button onClick={() => editRecipe(f)} aria-label={`Editar ${f.n}`} className="tap pressable grid place-items-center size-11 shrink-0 rounded-full text-muted hover:bg-cream hover:text-ink"><PencilSimple weight="bold" className="size-4" /></button>
          <button onClick={() => removeRecipe(f.id.slice(RC.length))} aria-label={`Eliminar ${f.n}`} className="tap pressable grid place-items-center size-11 shrink-0 rounded-full text-muted hover:bg-cream hover:text-ink"><Trash weight="bold" className="size-4" /></button>
        </> : null;
    return <FoodRow key={f.id} f={f} chain={cad} onPick={() => setPick(f)} onQuick={() => add(f)} extra={extra} />;
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
      <Sheet open={!!sheet} onClose={() => setSheet(null)} className="h-[90dvh] sm:h-[80vh] flex flex-col">
        <div className="px-4 pb-2">
          {view === "list" ? (
            <>
              <SheetTitle className="text-xl font-extrabold text-ink">Agregar a {slotName}</SheetTitle>
              <label className="mt-3 flex items-center gap-2 h-12 rounded-2xl bg-white border border-line px-3 transition-[border-color,box-shadow] focus-within:border-ink focus-within:ring-4 focus-within:ring-banana/40">
                <MagnifyingGlass weight="bold" className="size-5 text-faint" /><input value={q} onChange={(e) => { setQ(e.target.value); setPick(null); }} data-autofocus={fine || undefined} placeholder="Busca: bagel, queso crema, pollo, big mac…" className="flex-1 min-w-0 bg-transparent text-[16px] text-ink outline-none" aria-label="Buscar alimento, receta o restaurante" />
                {q && <button onClick={() => setQ("")} className="tap pressable -mr-2 grid place-items-center size-11 shrink-0 rounded-full text-muted hover:text-ink" aria-label="Borrar búsqueda"><X weight="bold" className="size-4" /></button>}
              </label>
              {!q && (
                <div className="mt-3 -mx-4 px-4 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" role="group" aria-label="Categorías">
                  {recent.length > 0 && <TabChip on={tab === "recent"} onClick={() => setTab("recent")}><Clock weight="duotone" className="size-4" />Recientes</TabChip>}
                  <TabChip on={tab === "recetas"} onClick={() => setTab("recetas")}><CookingPot weight="duotone" className={`size-4 ${tab === "recetas" ? "text-banana" : "text-banana-ink"}`} />Mis recetas</TabChip>
                  <TabChip on={tab === "mine"} onClick={() => setTab("mine")}><Star weight="duotone" className={`size-4 ${tab === "mine" ? "text-banana" : "text-banana-ink"}`} />Mis comidas</TabChip>
                  {FOOD_CATS.map(([c, l, icon]) => <TabChip key={c} on={tab === c} onClick={() => setTab(c)}><BrandIcon name={icon} className={`size-4 ${tab === c ? "text-banana" : "text-banana-ink"}`} />{l}</TabChip>)}
                </div>
              )}
              {!q && tab === "resto" && (
                <div className="mt-1.5 -mx-4 px-4 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" role="group" aria-label="Cadenas">
                  <button onClick={() => setChain(null)} aria-pressed={chain === null} className={`chip h-8 shrink-0 ${chain === null ? "bg-banana text-ink" : "bg-cream text-muted hover:text-ink"}`}>Todas</button>
                  {chains.map((c) => <button key={c.id} onClick={() => setChain(c.id)} aria-pressed={chain === c.id} className={`chip h-8 shrink-0 ${chain === c.id ? "bg-banana text-ink" : "bg-cream text-muted hover:text-ink"}`}>{c.n}</button>)}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-1">
              <button onClick={() => { setView("list"); if (plate.editId) setPlate(EMPTY_PLATE); }} aria-label="Volver a buscar" className="tap pressable -ml-2 grid place-items-center size-11 shrink-0 rounded-full text-ink hover:bg-cream"><ArrowLeft weight="bold" className="size-5" /></button>
              <SheetTitle className="text-xl font-extrabold text-ink">{view === "custom" ? "Comida personalizada" : plate.editId ? "Editar receta" : "Armar plato"}</SheetTitle>
            </div>
          )}
        </div>

        <div ref={scroller} className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
          {view === "plate" ? (
            <PlateBuilder items={plate.items} setItems={(fn) => setPlate((p) => ({ ...p, items: fn(p.items) }))} servings={plate.servings} setServings={(n) => setPlate((p) => ({ ...p, servings: n }))}
              name={plate.name} setName={(s) => setPlate((p) => ({ ...p, name: s }))} autoName={autoName} editing={!!plate.editId} slotName={slotName} busy={busy}
              onLog={logPlate} onSave={savePlate} onDelete={plate.editId ? () => removeRecipe(plate.editId!) : undefined} onAddMore={() => setView("list")} onClear={() => setPlate(EMPTY_PLATE)} />
          ) : view === "custom" ? (
            <CustomFoodForm defaultName={q} onSubmit={addCustom} />
          ) : (
            <>
              {!q && (
                <div className="mb-3 grid grid-cols-2 gap-1.5">
                  <button onClick={() => { setPick(null); setView("plate"); }} className="tap pressable flex items-center gap-2 min-h-12 rounded-2xl bg-white border border-line px-3 text-left text-sm font-bold text-ink hover:border-ink/40"><CookingPot weight="duotone" className="size-5 shrink-0 text-banana-ink" /><span>Armar plato<span className="block text-[11px] font-semibold text-muted">Varios ingredientes en uno</span></span></button>
                  <button onClick={() => { setPick(null); setView("custom"); }} className="tap pressable flex items-center gap-2 min-h-12 rounded-2xl bg-white border border-line px-3 text-left text-sm font-bold text-ink hover:border-ink/40"><Plus weight="bold" className="size-5 shrink-0 text-banana-ink" /><span>Personalizada<span className="block text-[11px] font-semibold text-muted">Con tus kcal y macros</span></span></button>
                </div>
              )}
              {!q && tab !== "recetas" && tab !== "mine" && (
                <details className="mb-3 rounded-2xl bg-banana-soft group/libre">
                  <summary className="tap cursor-pointer list-none flex items-center justify-between gap-2 min-h-11 px-3 [&::-webkit-details-marker]:hidden">
                    <span><span className="block text-sm font-bold text-ink">Comida libre</span><span className="block text-xs text-ink/70">¿No sabes qué comiste exactamente? Elige el tamaño.</span></span>
                    <CaretDown weight="bold" className="size-4 shrink-0 text-ink/70 transition-transform duration-(--dur-fast) ease-out group-open/libre:rotate-180" />
                  </summary>
                  <div className="grid grid-cols-3 gap-1.5 px-3 pb-3">
                    {LIBRE.map((f) => (
                      <button key={f.id} onClick={() => add(f)} className="tap pressable min-h-14 rounded-xl bg-white px-2 py-1.5 text-center hover:shadow-lift" aria-label={`${f.n}, unas ${n0(f.k)} kcal`}>
                        <span className="block text-sm font-extrabold text-ink capitalize">{f.size}</span>
                        <span className="block text-[11px] font-semibold text-muted tabular-nums">~{n0(f.k)} kcal</span>
                      </button>
                    ))}
                  </div>
                </details>
              )}
              {!q && tab === "recetas" && (
                <button onClick={() => { setPlate(EMPTY_PLATE); setView("plate"); }} className="pressable mb-3 w-full h-11 rounded-2xl border border-dashed border-line text-sm font-bold text-muted hover:border-ink/40 hover:text-ink inline-flex items-center justify-center gap-1.5"><Plus weight="bold" className="size-4" />Nueva receta</button>
              )}
              {q && <p className="mb-2 text-xs font-semibold text-muted tabular-nums" aria-live="polite">{total ? `${n0(total)} resultados` : ""}</p>}
              {(() => {
                let left = shown;
                return groups.map((g) => {
                  if (left <= 0 || !g.items.length) return null;
                  const slice = g.items.slice(0, left);
                  left -= slice.length;
                  return (
                    <section key={g.key || "lista"} className="mb-3" aria-label={g.key ? groupLabel(g.key) : undefined}>
                      {g.key && <h3 className="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-muted">{groupLabel(g.key)}</h3>}
                      <ul className="space-y-1.5">{slice.map((f) => <li key={f.id}>{renderFood(f)}</li>)}</ul>
                    </section>
                  );
                });
              })()}
              {total > shown && <button onClick={() => setShown((n) => n + PAGE)} className="btn-ghost w-full h-11">Ver más ({n0(total - shown)})</button>}
              {!total && (
                <p className="text-center text-muted py-6 text-sm">
                  {q ? <>No encontramos “{q}”. <button onClick={() => setView("custom")} className="font-bold text-banana-ink underline underline-offset-2">Agrégala como personalizada</button> o usa Comida libre.</>
                    : tab === "mine" ? "Aquí quedan las comidas personalizadas que guardes para repetirlas en un toque."
                    : tab === "recetas" ? "Arma un plato con sus ingredientes y guárdalo: queda aquí para registrarlo en un toque."
                    : "Nada por aquí todavía."}
                </p>
              )}
              <p className="mt-3 text-center text-[11px] text-faint">
                {!q && tab === "resto"
                  ? <>Datos de la cadena, pueden variar por país. {chain ? CHAIN_BY_ID[chain].fuente : "Cada producto indica su cadena."}</>
                  : "Valores de referencia por porción típica (tablas tipo USDA y etiquetas). Los platos preparados son aproximados."}
              </p>
            </>
          )}
        </div>
        {view === "list" && plate.items.length > 0 && (
          <div className="border-t border-line bg-white px-4 py-2.5 animate-enter">
            <button onClick={() => { setPick(null); setView("plate"); }} className="tap pressable flex w-full items-center gap-3 min-h-12 rounded-2xl bg-ink px-4 text-left text-white hover:bg-black">
              <CookingPot weight="duotone" className="size-6 shrink-0 text-banana" />
              <span className="flex-1 min-w-0"><span className="block text-sm font-extrabold">{plate.editId ? "Editando receta" : "Tu plato"}: {plate.items.length} {plate.items.length === 1 ? "ingrediente" : "ingredientes"}</span><span className="block text-xs text-white/70 tabular-nums">{n0(sumIngs(plate.items).kcal)} kcal en total</span></span>
              <span className="text-sm font-bold text-banana">Ver</span>
            </button>
          </div>
        )}
      </Sheet>
      <Toast side="bottom" className="[&_button]:pointer-events-auto">{toast && <>{toast.ok ? <CheckCircle weight="fill" className="size-5 shrink-0 text-banana" /> : <WarningCircle weight="fill" className="size-5 shrink-0 text-ember" />}<span className="truncate">{toast.t}</span>{toast.undo && <button onClick={toast.undo} className="tap pressable -my-2 -mr-2 ml-1 h-9 shrink-0 rounded-full bg-white/15 px-3 text-sm font-extrabold text-banana hover:bg-white/25">Deshacer</button>}</>}</Toast>
    </div>
  );
}

function TabChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} aria-pressed={on} className={`chip h-9 shrink-0 gap-1.5 ${on ? "bg-ink text-white" : "bg-white border border-line text-ink"}`}>{children}</button>;
}
