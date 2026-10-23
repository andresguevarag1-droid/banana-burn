// Recetas latinas fáciles y altas en proteína (macros aproximados por porción, valores de referencia tipo USDA).
// Los ingredientes llevan cantidad y unidad para mostrarlos ya escalados a la porción de cada persona.
export type Unit = "g" | "ml" | "taza" | "cda" | "cdta" | "unid" | "lata" | "scoop" | "sobre" | "diente";
/** q: cantidad para la receta completa (rinde `serves`). Sin q, el ingrediente va "al gusto". n1: singular (unid). whole: no partir (huevos). */
export type Ing = { q?: number; u?: Unit; n: string; n1?: string; whole?: boolean };
export type Slot = "desayuno" | "almuerzo" | "merienda" | "cena";
type RecipeData = {
  id: string; t: string; icon: string; slot: Slot; min: number; serves: number;
  kcal: number; p: number; c: number; f: number; tags: string[]; ing: Ing[]; steps: string[];
};
/** `ix`: ingredientes con cantidad; `ing`: el texto de la receta completa (para listados y el panel). */
export type Recipe = Omit<RecipeData, "ing"> & { ix: Ing[]; ing: string[] };

const DATA: RecipeData[] = [
  { id: "pinto-fit", t: "Arroz con frijoles y huevos revueltos", icon: "egg", slot: "desayuno", min: 10, serves: 1, kcal: 430, p: 28, c: 45, f: 14, tags: ["latino", "rápido"],
    ing: [{ q: 0.75, u: "taza", n: "arroz con frijoles ya cocidos" }, { q: 2, u: "unid", n: "huevos", n1: "huevo", whole: true }, { q: 2, u: "unid", n: "claras", n1: "clara", whole: true }, { q: 0.25, u: "unid", n: "aguacate" }, { q: 0.5, u: "unid", n: "pimiento picado" }, { q: 0.25, u: "unid", n: "cebolla picada" }, { n: "Salsa inglesa al gusto" }],
    steps: ["Sofríe el pimiento y la cebolla con spray de aceite.", "Agrega el arroz con frijoles y calienta 2 min.", "Revuelve los huevos y las claras aparte.", "Sirve con el aguacate y unas gotas de salsa inglesa."] },
  { id: "avena-proteina", t: "Avena proteica con banana", icon: "banana", slot: "desayuno", min: 5, serves: 1, kcal: 420, p: 32, c: 58, f: 7, tags: ["rápido", "pre-entreno"],
    ing: [{ q: 0.5, u: "taza", n: "avena" }, { q: 1, u: "scoop", n: "proteína whey" }, { q: 1, u: "unid", n: "bananas", n1: "banana" }, { q: 1, u: "taza", n: "leche descremada" }, { n: "Canela al gusto" }],
    steps: ["Cocina la avena con la leche 3 min.", "Apaga y mezcla la proteína (no la hiervas).", "Corona con la banana en rodajas y canela."] },
  { id: "tortilla-queso", t: "Tortillas con huevo y queso fresco", icon: "bread", slot: "desayuno", min: 8, serves: 1, kcal: 390, p: 27, c: 30, f: 17, tags: ["latino"],
    ing: [{ q: 2, u: "unid", n: "tortillas de maíz", n1: "tortilla de maíz", whole: true }, { q: 2, u: "unid", n: "huevos", n1: "huevo", whole: true }, { q: 40, u: "g", n: "queso fresco" }, { q: 0.5, u: "taza", n: "pico de gallo" }],
    steps: ["Calienta las tortillas en un sartén sin aceite.", "Haz los huevos revueltos con el queso desmoronado.", "Rellena y acompaña con pico de gallo."] },
  { id: "arepa-pollo", t: "Arepa fit con pollo y aguacate", icon: "bread", slot: "desayuno", min: 20, serves: 1, kcal: 495, p: 42, c: 49, f: 14, tags: ["Venezuela", "Colombia"],
    ing: [{ q: 60, u: "g", n: "harina de maíz precocida" }, { q: 100, u: "g", n: "pechuga cocida y desmenuzada" }, { q: 0.25, u: "unid", n: "aguacate" }, { q: 30, u: "g", n: "queso blanco bajo en grasa" }, { n: "Sal y cilantro al gusto" }],
    steps: ["Mezcla la harina con agua tibia y sal hasta lograr una masa suave; forma la arepa.", "Ásala en sartén antiadherente 5 min por lado.", "Ábrela y rellena con el pollo, el aguacate machacado y el queso."] },
  { id: "casado-pollo", t: "Pollo con arroz, frijoles y plátano", icon: "fork", slot: "almuerzo", min: 25, serves: 1, kcal: 620, p: 52, c: 70, f: 12, tags: ["latino", "alto en proteína"],
    ing: [{ q: 180, u: "g", n: "pechuga" }, { q: 0.5, u: "taza", n: "arroz cocido" }, { q: 0.5, u: "taza", n: "frijoles cocidos" }, { q: 2, u: "taza", n: "ensalada de repollo y tomate" }, { q: 0.25, u: "unid", n: "plátano maduro" }],
    steps: ["Sazona la pechuga con ajo, comino y achiote; ásala 6 min por lado.", "Hornea el plátano a 200 °C 15 min (sin freír).", "Sirve con arroz, frijoles y doble ensalada."] },
  { id: "tacos-pollo", t: "Tacos de pollo fit", icon: "fork", slot: "almuerzo", min: 20, serves: 1, kcal: 460, p: 50, c: 42, f: 8, tags: ["México", "alto en proteína"],
    ing: [{ q: 3, u: "unid", n: "tortillas de maíz", n1: "tortilla de maíz", whole: true }, { q: 150, u: "g", n: "pechuga en tiras" }, { q: 0.25, u: "unid", n: "cebolla blanca picada" }, { q: 3, u: "cda", n: "salsa verde" }, { q: 1, u: "unid", n: "limones", n1: "limón" }, { n: "Cilantro al gusto" }],
    steps: ["Sazona el pollo con comino, ajo en polvo y sal; dóralo 6-8 min.", "Calienta las tortillas en un sartén sin aceite.", "Sirve el pollo con cebolla, cilantro, salsa verde y limón."] },
  { id: "arroz-pollo-fit", t: "Arroz con pollo fit", icon: "grains", slot: "almuerzo", min: 30, serves: 4, kcal: 450, p: 38, c: 52, f: 9, tags: ["latino", "meal prep"],
    ing: [{ q: 600, u: "g", n: "pechuga desmenuzada" }, { q: 2, u: "taza", n: "arroz crudo" }, { q: 1, u: "taza", n: "vegetales mixtos" }, { q: 2, u: "taza", n: "caldo de pollo bajo en sodio" }, { q: 1, u: "cdta", n: "achiote o cúrcuma" }, { n: "Cilantro al gusto" }],
    steps: ["Cocina el arroz con el caldo y el achiote.", "Sofríe los vegetales y agrega el pollo.", "Mezcla con el arroz y termina con cilantro."] },
  { id: "quinoa-pollo", t: "Quinoa con pollo y verduras", icon: "grains", slot: "almuerzo", min: 25, serves: 1, kcal: 505, p: 54, c: 39, f: 12, tags: ["Perú", "Bolivia", "alto en proteína"],
    ing: [{ q: 0.75, u: "taza", n: "quinoa cocida" }, { q: 150, u: "g", n: "pechuga en cubos" }, { q: 1, u: "taza", n: "verduras picadas (zanahoria, zucchini, pimiento)" }, { q: 1, u: "cdta", n: "aceite de oliva" }, { q: 1, u: "diente", n: "ajo" }],
    steps: ["Dora el pollo con el ajo y el aceite 6 min.", "Agrega las verduras y saltea 4 min.", "Mezcla con la quinoa caliente y ajusta la sal."] },
  { id: "olla-light", t: "Sopa de res con verduras", icon: "soup", slot: "almuerzo", min: 60, serves: 4, kcal: 380, p: 34, c: 38, f: 9, tags: ["latino", "sopa", "meal prep"],
    ing: [{ q: 600, u: "g", n: "carne de res magra en trozos" }, { q: 300, u: "g", n: "yuca" }, { q: 2, u: "unid", n: "chayotes o calabacines", n1: "chayote o calabacín" }, { q: 2, u: "unid", n: "elotes en trozos", n1: "elote en trozos" }, { q: 2, u: "unid", n: "zanahorias", n1: "zanahoria" }, { n: "Cilantro y ajo al gusto" }],
    steps: ["Cocina la carne en olla de presión 30 min.", "Agrega las verduras y cocina 15 min más.", "Retira la grasa de la superficie antes de servir."] },
  { id: "pejibaye-atun", t: "Ensalada de atún, papa y aguacate", icon: "avocado", slot: "almuerzo", min: 15, serves: 1, kcal: 360, p: 31, c: 35, f: 11, tags: ["latino", "sin cocinar"],
    ing: [{ q: 1, u: "lata", n: "atún en agua" }, { q: 150, u: "g", n: "papa cocida en cubos" }, { q: 0.25, u: "unid", n: "aguacate" }, { q: 2, u: "taza", n: "lechuga, tomate y pepino" }, { q: 1, u: "cdta", n: "aceite de oliva" }, { n: "Limón y sal al gusto" }],
    steps: ["Mezcla todo en un tazón.", "Aliña con limón, sal y el aceite."] },
  { id: "tilapia-limon", t: "Tilapia al limón con yuca", icon: "fish", slot: "cena", min: 20, serves: 1, kcal: 430, p: 44, c: 40, f: 8, tags: ["alto en proteína"],
    ing: [{ q: 200, u: "g", n: "tilapia" }, { q: 150, u: "g", n: "yuca cocida" }, { q: 1, u: "taza", n: "vegetales al vapor" }, { q: 1, u: "unid", n: "limones", n1: "limón" }, { n: "Ajo y cilantro al gusto" }],
    steps: ["Marina la tilapia con limón y ajo 10 min.", "Ásala 4 min por lado.", "Sirve con la yuca y los vegetales."] },
  { id: "lomo-saltado", t: "Lomo saltado ligero", icon: "fork", slot: "cena", min: 25, serves: 1, kcal: 500, p: 44, c: 48, f: 15, tags: ["Perú", "alto en proteína"],
    ing: [{ q: 150, u: "g", n: "lomo de res en tiras" }, { q: 0.5, u: "unid", n: "cebolla morada en plumas" }, { q: 1, u: "unid", n: "tomates en gajos", n1: "tomate en gajos" }, { q: 0.5, u: "taza", n: "arroz cocido" }, { q: 100, u: "g", n: "papa en gajos horneada" }, { q: 1, u: "cdta", n: "aceite" }, { q: 1, u: "cda", n: "salsa de soya baja en sodio" }],
    steps: ["Hornea la papa en gajos a 210 °C 20 min (en vez de freírla).", "Saltea la carne a fuego muy alto con el aceite 2 min.", "Agrega cebolla, tomate y soya; 1 min más y sirve con arroz y papa."] },
  { id: "pupusas-fit", t: "Pupusas fit de frijol y queso", icon: "bread", slot: "cena", min: 25, serves: 1, kcal: 440, p: 23, c: 60, f: 12, tags: ["El Salvador"],
    ing: [{ q: 60, u: "g", n: "harina de maíz para tortillas" }, { q: 60, u: "g", n: "queso mozzarella bajo en grasa" }, { q: 0.25, u: "taza", n: "frijoles molidos" }, { q: 1, u: "taza", n: "curtido de repollo" }],
    steps: ["Mezcla la harina con agua tibia hasta lograr una masa suave; haz 2 bolitas.", "Abre cada una, rellena con frijol y queso, y ciérrala aplanando.", "Cocina en sartén sin aceite 4 min por lado y sirve con curtido."] },
  { id: "picadillo-pollo", t: "Picadillo de chayote con pollo", icon: "leaf", slot: "cena", min: 20, serves: 2, kcal: 300, p: 34, c: 18, f: 9, tags: ["latino", "bajo en carbos"],
    ing: [{ q: 2, u: "unid", n: "chayotes picados", n1: "chayote picado" }, { q: 250, u: "g", n: "pollo molido" }, { q: 0.5, u: "unid", n: "pimiento picado" }, { q: 0.5, u: "unid", n: "cebolla picada" }, { q: 2, u: "unid", n: "tortillas de maíz", n1: "tortilla de maíz", whole: true }, { n: "Cilantro al gusto" }],
    steps: ["Dora el pollo molido.", "Agrega el chayote y el sofrito; cocina tapado 12 min.", "Sirve con tortillas."] },
  { id: "ceviche-fit", t: "Ceviche de pescado", icon: "fish", slot: "cena", min: 15, serves: 2, kcal: 220, p: 32, c: 10, f: 4, tags: ["Perú", "latino", "sin cocinar"],
    ing: [{ q: 300, u: "g", n: "corvina u otro pescado blanco en cubos" }, { q: 6, u: "unid", n: "limones (el jugo)", n1: "limón (el jugo)" }, { q: 0.5, u: "unid", n: "cebolla morada picada" }, { q: 0.5, u: "unid", n: "pimiento picado" }, { n: "Cilantro y sal al gusto" }],
    steps: ["Cubre el pescado con el jugo de limón y refrigera 20-30 min.", "Agrega los vegetales picados y la sal.", "Sirve frío."] },
  { id: "caldo-pollo", t: "Caldo de pollo con fideos de arroz", icon: "soup", slot: "cena", min: 25, serves: 2, kcal: 260, p: 30, c: 22, f: 4, tags: ["porción pequeña", "GLP-1", "suave para náuseas"],
    ing: [{ q: 250, u: "g", n: "pechuga" }, { q: 1, u: "unid", n: "zanahorias", n1: "zanahoria" }, { q: 1, u: "unid", n: "ramas de apio", n1: "rama de apio" }, { q: 40, u: "g", n: "fideos de arroz" }, { q: 1, u: "cdta", n: "jengibre rallado" }, { n: "Cilantro al gusto" }],
    steps: ["Hierve el pollo con las verduras y el jengibre 20 min.", "Desmenuza el pollo y agrega los fideos 3 min.", "Ideal en días de náusea: ligero y con proteína."] },
  { id: "batido-banana", t: "Batido Banana Burn", icon: "banana", slot: "merienda", min: 3, serves: 1, kcal: 320, p: 32, c: 38, f: 5, tags: ["rápido", "post-entreno"],
    ing: [{ q: 1, u: "scoop", n: "proteína whey" }, { q: 1, u: "unid", n: "bananas", n1: "banana" }, { q: 1, u: "taza", n: "leche descremada" }, { q: 1, u: "cda", n: "mantequilla de maní en polvo" }, { n: "Hielo al gusto" }],
    steps: ["Licúa todo 30 segundos.", "Tómalo en la hora después de entrenar."] },
  { id: "yogur-papaya", t: "Yogur griego con papaya", icon: "fruit", slot: "merienda", min: 3, serves: 1, kcal: 210, p: 21, c: 26, f: 2, tags: ["rápido"],
    ing: [{ q: 200, u: "g", n: "yogur griego 0 %" }, { q: 1, u: "taza", n: "papaya picada" }, { q: 1, u: "cda", n: "granola" }],
    steps: ["Sirve el yogur y corona con la papaya y la granola."] },
  { id: "huevo-taza", t: "Huevos en taza de microondas", icon: "egg", slot: "merienda", min: 3, serves: 1, kcal: 180, p: 20, c: 3, f: 9, tags: ["porción pequeña", "GLP-1"],
    ing: [{ q: 2, u: "unid", n: "claras", n1: "clara", whole: true }, { q: 1, u: "unid", n: "huevos", n1: "huevo", whole: true }, { q: 20, u: "g", n: "queso fresco" }, { q: 0.5, u: "taza", n: "espinaca picada" }],
    steps: ["Bate todo en una taza.", "Microondas de 60 a 90 s, revolviendo a la mitad."] },
  { id: "gelatina-proteina", t: "Gelatina con yogur griego", icon: "drop", slot: "merienda", min: 5, serves: 2, kcal: 120, p: 15, c: 10, f: 1, tags: ["porción pequeña", "GLP-1", "suave para náuseas"],
    ing: [{ q: 1, u: "sobre", n: "gelatina sin azúcar" }, { q: 200, u: "g", n: "yogur griego 0 %" }],
    steps: ["Prepara la gelatina con la mitad del agua.", "Cuando esté tibia, mezcla el yogur y refrigera 2 h."] },
];

// ---------- Cantidades escaladas ----------
// (RECIPES se arma al final del archivo, cuando ya existen los formateadores.)

const FRAC: Record<number, string> = { 0.25: "¼", 0.5: "½", 0.75: "¾" };
const UNIT: Record<Exclude<Unit, "unid">, [string, string]> = {
  g: ["g", "g"], ml: ["ml", "ml"], taza: ["taza", "tazas"], cda: ["cda", "cdas"], cdta: ["cdta", "cdtas"], lata: ["lata", "latas"], scoop: ["scoop", "scoops"], sobre: ["sobre", "sobres"], diente: ["diente", "dientes"],
};

/** Redondeo amigable: gramos a 5 g, ml a 10 ml, tazas y cucharas a ¼, piezas a ¼ (o enteras si no se parten: huevos, tortillas). */
export function roundQty(q: number, u: Unit = "unid", whole = false) {
  const step = u === "g" ? 5 : u === "ml" ? 10 : u === "taza" || u === "cda" || u === "cdta" ? 0.25 : whole || u === "diente" || u === "sobre" ? 1 : u === "unid" ? 0.25 : 0.5;
  return Math.max(step, Math.round(q / step) * step);
}

/** 1.5 → "1½", 0.25 → "¼", 180 → "180". */
export function fmtQty(n: number) {
  const int = Math.floor(n + 1e-9), fr = Math.round((n - int) * 4) / 4;
  if (fr === 1) return String(int + 1);
  const f = FRAC[fr] ?? "";
  return int ? `${int.toLocaleString("es-CO")}${f}` : f || "0";
}

/** Texto del ingrediente para `portions` porciones (la receta completa rinde `serves`). */
export function ingText(i: Ing, portions: number, serves = 1) {
  if (i.q == null) return i.n;
  const q = roundQty((i.q * portions) / serves, i.u, i.whole);
  const n = fmtQty(q);
  if (!i.u || i.u === "unid") return `${n} ${q <= 1 ? (i.n1 ?? i.n) : i.n}`;
  const [one, many] = UNIT[i.u];
  return `${n} ${q > 1 ? many : one} de ${i.n}`;
}

export const RECIPES: Recipe[] = DATA.map(({ ing, ...r }) => ({ ...r, ix: ing, ing: ing.map((i) => ingText(i, r.serves, r.serves)) }));

// ---------- Menú del día ----------

export type MenuItem = { r: Recipe; portions: number; kcal: number; p: number; c: number; f: number };
export type Menu = { items: MenuItem[]; kcal: number; p: number; c: number; f: number };
const SLOTS: Slot[] = ["desayuno", "almuerzo", "merienda", "cena"];
const q4 = (n: number) => Math.round(n * 4) / 4;

/** Macros de una receta para cierta cantidad de porciones. */
export function portionOf(r: Recipe, portions: number): MenuItem {
  return { r, portions, kcal: Math.round(r.kcal * portions), p: Math.round(r.p * portions), c: Math.round(r.c * portions), f: Math.round(r.f * portions) };
}

/**
 * Menú para lo que FALTA hoy: una receta por cada tiempo de comida que aún no se registró, con porciones
 * (en cuartos) que cuadren con las calorías restantes, priorizando no quedarse corto de proteína.
 */
export function planMenu(left: { kcal: number; protein: number }, open: Slot[] = SLOTS, seed = 0, opts: { extra?: boolean; pick?: number } = {}): Menu {
  let slots = SLOTS.filter((s) => open.includes(s));
  // Si falta mucho para pocos tiempos de comida, suma una merienda extra en vez de servir porciones dobles.
  if ((opts.extra ?? true) && slots.length && left.kcal / slots.length > 750 && !slots.includes("merienda")) slots = SLOTS.filter((s) => s === "merienda" || slots.includes(s));
  const empty: Menu = { items: [], kcal: 0, p: 0, c: 0, f: 0 };
  if (!slots.length || left.kcal < 150) return empty;
  const rot = <T,>(a: T[], k: number) => a.map((_, i) => a[(i + k) % a.length]);
  // `pick`: solo las primeras N recetas de cada tiempo tras rotar con la semilla (así cambia el menú de un día a otro).
  const pools = slots.map((s, i) => { const all = rot(RECIPES.filter((r) => r.slot === s), seed + i); return opts.pick ? all.slice(0, opts.pick) : all; });
  let best: Menu = empty, bestScore = Infinity;
  const tryCombo = (combo: Recipe[]) => {
    const k = combo.reduce((a, r) => a + r.kcal, 0);
    const portions = Math.min(2, Math.max(0.5, q4(left.kcal / k)));
    const items = combo.map((r) => portionOf(r, portions));
    const m: Menu = { items, kcal: items.reduce((a, x) => a + x.kcal, 0), p: items.reduce((a, x) => a + x.p, 0), c: items.reduce((a, x) => a + x.c, 0), f: items.reduce((a, x) => a + x.f, 0) };
    const lp = Math.max(1, left.protein);
    const score = Math.abs(left.kcal - m.kcal) / left.kcal + (Math.max(0, left.protein - m.p) / lp) * 2 + (Math.max(0, m.p - left.protein) / lp) * 0.3;
    if (score < bestScore) { bestScore = score; best = m; }
  };
  const walk = (i: number, acc: Recipe[]) => { if (i === pools.length) return tryCombo(acc); for (const r of pools[i]) walk(i + 1, [...acc, r]); };
  walk(0, []);
  return best;
}

// ---------- Menú flash según la hora ----------

/** Hasta qué hora (local, 0-24) tiene sentido sugerir cada tiempo de comida hoy. */
export const MEAL_END: Record<Slot, number> = { desayuno: 11, almuerzo: 15, merienda: 18, cena: 22 };
/** Desde esta hora el menú principal pasa a ser el de mañana completo. */
export const TOMORROW_FROM = 20;
/** Reparto de la meta diaria por tiempo de comida (para armar el menú de mañana). */
export const MEAL_SHARE: Record<Slot, number> = { desayuno: 0.25, almuerzo: 0.35, merienda: 0.15, cena: 0.25 };

/** Hora local con decimales (14:30 = 14.5) en la zona `tz`; sin zona válida, la del dispositivo. */
export function localHour(now = new Date(), tz?: string) {
  if (tz) {
    try {
      const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).formatToParts(now).map((x) => [x.type, x.value]));
      const h = (Number(p.hour) % 24) + Number(p.minute) / 60;
      if (Number.isFinite(h)) return h;
    } catch { /* zona inválida: usa la del dispositivo */ }
  }
  return now.getHours() + now.getMinutes() / 60;
}

export const nextDay = (iso: string) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };

/** Semilla estable por fecha: el mismo día siempre da el mismo menú (no cambia al recargar). */
export function dateSeed(iso: string) {
  let h = 2166136261;
  for (const ch of iso) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 997;
}

/** Tiempos de comida que todavía se pueden sugerir hoy: no registrados y con su horario aún abierto. */
export function slotsLeftToday(hour: number, logged: Slot[]): Slot[] {
  if (hour >= TOMORROW_FROM) return [];
  return SLOTS.filter((s) => hour < MEAL_END[s] && !logged.includes(s));
}

export type FlashPlan = {
  /** "hoy": el menú principal es para lo que falta hoy; "manana": ya es tarde y el principal es mañana completo. */
  mode: "hoy" | "manana";
  /** Tiempos que quedan hoy y su menú (vacío en modo "manana" o si ya no queda ninguno). */
  today: { slots: Slot[]; menu: Menu };
  /** Mañana: tiempos que hoy ya no cubre (siempre incluye el desayuno pasadas las 11:00) con su meta proporcional. */
  tomorrow: { iso: string; slots: Slot[]; menu: Menu };
};

/**
 * Menú flash según la hora local: lo que falta hoy se reparte solo entre los tiempos que quedan,
 * y los que ya pasaron se proponen para mañana (para comprar o dejar listo). Determinista por fecha.
 */
export function flashPlan(a: { hour: number; todayIso: string; logged: Slot[]; left: { kcal: number; protein: number }; target: { kcal: number; protein: number } }): FlashPlan {
  const mode = a.hour >= TOMORROW_FROM ? "manana" : "hoy";
  const todaySlots = slotsLeftToday(a.hour, a.logged);
  const extra = a.hour < MEAL_END.merienda;
  const todayMenu = todaySlots.length ? planMenu(a.left, todaySlots, dateSeed(a.todayIso), { extra, pick: 3 }) : { items: [], kcal: 0, p: 0, c: 0, f: 0 };
  const tSlots = mode === "manana" ? SLOTS : SLOTS.filter((s) => !todaySlots.includes(s));
  const share = tSlots.reduce((x, s) => x + MEAL_SHARE[s], 0);
  const iso = nextDay(a.todayIso);
  const tMenu = tSlots.length ? planMenu({ kcal: Math.round(a.target.kcal * share), protein: Math.round(a.target.protein * share) }, tSlots, dateSeed(iso), { extra: false, pick: 3 }) : { items: [], kcal: 0, p: 0, c: 0, f: 0 };
  return { mode, today: { slots: todaySlots, menu: todayMenu }, tomorrow: { iso, slots: tSlots, menu: tMenu } };
}
