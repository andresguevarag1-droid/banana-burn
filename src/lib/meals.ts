import { createClient, type Viewer } from "@/lib/supabase/server";
import { crToday } from "@/lib/today";

import type { MealItem, Slot } from "@/lib/meals-shared";
export * from "@/lib/meals-shared";

const prevDay = (iso: string) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); };

// Demo: lo que Andrés ya comió hoy (cuadra con Hoy y con Nutrición).
const DEMO_TODAY: MealItem[] = [
  { id: "d1", slot: "desayuno", name: "Gallo pinto fit con huevo", qty: 1, kcal: 430, protein: 28, carbs: 45, fat: 14 },
  { id: "d2", slot: "almuerzo", name: "Casado inteligente de pollo", qty: 1, kcal: 620, protein: 52, carbs: 70, fat: 12 },
  { id: "d3", slot: "merienda", name: "Yogur griego con papaya", qty: 1, kcal: 210, protein: 21, carbs: 26, fat: 2 },
];
const DEMO_YESTERDAY: MealItem[] = [
  { id: "y1", slot: "desayuno", name: "Avena proteica con banano", qty: 1, kcal: 420, protein: 32, carbs: 58, fat: 7 },
  { id: "y2", slot: "almuerzo", name: "Arroz con pollo fit", qty: 1, kcal: 450, protein: 38, carbs: 52, fat: 9 },
  { id: "y3", slot: "cena", name: "Tilapia al limón con yuca", qty: 1, kcal: 430, protein: 44, carbs: 40, fat: 8 },
];

export async function getMeals(v: Viewer) {
  const today = crToday().iso;
  if (v.demo) return { today: DEMO_TODAY, yesterday: DEMO_YESTERDAY, demo: true };
  const sb = await createClient();
  const { data } = await sb.from("meals").select("id,day,name,qty,kcal,protein,carbs,fat,slot").eq("user_id", v.id).in("day", [today, prevDay(today)]).order("id");
  const map = (r: Record<string, unknown>): MealItem => ({ id: String(r.id), slot: (r.slot as Slot) ?? "almuerzo", name: r.name as string, qty: Number(r.qty ?? 1), kcal: Number(r.kcal ?? 0), protein: Number(r.protein ?? 0), carbs: Number(r.carbs ?? 0), fat: Number(r.fat ?? 0) });
  const rows = data ?? [];
  return { today: rows.filter((r) => r.day === today).map(map), yesterday: rows.filter((r) => r.day !== today).map(map), demo: false };
}

