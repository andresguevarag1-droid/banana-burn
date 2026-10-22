// Utilidades para escribir la base de alimentos en filas compactas.
// Ingredientes: valores por 100 g (referencia tipo USDA / etiqueta nutricional) y la porción típica en gramos.
// Platos preparados: valores por porción, siempre marcados `src: "aprox"` (dependen de la receta).
import type { Food, FoodCat, FoodGroup } from "@/lib/foods";

/** Extras opcionales de una fila: países donde es típico y otros nombres con los que se busca. */
export type X = { cc?: string[]; al?: string };

/** [id, nombre, porción, gramos de la porción, kcal, proteína, carbos, grasa, fibra, azúcar, extras] con macros POR 100 g. */
export type R100 = [id: string, n: string, p: string, gr: number, k: number, pr: number, c: number, f: number, fi?: number | null, su?: number | null, x?: X];
/** Igual que R100 pero con los macros de la PORCIÓN completa. */
export type RP = R100;

export const CAT_GROUP: Record<FoodCat, FoodGroup> = {
  desayunos: "tica", platos: "tica", resto: "resto", rapida: "rapida", dulces: "rapida", carnes: "prot", mar: "prot", huevos: "prot", lacteos: "prot",
  vegano: "prot", panes: "carb", granos: "carb", legumbres: "carb", verduras: "extra", frutas: "fruta", nueces: "extra", salsas: "extra",
  bebidas: "bebida", alcohol: "bebida", suplementos: "prot",
};

const r1 = (n: number) => Math.round(n * 10) / 10;

function build(cat: FoodCat, [id, n, p, gr, k, pr, c, f, fi, su, x]: R100, m: number, src?: "aprox"): Food {
  return {
    id, n, p, gr, k: Math.round(k * m), pr: r1(pr * m), c: r1(c * m), f: r1(f * m), g: CAT_GROUP[cat], cat,
    ...(fi != null ? { fi: r1(fi * m) } : {}), ...(su != null ? { su: r1(su * m) } : {}),
    ...(x?.cc ? { cc: x.cc } : {}), ...(x?.al ? { al: x.al } : {}), ...(src ? { src } : {}),
  };
}

/** Filas con macros por 100 g: calcula la porción a partir de sus gramos. */
export const per100 = (cat: FoodCat, rows: R100[]): Food[] => rows.map((r) => build(cat, r, r[3] / 100));

/** Filas con macros por porción (platos y productos armados). Se marcan como aproximados. */
export const perPortion = (cat: FoodCat, rows: RP[]): Food[] => rows.map((r) => build(cat, r, 1, "aprox"));

/** Plato armado con ingredientes de la base: [id, nombre, porción, [[idIngrediente, gramos], ...], extras]. */
export type Combo = [id: string, n: string, p: string, parts: [string, number][], x?: X];

/** Suma los ingredientes (por gramo) para obtener los macros del plato. Falla si falta un ingrediente. */
export function compose(cat: FoodCat, byId: Record<string, Food>, rows: Combo[]): Food[] {
  return rows.map(([id, n, p, parts, x]) => {
    const t = { gr: 0, k: 0, pr: 0, c: 0, f: 0, fi: 0, su: 0 };
    let hasFi = false, hasSu = false;
    for (const [pid, g] of parts) {
      const it = byId[pid];
      if (!it || !it.gr) throw new Error(`Plato ${id}: falta el ingrediente ${pid} o sus gramos`);
      const m = g / it.gr;
      t.gr += g; t.k += it.k * m; t.pr += it.pr * m; t.c += it.c * m; t.f += it.f * m;
      if (it.fi != null) { hasFi = true; t.fi += it.fi * m; }
      if (it.su != null) { hasSu = true; t.su += it.su * m; }
    }
    return {
      id, n, p, gr: Math.round(t.gr), k: Math.round(t.k), pr: r1(t.pr), c: r1(t.c), f: r1(t.f), g: CAT_GROUP[cat], cat, src: "aprox" as const,
      ...(hasFi ? { fi: r1(t.fi) } : {}), ...(hasSu ? { su: r1(t.su) } : {}),
      ...(x?.cc ? { cc: x.cc } : {}), ...(x?.al ? { al: x.al } : {}),
    };
  });
}
