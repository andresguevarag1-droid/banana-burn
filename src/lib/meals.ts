import { createClient, type Viewer } from "@/lib/supabase/server";
import { todayFor } from "@/lib/today";
import { localDayStartUtc } from "@/lib/foods-gamify";
import type { SavedFood } from "@/lib/foods-catalog";

import type { MealItem, Slot } from "@/lib/meals-shared";
export * from "@/lib/meals-shared";

const addDays = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const prevDay = (iso: string) => addDays(iso, -1);

// Demo: lo que Andrés ya comió hoy (cuadra con Hoy y con Nutrición).
const DEMO_TODAY: MealItem[] = [
  { id: "d1", slot: "desayuno", name: "Arroz con frijoles y huevos revueltos", qty: 1, kcal: 430, protein: 28, carbs: 45, fat: 14 },
  { id: "d2", slot: "almuerzo", name: "Pollo con arroz, frijoles y plátano", qty: 1, kcal: 620, protein: 52, carbs: 70, fat: 12 },
  { id: "d3", slot: "merienda", name: "Yogur griego con papaya", qty: 1, kcal: 210, protein: 21, carbs: 26, fat: 2 },
];
const DEMO_YESTERDAY: MealItem[] = [
  { id: "y1", slot: "desayuno", name: "Avena proteica con banana", qty: 1, kcal: 420, protein: 32, carbs: 58, fat: 7 },
  { id: "y2", slot: "almuerzo", name: "Arroz con pollo fit", qty: 1, kcal: 450, protein: 38, carbs: 52, fat: 9 },
  { id: "y3", slot: "cena", name: "Tilapia al limón con yuca", qty: 1, kcal: 430, protein: 44, carbs: 40, fat: 8 },
];
// Demo: kcal de los días anteriores (de ayer hacia atrás), con un día de pizza incluido: así se ve el balance semanal.
const DEMO_PAST_KCAL = [1300, 2650, 1850, 1900, 1750, 2050];

export async function getMeals(v: Viewer) {
  const today = todayFor(v).iso;
  if (v.demo) return { today: DEMO_TODAY, yesterday: DEMO_YESTERDAY, demo: true };
  const sb = await createClient();
  const { data } = await sb.from("meals").select("id,day,name,qty,kcal,protein,carbs,fat,slot").eq("user_id", v.id).in("day", [today, prevDay(today)]).order("id");
  const map = (r: Record<string, unknown>): MealItem => ({ id: String(r.id), slot: (r.slot as Slot) ?? "almuerzo", name: r.name as string, qty: Number(r.qty ?? 1), kcal: Number(r.kcal ?? 0), protein: Number(r.protein ?? 0), carbs: Number(r.carbs ?? 0), fat: Number(r.fat ?? 0) });
  const rows = data ?? [];
  return { today: rows.filter((r) => r.day === today).map(map), yesterday: rows.filter((r) => r.day !== today).map(map), demo: false };
}

export type NutritionExtras = {
  /** kcal por día de esta semana (lunes a ayer): comidas + lo anotado rápido en Hoy. */
  week: { day: string; kcal: number }[];
  /** Días con al menos una comida registrada (últimos 60, sin hoy), para la racha de registro y los logros. */
  mealDays: string[];
  /** Registros de hoy que ya dieron XP (tope diario en `MEAL_XP_DAILY_MAX`). */
  xpToday: number;
  /** "Mis comidas" guardadas (en demo viven en el navegador). */
  saved: SavedFood[];
};

/** Lo que solo necesita Nutrición: balance semanal, racha de registro, XP de comidas de hoy y "Mis comidas". */
export async function getNutritionExtras(v: Viewer): Promise<NutritionExtras> {
  const today = todayFor(v).iso;
  const monday = addDays(today, -((new Date(today + "T12:00:00").getDay() + 6) % 7));
  if (v.demo) {
    const past = DEMO_PAST_KCAL.map((kcal, i) => ({ day: addDays(today, -(i + 1)), kcal }));
    return { week: past.filter((d) => d.day >= monday), mealDays: past.map((d) => d.day), xpToday: DEMO_TODAY.length, saved: [] };
  }
  const sb = await createClient();
  const since = addDays(today, -60);
  const [{ data: dayRows }, { data: quick }, { data: saved }, { count: xpToday }] = await Promise.all([
    sb.from("meals").select("day,kcal").eq("user_id", v.id).gte("day", since).lt("day", today),
    sb.from("daily_logs").select("day,kcal").eq("user_id", v.id).gte("day", monday).lt("day", today),
    sb.from("saved_foods").select("id,name,portion,kcal,protein,carbs,fat").eq("user_id", v.id).order("created_at", { ascending: false }).limit(100),
    sb.from("xp_events").select("*", { count: "exact", head: true }).eq("user_id", v.id).eq("kind", "meal").gte("created_at", localDayStartUtc(today, v.tz)),
  ]);
  const kcalByDay = new Map<string, number>();
  for (const r of [...(dayRows ?? []), ...(quick ?? [])]) if ((r.day as string) >= monday) kcalByDay.set(r.day as string, (kcalByDay.get(r.day as string) ?? 0) + Number(r.kcal ?? 0));
  return {
    week: [...kcalByDay].map(([day, kcal]) => ({ day, kcal })),
    mealDays: [...new Set((dayRows ?? []).map((r) => r.day as string))],
    xpToday: xpToday ?? 0,
    // Si la migración 0015 aún no corre, la tabla no existe: "Mis comidas" queda vacía sin romper la página.
    saved: (saved ?? []).map((s) => ({ id: String(s.id), name: s.name as string, portion: (s.portion as string) ?? "1 porción", kcal: Number(s.kcal ?? 0), protein: Number(s.protein ?? 0), carbs: Number(s.carbs ?? 0), fat: Number(s.fat ?? 0) })),
  };
}
