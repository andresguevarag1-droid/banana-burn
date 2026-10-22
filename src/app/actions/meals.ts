"use server";
import { revalidatePath } from "next/cache";
import { createClient, getViewer } from "@/lib/supabase/server";
import { crToday } from "@/lib/today";
import { FOOD_BY_ID } from "@/lib/foods";
import type { MealItem, Slot } from "@/lib/meals-shared";

const SLOTS: Slot[] = ["desayuno", "almuerzo", "merienda", "cena"];
const r1 = (n: number) => Math.round(n * 10) / 10;

export async function addMeal(input: { slot: Slot; foodId?: string; qty?: number; custom?: { name: string; kcal: number; protein: number } }): Promise<{ ok: boolean; item?: MealItem }> {
  const v = await getViewer();
  if (!v || !SLOTS.includes(input.slot)) return { ok: false };
  const qty = Math.min(10, Math.max(0.25, Number(input.qty) || 1));
  let row: Omit<MealItem, "id">;
  if (input.foodId) {
    const f = FOOD_BY_ID[input.foodId];
    if (!f) return { ok: false };
    row = { slot: input.slot, name: f.n, qty, kcal: Math.round(f.k * qty), protein: r1(f.pr * qty), carbs: r1(f.c * qty), fat: r1(f.f * qty), foodId: f.id };
  } else if (input.custom?.name) {
    const k = Math.min(5000, Math.max(0, Math.round(input.custom.kcal))), p = Math.min(400, Math.max(0, r1(input.custom.protein)));
    row = { slot: input.slot, name: input.custom.name.slice(0, 80), qty: 1, kcal: k, protein: p, carbs: 0, fat: 0 };
  } else return { ok: false };
  if (v.demo) return { ok: true, item: { ...row, id: `demo-${Date.now()}` } };
  const sb = await createClient();
  const { data, error } = await sb.from("meals").insert({ user_id: v.id, day: crToday().iso, name: row.name, qty: row.qty, kcal: row.kcal, protein: row.protein, carbs: row.carbs, fat: row.fat, slot: row.slot }).select("id").single();
  if (error || !data) return { ok: false };
  revalidatePath("/app");
  return { ok: true, item: { ...row, id: String(data.id) } };
}

export async function removeMeal(id: string): Promise<{ ok: boolean }> {
  const v = await getViewer();
  if (!v) return { ok: false };
  if (v.demo) return { ok: true };
  const sb = await createClient();
  const { error } = await sb.from("meals").delete().eq("id", Number(id)).eq("user_id", v.id);
  revalidatePath("/app");
  return { ok: !error };
}

export async function copyMeals(items: { slot: Slot; name: string; qty: number; kcal: number; protein: number; carbs: number; fat: number }[]): Promise<{ ok: boolean; items?: MealItem[] }> {
  const v = await getViewer();
  if (!v) return { ok: false };
  const clean = items.slice(0, 40).filter((i) => SLOTS.includes(i.slot)).map((i) => ({ slot: i.slot, name: String(i.name).slice(0, 80), qty: Number(i.qty) || 1, kcal: Math.max(0, Math.min(5000, Math.round(i.kcal))), protein: Math.max(0, Math.min(400, r1(i.protein))), carbs: Math.max(0, r1(i.carbs)), fat: Math.max(0, r1(i.fat)) }));
  if (v.demo) return { ok: true, items: clean.map((c, n) => ({ ...c, id: `demo-${Date.now()}-${n}` })) };
  const sb = await createClient();
  const { data, error } = await sb.from("meals").insert(clean.map((c) => ({ ...c, user_id: v.id, day: crToday().iso }))).select("id");
  if (error || !data) return { ok: false };
  revalidatePath("/app");
  return { ok: true, items: clean.map((c, n) => ({ ...c, id: String(data[n].id) })) };
}
