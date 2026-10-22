import { createClient, type Viewer } from "@/lib/supabase/server";
import { crToday } from "@/lib/today";

import type { MealItem, Slot } from "@/lib/meals-shared";
export * from "@/lib/meals-shared";

const prevDay = (iso: string) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); };

export async function getMeals(v: Viewer) {
  const today = crToday().iso;
  if (v.demo) return { today: [] as MealItem[], yesterday: [] as MealItem[], demo: true };
  const sb = await createClient();
  const { data } = await sb.from("meals").select("id,day,name,qty,kcal,protein,carbs,fat,slot").eq("user_id", v.id).in("day", [today, prevDay(today)]).order("id");
  const map = (r: Record<string, unknown>): MealItem => ({ id: String(r.id), slot: (r.slot as Slot) ?? "almuerzo", name: r.name as string, qty: Number(r.qty ?? 1), kcal: Number(r.kcal ?? 0), protein: Number(r.protein ?? 0), carbs: Number(r.carbs ?? 0), fat: Number(r.fat ?? 0) });
  const rows = data ?? [];
  return { today: rows.filter((r) => r.day === today).map(map), yesterday: rows.filter((r) => r.day !== today).map(map), demo: false };
}

