// Catálogo completo para buscar y registrar: base LATAM + base ampliada (foods-db) + antojos + restaurantes.
// Seguro para cliente y servidor (solo datos y funciones puras).
import type { Food, FoodCat } from "@/lib/foods";
import { LIBRE } from "@/lib/foods-antojos";
import { ANTOJOS_FOODS, BASE_FOODS, DB_FOODS } from "@/lib/foods-db";
import { CHAIN_BY_ID, CHAIN_FOODS, CHAINS, type ChainId } from "@/lib/foods-chains";

export const CHAIN_AS_FOOD: Food[] = CHAIN_FOODS.map((x) => ({
  id: x.id, n: x.n, p: x.p, k: x.k, pr: x.pr, c: x.c, f: x.f, g: "resto", cat: "resto", cad: x.cadena, src: x.src,
  ...(x.best ? { best: true } : {}), ...(CHAIN_BY_ID[x.cadena].cc ? { cc: CHAIN_BY_ID[x.cadena].cc } : {}),
}));

export const CATALOG: Food[] = [...BASE_FOODS, ...ANTOJOS_FOODS, ...DB_FOODS, ...CHAIN_AS_FOOD];
export const CATALOG_BY_ID: Record<string, Food> = Object.fromEntries([...CATALOG, ...LIBRE].map((f) => [f.id, f]));

/** Nombre con el que queda en el registro: los de cadena llevan la cadena para reconocerlos después. */
export function mealName(f: Food) {
  return f.cad ? `${f.n} (${CHAIN_BY_ID[f.cad as ChainId]?.n ?? f.cad})` : f.n;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
/** Porciones permitidas: de un cuarto a 10 veces la porción de referencia. */
export const clampQty = (q: unknown) => Math.min(10, Math.max(0.25, Math.round((Number(q) || 1) * 4) / 4));
/** Gramos permitidos al registrar por peso. */
export const clampGrams = (g: unknown) => Math.min(3000, Math.max(1, Math.round(Number(String(g ?? "").replace(",", ".")) || 0)));

type Macros = Pick<Food, "k" | "pr" | "c" | "f">;

/** Macros de `qty` porciones (igual en cliente y servidor). */
export function portion(f: Macros, qty: number) {
  const q = clampQty(qty);
  return { qty: q, kcal: Math.round(f.k * q), protein: r1(f.pr * q), carbs: r1(f.c * q), fat: r1(f.f * q) };
}

/** Macros por gramos, para alimentos con gramos de porción conocidos (`gr`). Null si no se puede. */
export function byGrams(f: Macros & { gr?: number }, grams: number) {
  if (!f.gr || !(grams > 0)) return null;
  const g = clampGrams(grams), m = g / f.gr;
  return { grams: g, kcal: Math.round(f.k * m), protein: r1(f.pr * m), carbs: r1(f.c * m), fat: r1(f.f * m) };
}

/** Fibra y azúcar escaladas (si el alimento las trae). */
export const extrasFor = (f: { fi?: number; su?: number }, m: number) => ({ fiber: f.fi != null ? r1(f.fi * m) : null, sugar: f.su != null ? r1(f.su * m) : null });

/** Normaliza para buscar: minúsculas, sin acentos ni signos (McDonald's = mcdonalds). */
export const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ ]+/g, "").replace(/\s+/g, " ").trim();

// ───────────── Búsqueda ─────────────

const STOP = new Set(["de", "del", "con", "y", "e", "el", "la", "los", "las", "en", "a", "al", "un", "una", "o", "para", "por", "tipo", "mi"]);

/**
 * Raíz simple para comparar singular y plural, masculino y femenino:
 * frijoles = frijol, nueces = nuez, postres = postre, huevos = huevo, vegana = vegano.
 */
export function stem(w: string) {
  let s = w;
  if (s.length > 4 && s.endsWith("ces")) s = s.slice(0, -3) + "z";
  else if (s.length > 4 && /[aeiou][lnrdjy]es$/.test(s)) s = s.slice(0, -2);
  else if (s.length > 3 && s.endsWith("s") && !s.endsWith("ss")) s = s.slice(0, -1);
  if (s.length > 4 && /[ao]$/.test(s)) s = s.slice(0, -1);
  return s;
}

const words = (s: string) => norm(s).split(" ").filter((w) => w && !STOP.has(w));
const toks = (s: string) => words(s).map(stem);

/** Mismo alimento con otro nombre según el país. */
const SYN_GROUPS = [
  "palta aguacate", "frijol poroto caraota habichuela frejol", "maiz choclo elote mazorca", "platano banana cambur guineo banano",
  "vegano vegana vegetal veggie vegetariano plant", "refresco gaseosa soda", "camote batata boniato", "papa patata", "durazno melocoton",
  "fresa frutilla", "pina anana", "arveja guisante chicharo", "mani cacahuate cacahuete", "calabaza zapallo auyama ahuyama ayote",
  "jugo zumo", "pastel queque bizcocho ponque tarta pay", "pancake panqueque hotcake panqueca tortita", "sandwich sanduche emparedado sanguche",
  "tocino tocineta bacon panceta", "salchicha vienesa frankfurt", "yogur yogurt yoghurt", "batido licuado malteada smoothie shake",
  "galleta galletita", "hamburguesa burger", "palomita cotufa pochoclo crispeta canchita cabrita poporopo popcorn", "betabel remolacha betarraga",
  "ejote vainita chaucha", "champinon hongo seta", "maracuya parchita chinola", "papaya lechosa", "toronja pomelo", "arandano blueberry",
  "jitomate tomate", "pimiento pimenton morron chiltoma", "calabacin zucchini zapallito", "cerdo chancho puerco cochino", "ajonjoli sesamo",
  "requeson ricota ricotta", "cafe tinto", "trago shot", "res vacuno ternera", "camaron gamba langostino",
].map((g) => g.split(" ").map(stem));
const SYN = new Map<string, string[]>();
for (const g of SYN_GROUPS) for (const w of g) SYN.set(w, [...new Set([...(SYN.get(w) ?? []), ...g])]);

type Hay = { name: string; nameT: string[]; altT: string[]; chainT: string[]; portT: string[] };
const HAY = new Map<string, Hay>();
function hay(f: Food): Hay {
  let h = HAY.get(f.id);
  if (!h) {
    const c = f.cad ? CHAIN_BY_ID[f.cad as ChainId] : null;
    h = { name: norm(f.n), nameT: toks(f.n), altT: f.al ? toks(f.al) : [], chainT: c ? toks([c.n, ...c.alias].join(" ")) : [], portT: toks(f.p) };
    // Las búsquedas guardadas en "Mis comidas" y "Mis recetas" cambian de id: no se guardan en caché.
    if (!f.id.startsWith("my-") && !f.id.startsWith("rc-")) HAY.set(f.id, h);
  }
  return h;
}

/** 3 = palabra igual, 2 = empieza igual, 1 = la contiene (4+ letras), 0 = nada. */
function level(q: string, list: string[]) {
  let best = 0;
  const alts = SYN.get(q) ?? [q];
  for (const a of alts) for (const t of list) {
    if (t === a) return 3;
    if (t.startsWith(a)) best = Math.max(best, 2);
    else if (a.length >= 4 && t.includes(a)) best = Math.max(best, 1);
  }
  return best;
}

// Si la búsqueda nombra una cadena ("kfc", "pizza dominos"), solo se muestran coincidencias completas.
const CHAIN_TOKENS = new Set(CHAINS.flatMap((c) => toks([c.n, ...c.alias].join(" "))));

const countryRank = (f: Food, cc?: string) => (cc && f.cc?.includes(cc) ? 0 : f.cc ? 2 : 1);

export type Hit = {
  f: Food;
  /** Coincide con todas las palabras buscadas. */
  full: boolean;
  /** 0 = el nombre empieza igual, 1 = todas las palabras exactas en el nombre, 2 = en el nombre, 3 = por otro nombre, 4 = por cadena o porción. */
  tier: number;
};

/**
 * Busca por producto, ingrediente o cadena: sin acentos, singular o plural, sinónimos regionales (palta = aguacate)
 * y varias palabras ("bagel huevo queso"). Primero lo que coincide con todo (y lo que empieza igual), luego lo que
 * coincide con parte de la búsqueda (útil para armar un plato con sus ingredientes). Si nombras una cadena, solo esa.
 */
export function searchScored(q: string, country?: string | null, list: Food[] = CATALOG, limit = 200): Hit[] {
  const nq = norm(q);
  const Q = [...new Set(toks(q))];
  if (!nq || !Q.length) return [];
  const strict = Q.some((t) => CHAIN_TOKENS.has(t));
  const phrase = words(q).join(" ");
  const cc = country?.toUpperCase();
  const out: [Hit, number[]][] = [];
  list.forEach((f, i) => {
    const h = hay(f);
    let matched = 0, inName = 0, exactName = 0, viaAlt = 0;
    for (const t of Q) {
      const ln = level(t, h.nameT), la = level(t, h.altT);
      const lo = ln || la ? 0 : Math.max(level(t, h.chainT), level(t, h.portT));
      if (ln || la || lo) matched++;
      if (ln) inName++;
      if (ln === 3) exactName++;
      else if (!ln && la) viaAlt++;
    }
    const full = matched === Q.length;
    if (!full && (strict || Q.length === 1 || inName + viaAlt === 0)) return;
    const tier = h.name.startsWith(nq) || (phrase && h.name.startsWith(phrase)) ? 0 : exactName === Q.length ? 1 : inName === Q.length ? 2 : inName + viaAlt === Q.length ? 3 : 4;
    const extra = Math.max(0, h.nameT.length - inName);
    // Coincidencia parcial: primero si el nombre empieza con una palabra buscada, luego si está en el nombre, luego por otro nombre.
    const pTier = full ? tier : Q.some((t) => h.nameT[0] && level(t, h.nameT.slice(0, 1)) >= 2) ? 0 : inName ? 1 : 2;
    out.push([{ f, full, tier }, [full ? 0 : 1, Q.length - matched, pTier, countryRank(f, cc), extra, i]]);
  });
  out.sort((a, b) => { for (let k = 0; k < a[1].length; k++) if (a[1][k] !== b[1][k]) return a[1][k] - b[1][k]; return 0; });
  return out.slice(0, limit).map(([h]) => h);
}

export function searchFoods(q: string, country?: string | null, list: Food[] = CATALOG, limit = 80): Food[] {
  return searchScored(q, country, list, limit).map((h) => h.f);
}

/**
 * Agrupa resultados para mostrarlos: primero las mejores coincidencias (hasta `top`) y después el resto
 * por categoría, en el orden de su mejor resultado. "Mis comidas" y "Mis recetas" van como su propia categoría.
 */
export function groupHits(hits: Hit[], top = 8): { key: string; items: Food[] }[] {
  const best = hits.filter((h) => h.full && h.tier <= 1).slice(0, top);
  const bestIds = new Set(best.map((h) => h.f.id));
  const groups = new Map<string, Food[]>();
  for (const h of hits) {
    if (bestIds.has(h.f.id)) continue;
    const k = catKey(h.f);
    groups.set(k, [...(groups.get(k) ?? []), h.f]);
  }
  // Las categorías salen en el orden de su mejor resultado (el Map conserva el orden de inserción).
  const rest = [...groups].map(([key, items]) => ({ key, items }));
  return [...(best.length ? [{ key: "top", items: best.map((h) => h.f) }] : []), ...rest];
}

/** Categoría para agrupar (incluye las del usuario). */
export function catKey(f: Food): string {
  if (f.id.startsWith("rc-")) return "mis-recetas";
  if (f.id.startsWith("my-")) return "mis-comidas";
  return f.cat ?? (f.cad ? "resto" : "rapida");
}

/** Alimentos de una categoría, primero los del país del usuario. */
export function catItems(cat: FoodCat, country?: string | null): Food[] {
  const cc = country?.toUpperCase();
  return CATALOG.map((f, i) => [f, i] as const).filter(([f]) => f.cat === cat).sort(([a, i], [b, j]) => countryRank(a, cc) - countryRank(b, cc) || i - j).map(([f]) => f);
}

/** Productos de una cadena (o de todas, en el orden de cadenas del país). */
export function chainItems(chain: ChainId | null, order: ChainId[]): Food[] {
  if (chain) return CHAIN_AS_FOOD.filter((f) => f.cad === chain);
  const pos = new Map(order.map((c, i) => [c, i]));
  return CHAIN_AS_FOOD.map((f, i) => [f, i] as const).sort(([a, i], [b, j]) => (pos.get(a.cad as ChainId) ?? 99) - (pos.get(b.cad as ChainId) ?? 99) || i - j).map(([f]) => f);
}

/** Comida guardada en "Mis comidas". */
export type SavedFood = { id: string; name: string; portion: string; kcal: number; protein: number; carbs: number; fat: number };

/** Gramos de una porción escrita como "100 g", "250 ml" o "1 taza (240 g)". */
export function gramsOf(portionText: string): number | undefined {
  const m = /(\d+(?:[.,]\d+)?)\s*(g|ml)\b/i.exec(portionText);
  const g = m ? Number(m[1].replace(",", ".")) : NaN;
  return g > 0 ? g : undefined;
}

/** Limpia una comida personalizada (mismos límites que la base de datos). */
export function cleanCustom(x: { name?: unknown; portion?: unknown; kcal?: unknown; protein?: unknown; carbs?: unknown; fat?: unknown }) {
  const name = String(x.name ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  const num = (v: unknown, max: number) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0; };
  const kcal = Math.round(num(x.kcal, 5000));
  if (!name) return null;
  return { name, portion: String(x.portion ?? "").trim().slice(0, 40) || "1 porción", kcal, protein: r1(num(x.protein, 400)), carbs: r1(num(x.carbs, 1000)), fat: r1(num(x.fat, 500)) };
}

/** kcal estimadas con 4/4/9 cuando solo se escriben los macros. */
export const kcalFromMacros = (p: number, c: number, f: number) => Math.round((p || 0) * 4 + (c || 0) * 4 + (f || 0) * 9);
