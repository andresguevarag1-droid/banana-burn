import Link from "next/link";
import { getViewer } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements";
import { dashboard, getAthlete } from "@/lib/athlete";
import { RECIPES, mealPlan, type Recipe } from "@/lib/recipes";
import { AddRecipe } from "./add";

export const metadata = { title: "Recetas y plan de comidas" };

const SLOT_N = { desayuno: "Desayuno", almuerzo: "Almuerzo", merienda: "Merienda", cena: "Cena" } as const;

function RecipeCard({ r, factor = 1 }: { r: Recipe; factor?: number }) {
  const f = Math.round(factor * 10) / 10;
  const k = Math.round(r.kcal * f), p = Math.round(r.p * f);
  return (
    <details className="card group overflow-hidden">
      <summary className="cursor-pointer list-none p-4 flex items-center gap-3">
        <span className="grid place-items-center size-12 shrink-0 rounded-2xl bg-cream text-2xl">{r.e}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-muted">{SLOT_N[r.slot]} · {r.min} min{f !== 1 ? ` · porción ×${f.toLocaleString("es-CR")}` : ""}</span>
          <span className="block font-extrabold text-ink leading-tight">{r.t}</span>
          <span className="block text-xs text-muted tabular-nums">{k} kcal · {p} g proteína · {Math.round(r.c * f)} g carbos · {Math.round(r.f * f)} g grasa</span>
        </span>
        <span className="text-xl text-faint transition-transform group-open:rotate-45" aria-hidden>+</span>
      </summary>
      <div className="px-4 pb-4 grid gap-4 sm:grid-cols-2">
        <div><p className="text-sm font-bold text-ink">Ingredientes{r.serves > 1 ? ` (rinde ${r.serves})` : ""}</p><ul className="mt-1 space-y-1 text-sm text-body">{r.ing.map((i) => <li key={i}>• {i}</li>)}</ul></div>
        <div><p className="text-sm font-bold text-ink">Preparación</p><ol className="mt-1 space-y-1 text-sm text-body">{r.steps.map((s, i) => <li key={i}>{i + 1}. {s}</li>)}</ol></div>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-2">{r.tags.map((t) => <span key={t} className="chip bg-cream text-ink">{t}</span>)}<span className="ml-auto"><AddRecipe name={r.t + (f !== 1 ? ` ×${f}` : "")} kcal={k} protein={p} slot={r.slot} /></span></div>
      </div>
    </details>
  );
}

export default async function Recetas() {
  const v = (await getViewer())!;
  if (!(await getEntitlements(v)).nutrition) return <div className="text-center py-16"><p className="text-5xl">🥗</p><h1 className="mt-3 text-2xl font-extrabold text-ink">Recetas y plan de comidas</h1><p className="mt-2 text-muted">Incluido en Entreno + Nutrición.</p><Link href="/precios" className="btn-banana mt-6">Ver planes</Link></div>;
  const d = dashboard(await getAthlete(v));
  const plan = mealPlan({ kcal: d.t.kcal, protein: d.t.protein }, d.today.dow);
  const base = plan.reduce((a, r) => a + r.kcal, 0);
  const factor = Math.min(1.6, Math.max(0.8, d.t.kcal / base));
  const totK = Math.round(base * factor), totP = Math.round(plan.reduce((a, r) => a + r.p, 0) * factor);
  return (
    <div className="space-y-6 animate-rise">
      <header>
        <Link href="/app/nutricion" className="text-sm font-semibold text-muted">← Nutrición</Link>
        <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">Recetas ticas fit 🍛</h1>
        <p className="mt-1 text-muted">Fáciles, con lo que hay en cualquier súper de Costa Rica. Macros aproximados.</p>
      </header>
      <section className="rounded-[1.75rem] bg-banana p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-ink/75">Plan de comidas de hoy</p>
        <p className="mt-1 text-2xl font-extrabold text-ink">{totK.toLocaleString("es-CR")} kcal · {totP} g proteína</p>
        <p className="text-sm text-ink/70">Calculado para tu meta de {d.t.kcal.toLocaleString("es-CR")} kcal y {d.t.protein} g. Cambia cada día.</p>
        <div className="mt-4 space-y-2">{plan.map((r) => <RecipeCard key={r.id} r={r} factor={factor} />)}</div>
      </section>
      {(["desayuno", "almuerzo", "merienda", "cena"] as const).map((s) => (
        <section key={s}><h2 className="font-extrabold text-ink mb-2">{SLOT_N[s]}</h2><div className="space-y-2">{RECIPES.filter((r) => r.slot === s).map((r) => <RecipeCard key={r.id} r={r} />)}</div></section>
      ))}
    </div>
  );
}
