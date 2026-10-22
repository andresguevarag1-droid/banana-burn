"use client";
import { useState, useTransition } from "react";
import { addMeal } from "@/app/actions/meals";
import type { Slot } from "@/lib/meals-shared";

export function AddRecipe({ name, kcal, protein, slot }: { name: string; kcal: number; protein: number; slot: Slot }) {
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");
  const [pending, start] = useTransition();
  return (
    <button disabled={pending || state === "ok"} onClick={() => start(async () => { const r = await addMeal({ slot, custom: { name, kcal, protein } }); setState(r.ok ? "ok" : "err"); })}
      className={`h-10 px-4 rounded-full text-sm font-bold transition ${state === "ok" ? "bg-peel text-white" : "bg-ink text-white"}`}>
      {state === "ok" ? "✓ Agregado a hoy" : state === "err" ? "Reintentar" : pending ? "…" : "+ Agregar a mi día"}
    </button>
  );
}
