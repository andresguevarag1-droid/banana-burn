// Catálogo completo para buscar y registrar: base LATAM + antojos + comida libre + restaurantes.
// Seguro para cliente y servidor (solo datos y funciones puras).
import { FOODS, type Food } from "@/lib/foods";
import { ANTOJOS, LIBRE } from "@/lib/foods-antojos";
import { CHAIN_BY_ID, CHAIN_FOODS, type ChainId } from "@/lib/foods-chains";

export const CHAIN_AS_FOOD: Food[] = CHAIN_FOODS.map((x) => ({
  id: x.id, n: x.n, p: x.p, k: x.k, pr: x.pr, c: x.c, f: x.f, g: "resto", cad: x.cadena, src: x.src,
  ...(x.best ? { best: true } : {}), ...(CHAIN_BY_ID[x.cadena].cc ? { cc: CHAIN_BY_ID[x.cadena].cc } : {}),
}));

export const CATALOG: Food[] = [...FOODS, ...ANTOJOS, ...CHAIN_AS_FOOD];
export const CATALOG_BY_ID: Record<string, Food> = Object.fromEntries([...CATALOG, ...LIBRE].map((f) => [f.id, f]));

/** Nombre con el que queda en el registro: los de cadena llevan la cadena para reconocerlos después. */
export function mealName(f: Food) {
  return f.cad ? `${f.n} (${CHAIN_BY_ID[f.cad as ChainId]?.n ?? f.cad})` : f.n;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
/** Porciones permitidas: de un cuarto a 10 veces la porción de referencia. */
export const clampQty = (q: unknown) => Math.min(10, Math.max(0.25, Math.round((Number(q) || 1) * 4) / 4));

/** Macros de `qty` porciones (igual en cliente y servidor). */
export function portion(f: Pick<Food, "k" | "pr" | "c" | "f">, qty: number) {
  const q = clampQty(qty);
  return { qty: q, kcal: Math.round(f.k * q), protein: r1(f.pr * q), carbs: r1(f.c * q), fat: r1(f.f * q) };
}

/** Normaliza para buscar: minúsculas, sin acentos ni signos (McDonald's = mcdonalds). */
export const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ ]+/g, "").replace(/\s+/g, " ").trim();

const HAY = new Map<string, { name: string; chain: string }>();
function hay(f: Food) {
  let h = HAY.get(f.id);
  if (!h) {
    const c = f.cad ? CHAIN_BY_ID[f.cad as ChainId] : null;
    h = { name: norm(`${f.n} ${f.p}`), chain: c ? norm([c.n, ...c.alias].join(" ")) : "" };
    HAY.set(f.id, h);
  }
  return h;
}
const countryRank = (f: Food, cc?: string) => (cc && f.cc?.includes(cc) ? 0 : f.cc ? 2 : 1);

/**
 * Busca por producto o por cadena ("big mac", "kfc", "kfc pechuga", "pizza dominos").
 * Cada palabra debe aparecer en el nombre o en la cadena. Orden: nombre que empieza igual,
 * después coincidencias en el nombre, después por cadena; el país del usuario va primero.
 */
export function searchFoods(q: string, country?: string | null, list: Food[] = CATALOG, limit = 80): Food[] {
  const nq = norm(q);
  if (!nq) return [];
  const words = nq.split(" ");
  const cc = country?.toUpperCase();
  const out: [Food, number, number][] = [];
  list.forEach((f, i) => {
    const h = hay(f);
    const all = `${h.name} ${h.chain}`;
    if (!words.every((w) => all.includes(w))) return;
    const inName = words.filter((w) => h.name.includes(w)).length;
    const score = h.name.startsWith(nq) ? 0 : inName === words.length ? 1 : inName > 0 ? 2 : 3;
    out.push([f, score * 3 + countryRank(f, cc), i]);
  });
  return out.sort((a, b) => a[1] - b[1] || a[2] - b[2]).slice(0, limit).map(([f]) => f);
}

/** Productos de una cadena (o de todas, en el orden de cadenas del país). */
export function chainItems(chain: ChainId | null, order: ChainId[]): Food[] {
  if (chain) return CHAIN_AS_FOOD.filter((f) => f.cad === chain);
  const pos = new Map(order.map((c, i) => [c, i]));
  return CHAIN_AS_FOOD.map((f, i) => [f, i] as const).sort(([a, i], [b, j]) => (pos.get(a.cad as ChainId) ?? 99) - (pos.get(b.cad as ChainId) ?? 99) || i - j).map(([f]) => f);
}

/** Comida guardada en "Mis comidas". */
export type SavedFood = { id: string; name: string; portion: string; kcal: number; protein: number; carbs: number; fat: number };

/** Limpia una comida personalizada (mismos límites que la base de datos). */
export function cleanCustom(x: { name?: unknown; portion?: unknown; kcal?: unknown; protein?: unknown; carbs?: unknown; fat?: unknown }) {
  const name = String(x.name ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  const num = (v: unknown, max: number) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0; };
  const kcal = Math.round(num(x.kcal, 5000));
  if (!name) return null;
  return { name, portion: String(x.portion ?? "").trim().slice(0, 40) || "1 porción", kcal, protein: r1(num(x.protein, 400)), carbs: r1(num(x.carbs, 1000)), fat: r1(num(x.fat, 500)) };
}
