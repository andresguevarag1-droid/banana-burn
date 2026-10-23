// Comida en Hoy: qué comió la persona en cada tiempo de comida y qué le recomienda Coach Banana para el siguiente,
// según lo que le falta del día y la hora local. Servidor (usa el recetario completo); al cliente solo llega el resumen.
import { SLOTS_MEAL, type MealItem, type Slot } from "./meals-shared";
import { flashPlan, MEAL_END } from "./recipes";

export type SlotSummary = { slot: Slot; label: string; items: string[]; kcal: number; protein: number; open: boolean };
export type FoodPick = { when: string; title: string; kcal: number; protein: number; portions: number; others: string[] };
export type HoyFood = { slots: SlotSummary[]; next: FoodPick | null };

const SHORT: Record<Slot, string> = { desayuno: "Desayuno", almuerzo: "Almuerzo", merienda: "Merienda", cena: "Cena" };

/** Resumen por tiempo de comida (en el orden del día). `open`: aún es buena hora para registrarlo hoy. */
export function slotSummaries(meals: MealItem[], hour: number): SlotSummary[] {
  return SLOTS_MEAL.map(({ id }) => {
    const m = meals.filter((x) => x.slot === id);
    return {
      slot: id, label: SHORT[id], items: m.map((x) => x.name),
      kcal: Math.round(m.reduce((a, x) => a + x.kcal, 0)), protein: Math.round(m.reduce((a, x) => a + x.protein, 0)),
      open: hour < MEAL_END[id],
    };
  });
}

export function hoyFood(a: { meals: MealItem[]; hour: number; todayIso: string; eaten: { kcal: number; protein: number }; target: { kcal: number; protein: number } }): HoyFood {
  const slots = slotSummaries(a.meals, a.hour);
  const logged = slots.filter((s) => s.items.length).map((s) => s.slot);
  const left = { kcal: Math.max(0, Math.round(a.target.kcal - a.eaten.kcal)), protein: Math.max(0, Math.round(a.target.protein - a.eaten.protein)) };
  const plan = flashPlan({ hour: a.hour, todayIso: a.todayIso, logged, left, target: a.target });
  // Meta cubierta antes de la noche: nada que recomendar hoy (la tarjeta lo dice); el menú de mañana vive en Nutrición.
  if (plan.mode === "hoy" && left.kcal < 150) return { slots, next: null };
  const today = plan.mode === "hoy" ? plan.today.menu.items : [];
  const items = today.length ? today : plan.tomorrow.menu.items;
  const first = items[0];
  if (!first) return { slots, next: null };
  const when = today.length ? `Para tu ${SHORT[first.r.slot].toLowerCase()}` : `Mañana, ${SHORT[first.r.slot].toLowerCase()}`;
  return {
    slots,
    next: { when, title: first.r.t, kcal: Math.round(first.kcal), protein: Math.round(first.p), portions: first.portions, others: items.slice(1, 3).map((x) => x.r.t) },
  };
}
