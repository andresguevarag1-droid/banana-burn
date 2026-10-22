import Link from "next/link";
import { getViewer } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements";
import { dashboard, getAthlete } from "@/lib/athlete";
import { RECIPES, mealPlan, type Recipe } from "@/lib/recipes";
import { AddRecipe } from "./add";
import { SLOTS_MEAL } from "@/lib/meals-shared";
import { ArrowLeft, BananaBunch, BrandIcon, CaretDown, Clock } from "@/components/icons";

export const metadata = { title: "Recetas y plan de comidas" };

const SLOT_N = { desayuno: "Desayuno", almuerzo: "Almuerzo", merienda: "Merienda", cena: "Cena" } as const;
const SLOT_ICON = Object.fromEntries(SLOTS_MEAL.map((s) => [s.id, s.icon])) as Record<keyof typeof SLOT_N, string>;

function RecipeCard({ r, factor = 1, showSlot = false }: { r: Recipe; factor?: number; showSlot?: boolean }) {
  const f = Math.round(factor * 10) / 10;
  const k = Math.round(r.kcal * f), p = Math.round(r.p * f);
  return (
    <details className="card group overflow-hidden">
      <summary className="cursor-pointer list-none p-4 flex items-center gap-3">
        <span className="grid place-items-center size-12 shrink-0 rounded-2xl bg-banana-soft text-banana-ink"><BrandIcon name={r.icon} className="size-7" /></span>
        <span className="flex-1 min-w-0">
          <span className="flex flex-wrap items-center gap-x-2 text-xs font-semibold text-muted">{showSlot && <span className="text-banana-ink">{SLOT_N[r.slot]}</span>}<span className="inline-flex items-center gap-1"><Clock weight="bold" className="size-3.5" />{r.min} min</span>{f !== 1 && <span>porción ×{f.toLocaleString("es-CR")}</span>}</span>
          <span className="block font-extrabold text-ink leading-tight">{r.t}</span>
          <span className="block text-xs text-muted tabular-nums">{k} kcal, {p} g proteína, {Math.round(r.c * f)} g carbos, {Math.round(r.f * f)} g grasa</span>
        </span>
        <CaretDown weight="bold" className="size-5 shrink-0 text-faint transition-transform duration-(--dur-fast) ease-out group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4 grid gap-4 sm:grid-cols-2">
        <div><p className="text-sm font-bold text-ink">Ingredientes{r.serves > 1 ? ` (rinde ${r.serves})` : ""}</p><ul className="mt-1 space-y-1 text-sm text-body">{r.ing.map((i) => <li key={i} className="flex gap-2"><span aria-hidden className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-banana-ink" />{i}</li>)}</ul></div>
        <div><p className="text-sm font-bold text-ink">Preparación</p><ol className="mt-1 space-y-1 text-sm text-body">{r.steps.map((s, i) => <li key={i}>{i + 1}. {s}</li>)}</ol></div>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-2">{r.tags.map((t) => <span key={t} className="chip bg-cream text-ink">{t}</span>)}<span className="ml-auto"><AddRecipe name={r.t + (f !== 1 ? ` ×${f}` : "")} kcal={k} protein={p} slot={r.slot} /></span></div>
      </div>
    </details>
  );
}

export default async function Recetas() {
  const v = (await getViewer())!;
  if (!(await getEntitlements(v)).nutrition) return <div className="text-center py-16"><span className="mx-auto grid place-items-center size-20 rounded-3xl bg-banana-soft text-banana-ink"><BananaBunch className="size-11" /></span><h1 className="mt-3 text-2xl font-extrabold text-ink">Recetas y plan de comidas</h1><p className="mt-2 text-muted">Incluido en Entreno + Nutrición.</p><Link href="/precios" className="btn-banana mt-6">Ver planes</Link></div>;
  const d = dashboard(await getAthlete(v));
  const plan = mealPlan({ kcal: d.t.kcal, protein: d.t.protein }, d.today.dow);
  const base = plan.reduce((a, r) => a + r.kcal, 0);
  const factor = Math.min(1.6, Math.max(0.8, d.t.kcal / base));
  const totK = Math.round(base * factor), totP = Math.round(plan.reduce((a, r) => a + r.p, 0) * factor);
  return (
    <div className="space-y-6 animate-enter">
      <header>
        <Link href="/app/nutricion" className="tap inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft weight="bold" className="size-4" />Nutrición</Link>
        <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">Recetas ticas fit</h1>
        <p className="mt-1 text-muted">Fáciles, con lo que hay en cualquier súper de Costa Rica. Macros aproximados.</p>
      </header>
      <section className="rounded-[1.75rem] bg-banana p-5">
        <h2 className="flex items-center gap-2 text-xl font-extrabold text-ink"><BananaBunch className="size-6 text-ink" />Tu menú de hoy</h2>
        <p className="mt-1 text-lg font-bold text-ink tabular-nums">{totK.toLocaleString("es-CR")} kcal y {totP} g de proteína</p>
        <p className="text-sm text-ink/70">Calculado para tu meta de {d.t.kcal.toLocaleString("es-CR")} kcal y {d.t.protein} g. Cambia cada día.</p>
        <div className="mt-4 space-y-2">{plan.map((r) => <RecipeCard key={r.id} r={r} factor={factor} showSlot />)}</div>
      </section>
      {(["desayuno", "almuerzo", "merienda", "cena"] as const).map((s) => (
        <section key={s}><h2 className="flex items-center gap-2.5 font-extrabold text-ink mb-2"><span className="grid place-items-center size-9 shrink-0 rounded-xl bg-banana-soft text-banana-ink"><BrandIcon name={SLOT_ICON[s]} className="size-5" /></span>{SLOT_N[s]}</h2><div className="space-y-2">{RECIPES.filter((r) => r.slot === s).map((r) => <RecipeCard key={r.id} r={r} />)}</div></section>
      ))}
    </div>
  );
}
