"use client";
import { useEffect, useRef, useState } from "react";
import { nutritionUpsellDue, type NutritionUpsellGoal } from "@/lib/plan-access";
import { NutritionUpsell } from "./nutrition-upsell";

/** Límite local por cuenta: si no podemos guardar la frecuencia, no insistimos. */
export function WeeklyNutritionUpsell({ account, goal }: { account: string; goal: NutritionUpsellGoal }) {
  const [visible, setVisible] = useState(false);
  const claimed = useRef(false);
  useEffect(() => {
    if (claimed.current) return;
    claimed.current = true;
    try {
      const key = `bb:nutrition-upsell:${account}`;
      const now = Date.now();
      if (!nutritionUpsellDue(localStorage.getItem(key), now)) return;
      localStorage.setItem(key, String(now));
      setVisible(true);
    } catch { /* Sin almacenamiento no se muestra para respetar la frecuencia. */ }
  }, [account]);
  return visible ? <div className="mt-3"><NutritionUpsell goal={goal} compact /></div> : null;
}
