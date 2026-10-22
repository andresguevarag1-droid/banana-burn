"use client";
import { useState, useTransition } from "react";
import { addMeal } from "@/app/actions/meals";
import type { Slot } from "@/lib/meals-shared";
import { ArrowCounterClockwise, Check, CircleNotch, Plus } from "@/components/icons";

export function AddRecipe({ name, kcal, protein, slot }: { name: string; kcal: number; protein: number; slot: Slot }) {
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");
  const [pending, start] = useTransition();
  return (
    <button disabled={pending || state === "ok"} onClick={() => start(async () => { const r = await addMeal({ slot, custom: { name, kcal, protein } }); setState(r.ok ? "ok" : "err"); })}
      className={`tap pressable inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-sm font-bold ${state === "ok" ? "bg-peel text-white" : "bg-ink text-white"}`}>
      {state === "ok" ? <><Check weight="bold" className="size-4" />Agregado a hoy</> : state === "err" ? <><ArrowCounterClockwise weight="bold" className="size-4" />Reintentar</> : pending ? <><CircleNotch weight="bold" className="size-4 animate-spin" />Agregando</> : <><Plus weight="bold" className="size-4" />Agregar a mi día</>}
    </button>
  );
}
