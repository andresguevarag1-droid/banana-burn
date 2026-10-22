// Tipos y utilidades de comidas (seguros para el cliente).
export type Slot = "desayuno" | "almuerzo" | "merienda" | "cena";
export const SLOTS_MEAL: { id: Slot; n: string; icon: string }[] = [
  { id: "desayuno", n: "Desayuno", icon: "sunrise" }, { id: "almuerzo", n: "Almuerzo", icon: "fork" }, { id: "merienda", n: "Merienda / pre-entreno", icon: "banana" }, { id: "cena", n: "Cena", icon: "moon" },
];
export type MealItem = { id: string; slot: Slot; name: string; qty: number; kcal: number; protein: number; carbs: number; fat: number; foodId?: string | null };

export const sumMeals = (m: MealItem[]) => m.reduce((a, x) => ({ kcal: a.kcal + x.kcal, protein: a.protein + x.protein, carbs: a.carbs + x.carbs, fat: a.fat + x.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
