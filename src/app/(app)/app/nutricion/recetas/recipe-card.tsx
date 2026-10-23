"use client";
import { useEffect, useMemo, useState } from "react";
import { BananaBunch, BrandIcon, Calendar, CaretDown, Clock, Egg } from "@/components/icons";
import { MEAL_END, flashPlan, fmtQty, ingText, localHour, portionOf, type Recipe, type Slot } from "@/lib/recipes";
import { SLOTS_MEAL, sumMeals, type MealItem } from "@/lib/meals-shared";
import { AddRecipe } from "./add";

const SLOT_N: Record<Slot, string> = { desayuno: "Desayuno", almuerzo: "Almuerzo", merienda: "Merienda", cena: "Cena" };
const n0 = (n: number) => Math.round(n).toLocaleString("es-CO");
const portionsLabel = (p: number) => `${fmtQty(p)} ${p === 1 ? "porción" : "porciones"}`;
const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} y ${xs.at(-1)}` : xs[0] ?? "");

function Bullets({ items }: { items: string[] }) {
  return <ul className="mt-1 space-y-1 text-sm text-body">{items.map((t, i) => <li key={i} className="flex gap-2"><span aria-hidden className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-banana-ink" />{t}</li>)}</ul>;
}

/**
 * Tarjeta de receta. En el menú (`portions` definido) los ingredientes salen ya calculados para tu porción;
 * en la lista general, para la receta completa.
 */
export function RecipeCard({ r, portions, showSlot = false, dateKey, demo, base, open = false, noAdd = false }: { r: Recipe; portions?: number; showSlot?: boolean; dateKey: string; demo: boolean; base?: MealItem[]; open?: boolean; noAdd?: boolean }) {
  const mine = portions ?? 1;
  const m = portionOf(r, mine);
  const forMe = portions != null;
  return (
    <details className="card group overflow-hidden" open={open || undefined}>
      <summary className="cursor-pointer list-none p-4 flex items-center gap-3 [&::-webkit-details-marker]:hidden">
        <span className="grid place-items-center size-12 shrink-0 rounded-2xl bg-banana-soft text-banana-ink"><BrandIcon name={r.icon} className="size-7" /></span>
        <span className="flex-1 min-w-0">
          <span className="flex flex-wrap items-center gap-x-2 text-xs font-semibold text-muted">{showSlot && <span className="text-banana-ink">{SLOT_N[r.slot]}</span>}<span className="inline-flex items-center gap-1"><Clock weight="bold" className="size-3.5" />{r.min} min</span>{forMe && mine !== 1 && <span>{portionsLabel(mine)}</span>}</span>
          <span className="block font-extrabold text-ink leading-tight">{r.t}</span>
          <span className="block text-xs text-muted tabular-nums">{m.kcal} kcal, {m.p} g proteína, {m.c} g carbos, {m.f} g grasa</span>
        </span>
        <CaretDown weight="bold" className="size-5 shrink-0 text-faint transition-transform duration-(--dur-fast) ease-out group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4 grid gap-4 sm:grid-cols-2">
        <div>
          {forMe ? (
            <>
              <p className="text-sm font-bold text-ink">Ingredientes para tu porción</p>
              <Bullets items={r.ix.map((i) => ingText(i, mine, r.serves))} />
              {r.serves > 1 && (
                <details className="mt-2 group/full">
                  <summary className="tap cursor-pointer list-none inline-flex items-center gap-1 text-xs font-bold text-muted hover:text-ink [&::-webkit-details-marker]:hidden">Receta completa para cocinar de una vez (rinde {r.serves})<CaretDown weight="bold" className="size-3.5 transition-transform duration-(--dur-fast) ease-out group-open/full:rotate-180" /></summary>
                  <Bullets items={r.ing} />
                </details>
              )}
            </>
          ) : (
            <><p className="text-sm font-bold text-ink">Ingredientes{r.serves > 1 ? ` (rinde ${r.serves} porciones)` : ""}</p><Bullets items={r.ing} /></>
          )}
        </div>
        <div><p className="text-sm font-bold text-ink">Preparación</p><ol className="mt-1 space-y-1 text-sm text-body">{r.steps.map((s, i) => <li key={i}>{i + 1}. {s}</li>)}</ol></div>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-2">{r.tags.map((t) => <span key={t} className="chip bg-cream text-ink">{t}</span>)}{!noAdd && <span className="ml-auto"><AddRecipe item={{ slot: r.slot, name: r.t, qty: mine, kcal: m.kcal, protein: m.p, carbs: m.c, fat: m.f }} dateKey={dateKey} demo={demo} base={base} /></span>}</div>
      </div>
    </details>
  );
}

const fmtDay = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("es-419", { weekday: "long", day: "numeric", month: "long" });

/**
 * Menú flash según la hora del celular: lo que falta hoy solo para los tiempos que quedan
 * (sin desayuno pasadas las 11:00) y aparte lo de mañana con sus ingredientes para comprar o dejar listo.
 * Desde las 20:00 el menú principal es el de mañana completo.
 */
export function MenuToday({ target, eaten: eaten0, quick: quick0, dateKey, demo, hour: hour0 }: { target: { kcal: number; protein: number }; eaten: MealItem[]; quick: { kcal: number; protein: number }; dateKey: string; demo: boolean; hour: number }) {
  const [eaten, setEaten] = useState(eaten0);
  const [quick, setQuick] = useState(quick0);
  const [hour, setHour] = useState(hour0);
  useEffect(() => {
    if (!demo) return;
    try {
      const s = localStorage.getItem(`bb.meals.${dateKey}`); if (s) setEaten(JSON.parse(s));
      const d = localStorage.getItem(`bb.daily.${dateKey}`); if (d) { const l = JSON.parse(d); setQuick({ kcal: Number(l.kcal) || 0, protein: Number(l.protein) || 0 }); }
    } catch { /* */ }
  }, [demo, dateKey]);
  // La hora del dispositivo manda (el servidor solo da la primera pintura con la zona del usuario).
  useEffect(() => {
    const tick = () => setHour(localHour(new Date()));
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);

  const sum = sumMeals(eaten);
  const left = { kcal: Math.round(target.kcal - sum.kcal - quick.kcal), protein: Math.round(target.protein - sum.protein - quick.protein) };
  const logged = SLOTS_MEAL.filter((s) => eaten.some((i) => i.slot === s.id)).map((s) => s.id);
  const plan = useMemo(() => flashPlan({ hour: Math.floor(hour * 4) / 4, todayIso: dateKey, logged, left, target }), [Math.floor(hour * 4), dateKey, logged.join(), left.kcal, left.protein, target.kcal, target.protein]); // eslint-disable-line react-hooks/exhaustive-deps
  const menu = plan.today.menu;
  const dp = menu.p - left.protein;
  const tomorrow = plan.tomorrow;

  const tomorrowBlock = (main: boolean) => tomorrow.menu.items.length ? (
    <div className={main ? "mt-4" : "mt-5 rounded-2xl bg-white/55 p-4"}>
      {!main && <h3 className="flex items-center gap-2 font-extrabold text-ink"><Calendar weight="duotone" className="size-5" />Para mañana</h3>}
      {!main && <p className="text-sm text-ink/75">{list(tomorrow.slots.map((s) => SLOT_N[s].toLowerCase())).replace(/^./, (c) => c.toUpperCase())} del {fmtDay(tomorrow.iso)}. Revisa los ingredientes para comprar o dejar listo.</p>}
      <div className="mt-3 space-y-2">{tomorrow.menu.items.map((x) => <RecipeCard key={x.r.id} r={x.r} portions={x.portions} showSlot dateKey={dateKey} demo={demo} base={eaten0} open={x.r.slot === "desayuno"} noAdd />)}</div>
    </div>
  ) : null;

  if (plan.mode === "manana") {
    const cenaOpen = !logged.includes("cena") && hour < MEAL_END.cena && left.kcal >= 150;
    return (
      <section className="rounded-[1.75rem] bg-banana p-5" aria-labelledby="menu-h">
        <h2 id="menu-h" className="flex items-center gap-2 text-xl font-extrabold text-ink"><BananaBunch className="size-6 text-ink" />Tu menú de mañana</h2>
        <p className="mt-1 text-sm text-ink/75 first-letter:uppercase">{fmtDay(tomorrow.iso)}: <b className="text-ink tabular-nums">{n0(tomorrow.menu.kcal)} kcal</b> y <b className="text-ink tabular-nums">{n0(tomorrow.menu.p)} g de proteína</b>. Revisa los ingredientes para comprar o dejar listo.</p>
        {cenaOpen && <p className="mt-1 text-sm text-ink/75">Hoy te faltan {n0(left.kcal)} kcal. Si todavía cenas, que sea algo ligero y con proteína.</p>}
        {tomorrowBlock(true)}
      </section>
    );
  }

  return (
    <section className="rounded-[1.75rem] bg-banana p-5" aria-labelledby="menu-h">
      <h2 id="menu-h" className="flex items-center gap-2 text-xl font-extrabold text-ink"><BananaBunch className="size-6 text-ink" />Tu menú para lo que falta hoy</h2>
      {left.kcal < 150 ? (
        <div className="mt-2 text-ink">
          <p className="text-lg font-bold">{left.kcal < 0 ? `Hoy ya pasaste tu meta por ${n0(-left.kcal)} kcal.` : "Ya cubriste tus calorías de hoy."}</p>
          {left.protein > 10
            ? <p className="mt-1 flex items-start gap-2 text-sm text-ink/75"><Egg weight="duotone" className="size-5 shrink-0" />Te faltan {n0(left.protein)} g de proteína: yogur griego 0 % (20 g por 200 g) o claras de huevo son proteína casi sin calorías.</p>
            : <p className="mt-1 text-sm text-ink/75">Mañana el menú se arma de nuevo con tu meta completa.</p>}
        </div>
      ) : !plan.today.slots.length ? (
        <p className="mt-2 text-sm text-ink/75">Te faltan <b className="text-ink tabular-nums">{n0(left.kcal)} kcal</b>, pero ya no quedan comidas por sugerir hoy. Si te da hambre, elige algo ligero con proteína.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-ink/75">Te faltan <b className="text-ink tabular-nums">{n0(left.kcal)} kcal</b> y <b className="text-ink tabular-nums">{n0(Math.max(0, left.protein))} g de proteína</b> para {list(plan.today.slots.map((s) => SLOT_N[s].toLowerCase()))}{logged.length ? <> (ya registraste {list(logged.map((s) => SLOT_N[s].toLowerCase()))})</> : null}.</p>
          <p className="mt-2 text-lg font-bold text-ink tabular-nums">Este menú: {n0(menu.kcal)} kcal y {n0(menu.p)} g de proteína</p>
          {left.protein > 0 && dp > 10 && <p className="text-sm text-ink/75">Trae {n0(dp)} g de proteína de más: está bien, la proteína extra da saciedad y protege tu músculo mientras bajas de peso.</p>}
          {left.protein > 0 && dp < -10 && <p className="text-sm text-ink/75">Te quedarían {n0(-dp)} g de proteína por cubrir: súmale un yogur griego 0 % (20 g) o un scoop de whey (24 g).</p>}
          {!plan.today.slots.includes("merienda") && menu.items.some((x) => x.r.slot === "merienda") && <p className="text-sm text-ink/75">Te falta bastante para una sola comida, así que sumamos una merienda extra.</p>}
          <div className="mt-4 space-y-2">{menu.items.map((x) => <RecipeCard key={x.r.id} r={x.r} portions={x.portions} showSlot dateKey={dateKey} demo={demo} base={eaten0} />)}</div>
        </>
      )}
      {tomorrowBlock(false)}
    </section>
  );
}
