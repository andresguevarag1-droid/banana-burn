"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CaretRight, CookingPot, PencilSimple, Plus } from "@/components/icons";
import type { UserRecipe } from "@/lib/user-recipes";

const n0 = (n: number) => Math.round(n).toLocaleString("es-CO");
const g0 = (n: number) => Math.round(n).toLocaleString("es-CO");

/** "Mis recetas" en la página de recetas: las propias (en la demo, del navegador) con enlace para registrar, editar o crear. */
export function MyRecipes({ initial, demo }: { initial: UserRecipe[]; demo: boolean }) {
  const [list, setList] = useState(initial);
  useEffect(() => { if (demo) try { const s = localStorage.getItem("bb.myRecipes"); if (s) setList(JSON.parse(s)); } catch { /* */ } }, [demo]);
  return (
    <section className="card p-4" aria-labelledby="mis-recetas-h">
      <div className="flex items-center justify-between gap-2">
        <h2 id="mis-recetas-h" className="flex items-center gap-2.5 font-extrabold text-ink"><span className="grid place-items-center size-9 shrink-0 rounded-xl bg-banana-soft text-banana-ink"><CookingPot weight="duotone" className="size-5" /></span>Mis recetas</h2>
        <Link href="/app/nutricion?nueva-receta=1" className="tap pressable inline-flex items-center gap-1 h-11 rounded-full px-3 text-sm font-bold text-banana-ink hover:bg-cream"><Plus weight="bold" className="size-4" />Nueva</Link>
      </div>
      {list.length ? (
        <ul className="mt-2 divide-y divide-line">
          {list.slice(0, 8).map((r) => (
            <li key={r.id} className="flex items-center gap-1">
              <div className="flex-1 min-w-0 py-2">
                <p className="font-semibold text-ink truncate">{r.name}</p>
                <p className="text-xs text-muted tabular-nums">{n0(r.kcal)} kcal por porción, P {g0(r.protein)} g, C {g0(r.carbs)} g, G {g0(r.fat)} g{r.servings > 1 ? `. Rinde ${r.servings}` : ""}</p>
              </div>
              <Link href={`/app/nutricion?receta=${encodeURIComponent(r.id)}`} aria-label={`Editar ${r.name}`} className="tap pressable grid place-items-center size-11 shrink-0 rounded-full text-muted hover:bg-cream hover:text-ink"><PencilSimple weight="bold" className="size-4" /></Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">Arma tu plato con los ingredientes que usas (por ejemplo, bagel, huevo y queso crema), guárdalo y regístralo en un toque.</p>
      )}
      <Link href="/app/nutricion?mis-recetas=1" className="tap pressable mt-2 inline-flex items-center gap-1 min-h-11 text-sm font-bold text-ink hover:text-banana-ink">Registrar una de mis recetas<CaretRight weight="bold" className="size-4" /></Link>
    </section>
  );
}
