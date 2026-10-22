// Recetas ticas fáciles y altas en proteína (macros aproximados por porción).
export type Recipe = {
  id: string; t: string; e: string; slot: "desayuno" | "almuerzo" | "merienda" | "cena"; min: number; serves: number;
  kcal: number; p: number; c: number; f: number; tags: string[]; ing: string[]; steps: string[];
};

export const RECIPES: Recipe[] = [
  { id: "pinto-fit", t: "Gallo pinto fit con huevo", e: "🍳", slot: "desayuno", min: 10, serves: 1, kcal: 430, p: 28, c: 45, f: 14, tags: ["tico", "rápido"],
    ing: ["¾ taza de gallo pinto", "2 huevos + 2 claras", "¼ aguacate", "Salsa Lizano al gusto", "Chile dulce y cebolla picados"],
    steps: ["Sofríe chile y cebolla con spray de aceite.", "Agrega el pinto y calienta 2 min.", "Revuelve los huevos y claras aparte.", "Sirve con aguacate y Lizano."] },
  { id: "avena-proteina", t: "Avena proteica con banano", e: "🥣", slot: "desayuno", min: 5, serves: 1, kcal: 420, p: 32, c: 58, f: 7, tags: ["rápido", "pre-entreno"],
    ing: ["½ taza de avena", "1 scoop de proteína whey", "1 banano", "1 taza de leche descremada", "Canela"],
    steps: ["Cocina la avena con la leche 3 min.", "Apaga y mezcla la proteína (no la hiervas).", "Corona con banano en rodajas y canela."] },
  { id: "tortilla-queso", t: "Tortillas con huevo y queso tierno", e: "🫓", slot: "desayuno", min: 8, serves: 1, kcal: 390, p: 27, c: 30, f: 17, tags: ["tico"],
    ing: ["2 tortillas de maíz", "2 huevos", "40 g de queso tierno", "Pico de gallo"],
    steps: ["Calienta las tortillas en comal.", "Haz los huevos revueltos con el queso desmoronado.", "Rellena y acompaña con pico de gallo."] },
  { id: "casado-pollo", t: "Casado inteligente de pollo", e: "🍛", slot: "almuerzo", min: 25, serves: 1, kcal: 620, p: 52, c: 70, f: 12, tags: ["tico", "alto en proteína"],
    ing: ["180 g de pechuga", "½ taza de arroz", "½ taza de frijoles", "Ensalada de repollo y tomate", "¼ plátano maduro horneado"],
    steps: ["Sazona la pechuga con ajo, comino y achiote; ásala 6 min por lado.", "Hornea el plátano a 200 °C 15 min (sin freír).", "Sirve con arroz, frijoles y doble ensalada."] },
  { id: "arroz-pollo-fit", t: "Arroz con pollo fit", e: "🍚", slot: "almuerzo", min: 30, serves: 4, kcal: 450, p: 38, c: 52, f: 9, tags: ["tico", "meal prep"],
    ing: ["600 g de pechuga desmenuzada", "2 tazas de arroz", "1 taza de vegetales mixtos", "Achiote, consomé bajo en sodio", "Culantro"],
    steps: ["Cocina el arroz con achiote y consomé.", "Sofríe vegetales y agrega el pollo.", "Mezcla con el arroz y termina con culantro. Rinde 4 porciones para la semana."] },
  { id: "olla-light", t: "Olla de carne light", e: "🍲", slot: "almuerzo", min: 60, serves: 4, kcal: 380, p: 34, c: 38, f: 9, tags: ["tico", "sopa"],
    ing: ["600 g de posta de res sin grasa", "Yuca, chayote, elote, zanahoria", "Culantro y ajo"],
    steps: ["Cocina la carne en olla de presión 30 min.", "Agrega verduras y cocina 15 min más.", "Retira la grasa de la superficie antes de servir."] },
  { id: "tilapia-limon", t: "Tilapia al limón con yuca", e: "🐟", slot: "cena", min: 20, serves: 1, kcal: 430, p: 44, c: 40, f: 8, tags: ["alto en proteína"],
    ing: ["200 g de tilapia", "150 g de yuca cocida", "Limón, ajo y culantro", "Vegetales al vapor"],
    steps: ["Marina la tilapia con limón y ajo 10 min.", "Ásala 4 min por lado.", "Sirve con yuca y vegetales."] },
  { id: "picadillo-pollo", t: "Picadillo de chayote con pollo", e: "🥬", slot: "cena", min: 20, serves: 2, kcal: 300, p: 34, c: 18, f: 9, tags: ["tico", "bajo en carbos"],
    ing: ["2 chayotes picados", "250 g de pollo molido", "Chile dulce, cebolla, culantro", "2 tortillas"],
    steps: ["Dora el pollo molido.", "Agrega chayote y sofrito; cocina tapado 12 min.", "Sirve con tortillas."] },
  { id: "ceviche-fit", t: "Ceviche de corvina", e: "🍋", slot: "cena", min: 15, serves: 2, kcal: 220, p: 32, c: 10, f: 4, tags: ["tico", "fresco"],
    ing: ["300 g de corvina en cubos", "Jugo de 6 limones", "Cebolla morada, culantro, chile dulce", "Galletas de soda (opcional)"],
    steps: ["Cubre el pescado con limón y refrigera 30 min.", "Agrega los vegetales picados y sal.", "Sirve frío."] },
  { id: "batido-banana", t: "Batido Banana Burn", e: "🥤", slot: "merienda", min: 3, serves: 1, kcal: 320, p: 32, c: 38, f: 5, tags: ["rápido", "post-entreno"],
    ing: ["1 scoop de proteína", "1 banano", "1 taza de leche descremada", "1 cda de mantequilla de maní en polvo", "Hielo"],
    steps: ["Licúa todo 30 segundos.", "Tómalo en la hora después de entrenar."] },
  { id: "yogur-papaya", t: "Yogur griego con papaya", e: "🍈", slot: "merienda", min: 3, serves: 1, kcal: 210, p: 21, c: 26, f: 2, tags: ["rápido"],
    ing: ["200 g de yogur griego 0 %", "1 taza de papaya", "1 cda de granola"],
    steps: ["Sirve el yogur, corona con papaya y granola."] },
  { id: "huevo-taza", t: "Huevos en taza de microondas", e: "🥚", slot: "merienda", min: 3, serves: 1, kcal: 180, p: 20, c: 3, f: 9, tags: ["porción pequeña", "GLP-1"],
    ing: ["2 claras + 1 huevo", "20 g de queso tierno", "Espinaca picada"],
    steps: ["Bate todo en una taza.", "Microondas 60–90 s, revolviendo a la mitad."] },
  { id: "gelatina-proteina", t: "Gelatina con yogur griego", e: "🍮", slot: "merienda", min: 5, serves: 2, kcal: 120, p: 15, c: 10, f: 1, tags: ["porción pequeña", "GLP-1", "suave para náuseas"],
    ing: ["1 sobre de gelatina sin azúcar", "200 g de yogur griego 0 %"],
    steps: ["Prepara la gelatina con la mitad del agua.", "Cuando esté tibia, mezcla el yogur y refrigera 2 h."] },
  { id: "caldo-pollo", t: "Caldo de pollo con fideos de arroz", e: "🍜", slot: "cena", min: 25, serves: 2, kcal: 260, p: 30, c: 22, f: 4, tags: ["porción pequeña", "GLP-1", "suave para náuseas"],
    ing: ["250 g de pechuga", "Zanahoria, apio, culantro", "40 g de fideos de arroz", "Jengibre rallado"],
    steps: ["Hierve el pollo con verduras y jengibre 20 min.", "Desmenuza, agrega los fideos 3 min.", "Ideal en días de náusea: ligero y con proteína."] },
  { id: "pejibaye-atun", t: "Ensalada de atún y pejibaye", e: "🥗", slot: "almuerzo", min: 10, serves: 1, kcal: 410, p: 33, c: 32, f: 16, tags: ["tico", "sin cocinar"],
    ing: ["1 lata de atún en agua", "2 pejibayes en trozos", "Lechuga, tomate, pepino", "Limón y un toque de aceite de oliva"],
    steps: ["Mezcla todo en un bowl.", "Aliña con limón, sal y aceite."] },
];

/** Plan de comidas del día: elige una receta por tiempo de comida acercándose a las calorías y proteína meta. */
export function mealPlan(target: { kcal: number; protein: number }, seed = 0): Recipe[] {
  const slots = ["desayuno", "almuerzo", "merienda", "cena"] as const;
  let best: Recipe[] = [], bestScore = Infinity;
  const pools = slots.map((s) => RECIPES.filter((r) => r.slot === s));
  // búsqueda exhaustiva pequeña (≤ 3×4×2×3 combinaciones)
  const rot = <T,>(a: T[], k: number) => a.map((_, i) => a[(i + k) % a.length]);
  const [A, B, C, D] = pools.map((p, i) => rot(p, seed + i));
  for (const a of A) for (const b of B) for (const c of C) for (const d of D) {
    const k = a.kcal + b.kcal + c.kcal + d.kcal, p = a.p + b.p + c.p + d.p;
    const score = Math.abs(target.kcal - k) / target.kcal + Math.max(0, target.protein - p) / target.protein * 2;
    if (score < bestScore) { bestScore = score; best = [a, b, c, d]; }
  }
  return best;
}
