"use server";
import { revalidatePath } from "next/cache";
import { creditChallenges } from "@/lib/challenges-server";
import { createClient, getViewer, type Viewer } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { todayFor } from "@/lib/today";
import { CATALOG_BY_ID, cleanCustom, mealName, portion, type SavedFood } from "@/lib/foods-catalog";
import { localDayStartUtc } from "@/lib/foods-gamify";
import { MEAL_XP_DAILY_MAX, mealXpFor } from "@/lib/gamify";
import type { MealItem, Slot } from "@/lib/meals-shared";

const SLOTS: Slot[] = ["desayuno", "almuerzo", "merienda", "cena"];
const r1 = (n: number) => Math.round(n * 10) / 10;
type SB = Awaited<ReturnType<typeof createClient>>;

/**
 * Registrar mantiene la racha: la racha cuenta días con registro diario, así que la primera comida
 * del día crea ese registro (y da el XP de check-in, igual que anotar agua o pasos en Hoy).
 */
async function touchDay(v: Viewer, sb: SB, day: string) {
  const { data: existing } = await sb.from("daily_logs").select("day").eq("user_id", v.id).eq("day", day).maybeSingle();
  if (existing) return;
  const { error } = await sb.from("daily_logs").upsert({ user_id: v.id, day }, { onConflict: "user_id,day", ignoreDuplicates: true });
  if (!error) await sb.from("xp_events").insert({ user_id: v.id, kind: "checkin", xp: 15 });
}

/**
 * XP por registrar comida: lo otorga el servidor (service_role) con tope de MEAL_XP_DAILY_MAX por día local.
 * La base de datos tiene un segundo candado (0015_nutricion.sql). Devuelve el XP otorgado (0 si ya llegó al tope).
 */
async function awardMealXp(v: Viewer, day: string): Promise<{ xp: number; count: number }> {
  const admin = adminClient();
  if (!admin) return { xp: 0, count: 0 };
  const { count, error } = await admin.from("xp_events").select("*", { count: "exact", head: true }).eq("user_id", v.id).eq("kind", "meal").gte("created_at", localDayStartUtc(day, v.tz));
  if (error) return { xp: 0, count: 0 };
  const xp = mealXpFor(count ?? 0);
  if (!xp) return { xp: 0, count: count ?? 0 };
  // El trigger puede ignorar el insert en silencio (devuelve 0 filas): solo cuenta si quedó guardado.
  const { data, error: insErr } = await admin.from("xp_events").insert({ user_id: v.id, kind: "meal", xp }).select("id");
  if (insErr || !data?.length) return { xp: 0, count: count ?? 0 };
  return { xp, count: Math.min(MEAL_XP_DAILY_MAX, (count ?? 0) + 1) };
}

export type AddMealResult = { ok: boolean; item?: MealItem; xp?: number; xpCount?: number };

export async function addMeal(input: {
  slot: Slot; foodId?: string; qty?: number;
  custom?: { name: string; kcal: number; protein: number; carbs?: number; fat?: number; portion?: string };
}): Promise<AddMealResult> {
  const v = await getViewer();
  if (!v || !SLOTS.includes(input.slot)) return { ok: false };
  let row: Omit<MealItem, "id">;
  if (input.foodId) {
    const f = CATALOG_BY_ID[input.foodId];
    if (!f) return { ok: false };
    const p = portion(f, input.qty ?? 1);
    row = { slot: input.slot, name: mealName(f), qty: p.qty, kcal: p.kcal, protein: p.protein, carbs: p.carbs, fat: p.fat, foodId: f.id };
  } else if (input.custom) {
    const c = cleanCustom(input.custom);
    if (!c) return { ok: false };
    const p = portion({ k: c.kcal, pr: c.protein, c: c.carbs, f: c.fat }, input.qty ?? 1);
    row = { slot: input.slot, name: c.name, qty: p.qty, kcal: p.kcal, protein: p.protein, carbs: p.carbs, fat: p.fat };
  } else return { ok: false };
  if (v.demo) return { ok: true, item: { ...row, id: `demo-${Date.now()}` } };
  const sb = await createClient();
  const day = todayFor(v).iso;
  const { data, error } = await sb.from("meals").insert({ user_id: v.id, day, name: row.name, qty: row.qty, kcal: row.kcal, protein: row.protein, carbs: row.carbs, fat: row.fat, slot: row.slot }).select("id").single();
  if (error || !data) return { ok: false };
  const [award] = await Promise.all([awardMealXp(v, day).catch(() => ({ xp: 0, count: 0 })), touchDay(v, sb, day).catch(() => null)]);
  await creditChallenges(v).catch(() => null);
  revalidatePath("/app");
  return { ok: true, item: { ...row, id: String(data.id) }, xp: award.xp, xpCount: award.count };
}

export async function removeMeal(id: string): Promise<{ ok: boolean }> {
  const v = await getViewer();
  if (!v) return { ok: false };
  if (v.demo) return { ok: true };
  const sb = await createClient();
  const { error } = await sb.from("meals").delete().eq("id", Number(id)).eq("user_id", v.id);
  await creditChallenges(v).catch(() => null);
  revalidatePath("/app");
  return { ok: !error };
}

export async function copyMeals(items: { slot: Slot; name: string; qty: number; kcal: number; protein: number; carbs: number; fat: number }[]): Promise<{ ok: boolean; items?: MealItem[] }> {
  const v = await getViewer();
  if (!v) return { ok: false };
  const clean = items.slice(0, 40).filter((i) => SLOTS.includes(i.slot)).map((i) => ({ slot: i.slot, name: String(i.name).slice(0, 80), qty: Number(i.qty) || 1, kcal: Math.max(0, Math.min(5000, Math.round(i.kcal))), protein: Math.max(0, Math.min(400, r1(i.protein))), carbs: Math.max(0, r1(i.carbs)), fat: Math.max(0, r1(i.fat)) }));
  if (v.demo) return { ok: true, items: clean.map((c, n) => ({ ...c, id: `demo-${Date.now()}-${n}` })) };
  const sb = await createClient();
  const { data, error } = await sb.from("meals").insert(clean.map((c) => ({ ...c, user_id: v.id, day: todayFor(v).iso }))).select("id");
  if (error || !data) return { ok: false };
  await touchDay(v, sb, todayFor(v).iso).catch(() => null);
  await creditChallenges(v).catch(() => null);
  revalidatePath("/app");
  return { ok: true, items: clean.map((c, n) => ({ ...c, id: String(data[n].id) })) };
}

// ───────────── Mis comidas ─────────────

/** Guarda una comida personalizada para reusarla. En demo vive en el navegador (lo maneja el cliente). */
export async function saveFood(input: { name: string; portion?: string; kcal: number; protein?: number; carbs?: number; fat?: number }): Promise<{ ok: boolean; food?: SavedFood }> {
  const v = await getViewer();
  const c = cleanCustom(input);
  if (!v || !c) return { ok: false };
  if (v.demo) return { ok: true, food: { ...c, id: `demo-${Date.now()}` } };
  const sb = await createClient();
  const { data, error } = await sb.from("saved_foods").insert({ user_id: v.id, ...c }).select("id").single();
  if (error || !data) return { ok: false };
  revalidatePath("/app/nutricion");
  return { ok: true, food: { ...c, id: String(data.id) } };
}

export async function deleteSavedFood(id: string): Promise<{ ok: boolean }> {
  const v = await getViewer();
  if (!v) return { ok: false };
  if (v.demo) return { ok: true };
  const n = Number(id);
  if (!Number.isFinite(n)) return { ok: false };
  const sb = await createClient();
  const { error } = await sb.from("saved_foods").delete().eq("id", n).eq("user_id", v.id);
  revalidatePath("/app/nutricion");
  return { ok: !error };
}
