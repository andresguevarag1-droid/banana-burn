"use client";
import { useState, useTransition } from "react";
import { copyMeals } from "@/app/actions/meals";
import type { MealItem } from "@/lib/meals-shared";
import { ArrowCounterClockwise, Check, CircleNotch, Plus } from "@/components/icons";
import { safeAction } from "@/lib/action-client";

type NewItem = Omit<MealItem, "id">;

/** Agrega la receta (con sus macros completos) a las comidas de hoy. En la demo se guarda en este navegador, igual que Nutrición. */
export function AddRecipe({ item, dateKey, demo, base = [] }: { item: NewItem; dateKey: string; demo: boolean; base?: MealItem[] }) {
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");
  const [pending, start] = useTransition();
  function add() {
    start(async () => {
      const r = await safeAction(copyMeals([item]));
      if (r.ok && demo && r.items) {
        try {
          const key = `bb.meals.${dateKey}`, s = localStorage.getItem(key);
          localStorage.setItem(key, JSON.stringify([...(s ? (JSON.parse(s) as MealItem[]) : base), ...r.items]));
        } catch { /* */ }
      }
      setState(r.ok ? "ok" : "err");
    });
  }
  return (
    <button disabled={pending || state === "ok"} onClick={add} aria-live="polite"
      className={`tap pressable inline-flex items-center gap-1.5 h-11 px-4 rounded-full text-sm font-bold ${state === "ok" ? "bg-peel text-white" : "bg-ink text-white"}`}>
      {state === "ok" ? <><Check weight="bold" className="size-4" />Agregado a hoy</> : state === "err" ? <><ArrowCounterClockwise weight="bold" className="size-4" />No se guardó, reintentar</> : pending ? <><CircleNotch weight="bold" className="size-4 animate-spin" />Agregando</> : <><Plus weight="bold" className="size-4" />Agregar a mi día</>}
    </button>
  );
}
