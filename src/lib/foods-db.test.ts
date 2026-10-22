import { describe, expect, test } from "vitest";
import { FOOD_CATS } from "@/lib/foods";
import { DB_FOODS } from "@/lib/foods-db";
import { byGrams, CATALOG, CATALOG_BY_ID, catItems, gramsOf, groupHits, kcalFromMacros, portion, searchFoods, searchScored, stem } from "@/lib/foods-catalog";
import { cleanRecipe, ingFrom, perServing, plateName, recipeAsFood, sumIngs } from "@/lib/user-recipes";

const ids = (q: string, cc?: string) => searchFoods(q, cc).map((f) => f.id);

describe("base de alimentos ampliada", () => {
  test("más de 1.200 alimentos, ids únicos y todas las categorías con datos", () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(1200);
    const all = CATALOG.map((f) => f.id);
    expect(new Set(all).size).toBe(all.length);
    for (const [c] of FOOD_CATS) expect(catItems(c).length, c).toBeGreaterThanOrEqual(8);
  });

  test("cada alimento nuevo trae porción con gramos y macros completos y realistas", () => {
    for (const f of DB_FOODS) {
      expect(f.gr, f.id).toBeGreaterThan(0);
      expect(f.p.trim(), f.id).not.toBe("");
      for (const v of [f.k, f.pr, f.c, f.f]) expect(Number.isFinite(v) && v >= 0, f.id).toBe(true);
      // Las kcal cuadran con 4/4/9 (salvo alcohol, que aporta 7 kcal/g, y alimentos casi sin calorías).
      // La fibra aporta ~2 kcal/g en vez de 4.
      const est = kcalFromMacros(f.pr, f.c, f.f) - 2 * (f.fi ?? 0);
      if (f.cat !== "alcohol" && f.k > 40) expect(Math.abs(est - f.k) / f.k, f.id).toBeLessThan(0.3);
    }
  });

  test("lenguaje neutro: sin emojis ni modismos de un solo país", () => {
    const txt = CATALOG.map((f) => `${f.n} ${f.p} ${f.al ?? ""}`).join("|");
    expect(txt).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(DB_FOODS.map((f) => `${f.n} ${f.al ?? ""}`).join("|")).not.toMatch(/(^|[^\p{L}])(tico|tica|pura vida|mae|Lizano|chile dulce|natilla|banano)(?![\p{L}])/iu);
    expect(txt).not.toMatch(/—/);
  });

  test("el desayuno del dueño existe y suma sus ingredientes", () => {
    const d = CATALOG_BY_ID["ds-bagelhuevocremavegana"];
    const parts = [byGrams(CATALOG_BY_ID["pn-bagelhuevo"], 105)!, byGrams(CATALOG_BY_ID["lq-crema"], 30)!, byGrams(CATALOG_BY_ID["vg-salchicha"], 75)!];
    expect(d.k).toBe(Math.round(parts.reduce((a, p) => a + p.kcal, 0)));
    expect(d.pr).toBeCloseTo(parts.reduce((a, p) => a + p.protein, 0), 0);
    expect(d.k).toBeGreaterThan(450);
    expect(d.k).toBeLessThan(700);
  });
});

describe("búsqueda", () => {
  test("sin acentos, singular o plural", () => {
    expect(stem("frijoles")).toBe(stem("frijol"));
    expect(stem("nueces")).toBe(stem("nuez"));
    expect(stem("postres")).toBe(stem("postre"));
    expect(stem("huevos")).toBe(stem("huevo"));
    expect(ids("platano")).toEqual(ids("plátano"));
    expect(ids("arandanos")[0]).toBe("fr-arandanos");
    expect(ids("tortillas de harina")[0]).toBe("pn-tortillaharina");
  });

  test("sinónimos de la región", () => {
    expect(ids("palta")).toContain("aguacate");
    expect(ids("poroto")).toContain("frijoles");
    expect(ids("caraotas")).toContain("frijoles");
    expect(ids("choclo")).toContain("gr-elote");
    expect(ids("cambur")).toContain("banano");
    expect(ids("salchicha vegetal").slice(0, 3)).toContain("vg-salchicha");
    expect(ids("philadelphia")).toContain("lq-crema");
    expect(ids("gaseosa")).toContain("a-refrescolata");
    expect(ids("soda")).toContain("gaseosa");
  });

  test("queso: exactos y que empiezan igual primero, y muchos más de 4", () => {
    const r = searchScored("Queso");
    expect(r.length).toBeGreaterThan(40);
    expect(r.slice(0, 10).every((h) => h.f.n.toLowerCase().startsWith("queso"))).toBe(true);
    expect(r.map((h) => h.f.id)).toContain("lq-crema");
  });

  test("varias palabras: el plato completo primero y después sus ingredientes", () => {
    const r = searchScored("bagel huevo queso");
    expect(r.slice(0, 3).map((h) => h.f.id)).toContain("ds-bagelhuevocrema");
    expect(r[0].full).toBe(true);
    const all = r.map((h) => h.f.id);
    for (const id of ["pn-bagel", "hv-entero", "lq-crema"]) expect(all, id).toContain(id);
    expect(all.indexOf("ds-bagelhuevocrema")).toBeLessThan(all.indexOf("lq-crema"));
  });

  test("agrupa: mejores resultados y luego por categoría", () => {
    const g = groupHits(searchScored("bagel huevo queso"));
    expect(g[0].key).toBe("top");
    const keys = g.slice(1).map((x) => x.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("lacteos");
    expect(keys).toContain("panes");
  });

  test("recetas propias aparecen en la búsqueda", () => {
    const mine = recipeAsFood({ id: "7", name: "Mi bagel del domingo", servings: 1, items: [], kcal: 583, protein: 28, carbs: 63, fat: 24 });
    expect(searchFoods("bagel domingo", null, [mine, ...CATALOG])[0].id).toBe("rc-7");
  });
});

describe("porciones y gramos", () => {
  test("por gramos usa los gramos de la porción", () => {
    const pollo = CATALOG_BY_ID["cp-pechugaplancha"]; // 100 g = 165 kcal
    expect(byGrams(pollo, 150)).toEqual({ grams: 150, kcal: 248, protein: 46.5, carbs: 0, fat: 5.4 });
    expect(byGrams(pollo, 0)).toBeNull();
    expect(byGrams({ k: 100, pr: 1, c: 1, f: 1 }, 50)).toBeNull();
    expect(portion(pollo, 1.5).kcal).toBe(248);
  });
  test("gramos escritos en la porción", () => {
    expect(gramsOf("100 g")).toBe(100);
    expect(gramsOf("1 vaso (250 ml)")).toBe(250);
    expect(gramsOf("1 plato")).toBeUndefined();
  });
});

describe("Mis recetas", () => {
  test("totales y por porción", () => {
    const items = [ingFrom(CATALOG_BY_ID["pn-bagelhuevo"]), ingFrom(CATALOG_BY_ID["lq-crema"]), ingFrom(CATALOG_BY_ID["vg-salchicha"], { grams: 150 })];
    const t = sumIngs(items);
    expect(t.kcal).toBe(items.reduce((a, i) => a + i.kcal, 0));
    expect(items[2].grams).toBe(150);
    expect(items[2].kcal).toBe(Math.round(CATALOG_BY_ID["vg-salchicha"].k * 2));
    const p = perServing(t, 2);
    expect(p.kcal).toBe(Math.round(t.kcal / 2));
    expect(plateName(items)).toBe("Bagel de huevo, queso crema y salchicha vegana");
  });

  test("el servidor recalcula los ingredientes del catálogo y acota los propios", () => {
    const r = cleanRecipe({ name: "  Mi   plato ", servings: 2, items: [
      { ref: "lq-crema", qty: 1, kcal: 1, protein: 999 },
      { ref: "cp-pechugaplancha", grams: 200 },
      { name: "Salsa de la casa", kcal: 99999, protein: -5, carbs: "12,5" },
      { name: "" },
    ] })!;
    expect(r.name).toBe("Mi plato");
    expect(r.items).toHaveLength(3);
    expect(r.items[0].kcal).toBe(CATALOG_BY_ID["lq-crema"].k);
    expect(r.items[1].kcal).toBe(330);
    expect(r.items[2]).toMatchObject({ kcal: 5000, protein: 0, carbs: 12.5 });
    expect(r.kcal).toBe(Math.round(sumIngs(r.items).kcal / 2));
    expect(cleanRecipe({ name: "x", items: [] })).toBeNull();
    expect(cleanRecipe({ name: "", items: [{ ref: "lq-crema" }] })).toBeNull();
    expect(cleanRecipe({ name: "x", servings: 99, items: [{ ref: "lq-crema" }] })!.servings).toBe(20);
  });
});
