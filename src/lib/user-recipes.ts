// "Mis recetas" y "Armar plato": ingredientes con gramos o porciones, totales y macros por porción.
// Seguro para cliente y servidor (solo tipos y funciones puras).
import type { Food } from "@/lib/foods";
import { byGrams, CATALOG_BY_ID, clampQty, portion } from "@/lib/foods-catalog";

/** Un ingrediente: referencia al catálogo (si viene de ahí), gramos o cantidad de porciones y sus macros. */
export type RecipeIng = { ref?: string; name: string; portion: string; qty: number; grams?: number; kcal: number; protein: number; carbs: number; fat: number };
/** Receta guardada. Macros POR PORCIÓN (`servings` porciones en total). */
export type UserRecipe = { id: string; name: string; servings: number; items: RecipeIng[]; kcal: number; protein: number; carbs: number; fat: number };
export type Totals = { kcal: number; protein: number; carbs: number; fat: number };

export const RECIPE_MAX_ITEMS = 30;
export const RECIPE_MAX_SERVINGS = 20;
export const RC = "rc-";
const r1 = (n: number) => Math.round(n * 10) / 10;
const fmtG = (g: number) => `${Math.round(g).toLocaleString("es-CO")} g`;

/** Ingrediente desde un alimento: por gramos si se dan (y el alimento los permite), si no por porciones. */
export function ingFrom(f: Food, opt: { qty?: number; grams?: number } = {}): RecipeIng {
  const g = opt.grams ? byGrams(f, opt.grams) : null;
  if (g) return { ref: f.id, name: f.n, portion: fmtG(g.grams), qty: 1, grams: g.grams, kcal: g.kcal, protein: g.protein, carbs: g.carbs, fat: g.fat };
  const p = portion(f, opt.qty ?? 1);
  return { ref: f.id, name: f.n, portion: f.p, qty: p.qty, kcal: p.kcal, protein: p.protein, carbs: p.carbs, fat: p.fat };
}

/** Texto corto de la cantidad: "85 g" o "1 unid. × 2". */
export const ingAmount = (i: RecipeIng) => (i.grams ? fmtG(i.grams) : i.qty === 1 ? i.portion : `${i.portion} × ${i.qty.toLocaleString("es-CO")}`);

export function sumIngs(items: RecipeIng[]): Totals {
  const t = items.reduce((a, i) => ({ kcal: a.kcal + i.kcal, protein: a.protein + i.protein, carbs: a.carbs + i.carbs, fat: a.fat + i.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  return { kcal: Math.round(t.kcal), protein: r1(t.protein), carbs: r1(t.carbs), fat: r1(t.fat) };
}

export function perServing(t: Totals, servings: number): Totals {
  const s = Math.max(1, Math.round(servings) || 1);
  return { kcal: Math.round(t.kcal / s), protein: r1(t.protein / s), carbs: r1(t.carbs / s), fat: r1(t.fat / s) };
}

/** Nombre automático del plato: "Bagel de huevo, queso crema y salchicha vegana". */
export function plateName(items: { name: string }[]) {
  const ns = items.map((i) => i.name.replace(/\s*\(.*?\)\s*/g, " ").trim());
  const lower = ns.map((n, i) => (i === 0 ? n : n.charAt(0).toLowerCase() + n.slice(1)));
  const txt = lower.length > 1 ? `${lower.slice(0, -1).join(", ")} y ${lower.at(-1)}` : lower[0] ?? "Mi plato";
  return txt.length > 80 ? txt.slice(0, 77).trimEnd() + "..." : txt;
}

/** La receta como alimento del buscador (1 porción = macros por porción). */
export const recipeAsFood = (r: UserRecipe): Food => ({
  id: RC + r.id, n: r.name, p: "1 porción", k: r.kcal, pr: r.protein, c: r.carbs, f: r.fat, g: "extra",
  al: r.items.map((i) => i.name).join(" ").slice(0, 300),
});

const num = (v: unknown, max: number) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0; };

/**
 * Limpia una receta que llega del cliente. Los ingredientes del catálogo se recalculan con los datos de la base
 * (el cliente no puede inflar ni cambiar sus macros); los propios (Mis comidas o escritos a mano) se acotan.
 */
export function cleanRecipe(x: { name?: unknown; servings?: unknown; items?: unknown }): Omit<UserRecipe, "id"> | null {
  const name = String(x.name ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  const servings = Math.min(RECIPE_MAX_SERVINGS, Math.max(1, Math.round(Number(x.servings) || 1)));
  if (!name || !Array.isArray(x.items)) return null;
  const items: RecipeIng[] = [];
  for (const raw of x.items.slice(0, RECIPE_MAX_ITEMS) as Record<string, unknown>[]) {
    if (!raw || typeof raw !== "object") continue;
    const ref = typeof raw.ref === "string" ? raw.ref.slice(0, 60) : undefined;
    const f = ref ? CATALOG_BY_ID[ref] : undefined;
    if (f) {
      const grams = Number(raw.grams) > 0 ? Number(raw.grams) : undefined;
      items.push(ingFrom(f, grams && f.gr ? { grams } : { qty: clampQty(raw.qty) }));
      continue;
    }
    const iname = String(raw.name ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
    if (!iname) continue;
    const grams = Number(raw.grams) > 0 ? Math.min(3000, Math.round(Number(raw.grams))) : undefined;
    items.push({
      ...(ref ? { ref } : {}), name: iname, portion: String(raw.portion ?? "").trim().slice(0, 40) || "1 porción", qty: clampQty(raw.qty), ...(grams ? { grams } : {}),
      kcal: Math.round(num(raw.kcal, 5000)), protein: r1(num(raw.protein, 400)), carbs: r1(num(raw.carbs, 1000)), fat: r1(num(raw.fat, 500)),
    });
  }
  if (!items.length) return null;
  const per = perServing(sumIngs(items), servings);
  return { name, servings, items, kcal: Math.min(5000, per.kcal), protein: Math.min(400, per.protein), carbs: Math.min(1000, per.carbs), fat: Math.min(500, per.fat) };
}

/** Lee una fila de la base (o del navegador en la demo) como receta. */
export function recipeFromRow(r: Record<string, unknown>): UserRecipe {
  return {
    id: String(r.id), name: String(r.name ?? ""), servings: Number(r.servings ?? 1) || 1,
    items: Array.isArray(r.ingredients) ? (r.ingredients as RecipeIng[]) : Array.isArray(r.items) ? (r.items as RecipeIng[]) : [],
    kcal: Number(r.kcal ?? 0), protein: Number(r.protein ?? 0), carbs: Number(r.carbs ?? 0), fat: Number(r.fat ?? 0),
  };
}
