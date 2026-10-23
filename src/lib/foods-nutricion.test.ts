import { describe, expect, it } from "vitest";
import { FOODS } from "@/lib/foods";
import { ANTOJOS, LIBRE } from "@/lib/foods-antojos";
import { CATALOG, CATALOG_BY_ID, chainItems, clampQty, cleanCustom, mealName, portion, searchFoods } from "@/lib/foods-catalog";
import { CHAINS, CHAIN_FOODS, CHAIN_FOOD_BY_ID, betterChoice, chainsForCountry } from "@/lib/foods-chains";
import { localDayStartUtc, mealStreak, nutritionBadges, overMessage, stepsFor, weeklyBalance } from "@/lib/foods-gamify";
import { MEAL_XP, MEAL_XP_DAILY_MAX, mealXpFor } from "@/lib/gamify";

describe("base de restaurantes", () => {
  it("tiene entre 120 y 260 productos, ids únicos y todas las cadenas pedidas", () => {
    expect(CHAIN_FOODS.length).toBeGreaterThanOrEqual(120);
    expect(CHAIN_FOODS.length).toBeLessThanOrEqual(260);
    const ids = [...FOODS, ...ANTOJOS, ...LIBRE, ...CHAIN_FOODS].map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CHAINS) expect(CHAIN_FOODS.filter((f) => f.cadena === c.id).length).toBeGreaterThanOrEqual(8);
  });

  it("los macros cuadran con las calorías (4/4/9) en un margen razonable", () => {
    const off = [...CHAIN_FOODS, ...[...FOODS, ...ANTOJOS].filter((f) => !/cerveza|imperial|vino|trago|coctel|michelada/i.test(f.id))].filter((f) => {
      const est = f.pr * 4 + f.c * 4 + f.f * 9;
      return f.k > 50 && Math.abs(est - f.k) / f.k > 0.25;
    }).map((f) => `${f.id}: ${f.k} vs ${Math.round(f.pr * 4 + f.c * 4 + f.f * 9)}`);
    expect(off).toEqual([]);
  });

  it("cada producto marca su fuente y cada cadena tiene una opción ligera", () => {
    for (const f of CHAIN_FOODS) expect(["oficial", "aprox"]).toContain(f.src);
    for (const c of CHAINS) expect(CHAIN_FOODS.some((f) => f.cadena === c.id && f.best)).toBe(true);
  });

  it("los combos suman sus partes", () => {
    const combo = CHAIN_FOOD_BY_ID["mcd-combobigmac"];
    const parts = ["mcd-bigmac", "mcd-papasmedianas", "mcd-coca"].map((id) => CHAIN_FOOD_BY_ID[id]);
    expect(combo.k).toBe(parts.reduce((a, p) => a + p.k, 0));
    expect(combo.pr).toBeCloseTo(parts.reduce((a, p) => a + p.pr, 0), 5);
  });

  it("Pollo Campero va primero en Guatemala; en otros países se respeta el orden base", () => {
    expect(chainsForCountry("gt")[0].id).toBe("campero");
    expect(chainsForCountry("MX")[0].id).toBe("mcd");
    expect(chainItems("kfc", []).every((f) => f.cad === "kfc")).toBe(true);
  });

  it("sugiere la mejor elección de la misma cadena, sin insistir si ya es ligera", () => {
    const b = betterChoice({ id: "kfc-pechugacrispy", cadena: "kfc", k: 530 });
    expect(b?.cadena).toBe("kfc");
    expect(b!.k).toBeLessThan(530);
    expect(betterChoice({ id: "subway-pollo", cadena: "subway", k: 310, best: true })).toBeNull();
    expect(betterChoice({ id: "pollo", k: 248 })).toBeNull();
  });
});

describe("búsqueda", () => {
  it("encuentra productos por nombre (sin importar acentos ni mayúsculas)", () => {
    expect(searchFoods("big mac")[0].id).toBe("mcd-bigmac");
    expect(searchFoods("CRUNCHWRAP")[0].id).toBe("tacobell-crunchwrap");
    expect(searchFoods("platano").some((f) => f.id === "platano")).toBe(true);
  });

  it("encuentra por cadena y por cadena + producto", () => {
    const kfc = searchFoods("kfc");
    expect(kfc.length).toBeGreaterThan(10);
    expect(kfc.every((f) => f.cad === "kfc")).toBe(true);
    expect(searchFoods("mcdonald's nuggets").every((f) => f.cad === "mcd" && /nuggets/i.test(f.n))).toBe(true);
    expect(searchFoods("pizza dominos").every((f) => f.cad === "dominos")).toBe(true);
    expect(searchFoods("campero pechuga").map((f) => f.id)).toContain("campero-pechuga");
  });

  it("prioriza lo del país del usuario y lo que empieza igual", () => {
    const sv = searchFoods("pupusas", "SV");
    expect(sv[0].cc).toContain("SV");
    expect(searchFoods("pizza")[0].n.toLowerCase().startsWith("pizza")).toBe(true);
    expect(searchFoods("   ")).toEqual([]);
  });

  it("incluye antojos y comida variable", () => {
    for (const q of ["tacos de la calle", "cerveza", "refresco", "pan dulce", "helado", "empanada"]) expect(searchFoods(q).length).toBeGreaterThan(0);
  });
});

describe("porciones", () => {
  it("escala kcal y macros con redondeo estable", () => {
    expect(portion({ k: 580, pr: 25, c: 45, f: 34 }, 1.5)).toEqual({ qty: 1.5, kcal: 870, protein: 37.5, carbs: 67.5, fat: 51 });
    expect(portion({ k: 300, pr: 12, c: 36, f: 12 }, 3).kcal).toBe(900);
  });

  it("limita la porción entre ¼ y 10 y la redondea a cuartos", () => {
    expect(clampQty(0)).toBe(1);
    expect(clampQty(0.1)).toBe(0.25);
    expect(clampQty(50)).toBe(10);
    expect(clampQty("1.3")).toBe(1.25);
  });

  it("comida libre: tres tamaños con kcal crecientes", () => {
    expect(LIBRE.map((f) => f.size)).toEqual(["chica", "mediana", "grande"]);
    expect(LIBRE[0].k).toBeLessThan(LIBRE[1].k);
    expect(LIBRE[1].k).toBeLessThan(LIBRE[2].k);
    for (const f of LIBRE) expect(CATALOG_BY_ID[f.id]).toBeDefined();
    expect(CATALOG.some((f) => f.id.startsWith("libre-"))).toBe(false); // no aparece en listas ni búsqueda
  });

  it("los de restaurante se guardan con el nombre de la cadena", () => {
    expect(mealName(CATALOG_BY_ID["mcd-bigmac"])).toBe("Big Mac (McDonald's)");
    expect(mealName(CATALOG_BY_ID["pollo"])).toBe("Pechuga de pollo");
  });

  it("limpia comidas personalizadas", () => {
    expect(cleanCustom({ name: "  ", kcal: 100 })).toBeNull();
    expect(cleanCustom({ name: "Sopa de la abuela", kcal: "350", protein: "20,5", carbs: -4, fat: 99999 })).toEqual({ name: "Sopa de la abuela", portion: "1 porción", kcal: 350, protein: 20.5, carbs: 0, fat: 500 });
  });
});

describe("XP por registrar comida", () => {
  it("da XP hasta el tope diario y después 0", () => {
    expect(MEAL_XP_DAILY_MAX).toBe(5);
    const awarded = Array.from({ length: 8 }, (_, i) => mealXpFor(i));
    expect(awarded.filter(Boolean).length).toBe(MEAL_XP_DAILY_MAX);
    expect(awarded.slice(0, 5).every((x) => x === MEAL_XP)).toBe(true);
    expect(mealXpFor(5)).toBe(0);
    expect(mealXpFor(-3)).toBe(MEAL_XP);
  });

  it("calcula el inicio del día local en UTC", () => {
    expect(localDayStartUtc("2026-10-22", "America/Costa_Rica")).toBe("2026-10-22T06:00:00.000Z");
    expect(localDayStartUtc("2026-10-22", "America/Mexico_City")).toBe("2026-10-22T06:00:00.000Z");
    expect(localDayStartUtc("2026-10-22", "America/Santiago")).toBe("2026-10-22T03:00:00.000Z");
    expect(localDayStartUtc("2026-10-22", "Zona/Inválida")).toBe("2026-10-22T00:00:00.000Z");
  });
});

describe("balance semanal y mensajes sin culpa", () => {
  // 2026-10-22 es jueves: la semana va del lunes 19 al domingo 25.
  it("cuenta solo los días registrados de la semana actual", () => {
    const b = weeklyBalance([{ day: "2026-10-18", kcal: 3000 }, { day: "2026-10-19", kcal: 1800 }, { day: "2026-10-20", kcal: 2600 }, { day: "2026-10-22", kcal: 1500 }], 2000, "2026-10-22");
    expect(b.logged).toBe(3);
    expect(b.eaten).toBe(5900);
    expect(b.target).toBe(6000);
    expect(b.diff).toBe(100);
    expect(b.week.map((d) => d.day)).toEqual(["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"]);
    expect(b.week[4].future).toBe(true);
  });

  it("mensaje empático y concreto cuando el día se pasa", () => {
    expect(overMessage(0)).toBeNull();
    expect(overMessage(-200)).toBeNull();
    expect(overMessage(80)).toBe(`Mañana compensas con +${(2000).toLocaleString("es-CO")} pasos o una cena ligera; tu semana es lo que importa.`);
    expect(overMessage(80, 500)).toMatch(/semana sigue dentro de la meta/);
    expect(overMessage(1200)).toMatch(/no borra tu progreso/);
    for (const m of [overMessage(80), overMessage(1200), overMessage(300, 10)]) expect(m).not.toMatch(/mal|culpa|fallaste|error/i);
    expect(stepsFor(10)).toBe(1000);
    expect(stepsFor(100)).toBe(2500);
  });

  it("racha de registro y logro Honesto (7 días aunque sea comida rápida)", () => {
    const days = ["2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21"];
    expect(mealStreak(days, "2026-10-22").days).toBe(6); // hoy aún sin registrar no rompe la racha
    const s = mealStreak([...days, "2026-10-22"], "2026-10-22").days;
    expect(s).toBe(7);
    const honesto = nutritionBadges({ streak: s, daysLogged: 7 }).find((b) => b.id === "honesto")!;
    expect(honesto.got).toBe(true);
    expect(nutritionBadges({ streak: 3, daysLogged: 3 }).find((b) => b.id === "honesto")!.progress).toBeCloseTo(3 / 7);
  });
});
