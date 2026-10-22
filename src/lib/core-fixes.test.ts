import { describe, expect, test } from "vitest";
import { fmtQty, ingText, planMenu, RECIPES, roundQty } from "@/lib/recipes";
import { FOODS, FOOD_GROUPS, sortForCountry } from "@/lib/foods";
import { DEMO_DAYS, demoStartDate, demoWeighIns, demoWeights, demoXp, demoWorkouts, demoActiveDays } from "@/lib/demo-story";
import { streakOf } from "@/lib/gamify";
import { weekIndex } from "@/lib/engine";
import { cleanName, getLibEx, similar, isStrength, animFor, patternOf, searchLibrary } from "@/lib/library";
import { pickLifts, workoutName } from "@/lib/progress";
import { greetingAt, weekDays } from "@/lib/daily";

describe("recetas: cantidades escaladas", () => {
  test("fracciones amigables", () => {
    expect(fmtQty(0.25)).toBe("¼");
    expect(fmtQty(1.5)).toBe("1½");
    expect(fmtQty(2.75)).toBe("2¾");
    expect(fmtQty(180)).toBe("180");
  });
  test("redondeos por unidad", () => {
    expect(roundQty(187, "g")).toBe(185);
    expect(roundQty(0.63, "taza")).toBe(0.75);
    expect(roundQty(2.6, "unid", true)).toBe(3);
    expect(roundQty(0.3, "unid")).toBe(0.25);
    expect(roundQty(1, "g")).toBe(5);
  });
  test("texto escalado con plural y singular", () => {
    expect(ingText({ q: 150, u: "g", n: "pechuga" }, 1.25)).toBe("190 g de pechuga");
    expect(ingText({ q: 2, u: "unid", n: "huevos", n1: "huevo", whole: true }, 0.5)).toBe("1 huevo");
    expect(ingText({ q: 0.5, u: "taza", n: "avena" }, 2)).toBe("1 taza de avena");
    expect(ingText({ q: 0.5, u: "taza", n: "avena" }, 3)).toBe("1½ tazas de avena");
    expect(ingText({ q: 600, u: "g", n: "pechuga" }, 1, 4)).toBe("150 g de pechuga");
    expect(ingText({ n: "Sal al gusto" }, 3)).toBe("Sal al gusto");
  });
  test("todas las recetas tienen cantidades y macros coherentes (4/4/9 ±25 %)", () => {
    for (const r of RECIPES) {
      const est = r.p * 4 + r.c * 4 + r.f * 9;
      expect(Math.abs(est - r.kcal) / r.kcal, r.id).toBeLessThan(0.25);
      expect(r.ing.length).toBe(r.ix.length);
      expect(r.ing.join(" ")).not.toMatch(/Lizano|natilla|chile dulce|banano|tico/i);
    }
    expect(RECIPES.some((r) => r.tags.includes("México"))).toBe(true);
    expect(RECIPES.some((r) => r.tags.includes("Perú"))).toBe(true);
  });
});

describe("recetas: menú con lo que falta hoy", () => {
  test("cuadra calorías y no se queda corto de proteína", () => {
    const m = planMenu({ kcal: 2000, protein: 185 });
    expect(m.items).toHaveLength(4);
    expect(Math.abs(m.kcal - 2000)).toBeLessThan(260);
    expect(m.p).toBeGreaterThan(140);
    expect(m.kcal).toBe(m.items.reduce((a, x) => a + x.kcal, 0));
  });
  test("solo arma los tiempos que faltan y con lo restante", () => {
    const m = planMenu({ kcal: 700, protein: 80 }, ["cena"]);
    expect(m.items.map((x) => x.r.slot)).toEqual(["cena"]);
    expect(Math.abs(m.kcal - 700)).toBeLessThan(200);
  });
  test("si ya cubrió el día, no propone nada", () => {
    expect(planMenu({ kcal: 100, protein: 10 }).items).toHaveLength(0);
  });
});

describe("alimentos", () => {
  test("etiquetas neutras y platos de varios países", () => {
    expect(FOOD_GROUPS.find(([g]) => g === "tica")?.[1]).toBe("Típicos");
    expect(FOODS.map((f) => f.n).join("|")).not.toMatch(/Banano|tico|Imperial|Turrialba|Natilla/);
    const countries = new Set(FOODS.flatMap((f) => f.cc ?? []));
    for (const c of ["MX", "CO", "VE", "PE", "CL", "AR", "SV", "HN", "DO"]) expect(countries.has(c), c).toBe(true);
  });
  test("primero los del país del usuario, luego los comunes, luego otros países", () => {
    const tipicos = FOODS.filter((f) => f.g === "tica");
    const mx = sortForCountry(tipicos, "MX");
    expect(mx[0].cc).toContain("MX");
    const none = sortForCountry(tipicos, null);
    expect(none[0].cc).toBeUndefined();
    expect(none.find((f) => f.cc)?.cc).toBeDefined();
  });
});

describe("demo: una sola historia", () => {
  const today = "2026-10-22";
  test("21 días, de 94,9 a 93,1 kg y racha de 11", () => {
    const w = demoWeights(today);
    expect(w[0].v).toBe(94.9);
    expect(w.at(-1)!.v).toBe(93.1);
    expect(w[0].d).toBe("2026-10-01");
    expect(demoWeighIns(today)).toBe(w.length);
    expect(streakOf(demoActiveDays(today), today).days).toBe(11);
    expect(demoXp(today)).toBe(demoWorkouts(today).length * 140 + w.length * 10 + 150);
    expect(DEMO_DAYS).toBe(21);
  });
  test("el bloque va en la semana 3 cualquier día de la semana", () => {
    for (const d of ["2026-10-19", "2026-10-22", "2026-10-25"]) expect(weekIndex(demoStartDate(d), new Date(d + "T12:00:00"))).toBe(2);
  });
});

describe("Hoy", () => {
  test("semana de lunes a domingo", () => {
    expect(weekDays("2026-10-22")).toEqual(["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"]);
    expect(weekDays("2026-10-25")[0]).toBe("2026-10-19");
    expect(weekDays("2026-10-19")[6]).toBe("2026-10-25");
  });
  test("saludo según la hora local", () => {
    const at = (iso: string) => new Date(iso);
    expect(greetingAt("America/Mexico_City", at("2026-10-22T14:00:00Z"))).toBe("Buenos días"); // 8:00
    expect(greetingAt("America/Bogota", at("2026-10-22T20:00:00Z"))).toBe("Buenas tardes"); // 15:00
    expect(greetingAt("America/Santiago", at("2026-10-23T02:00:00Z"))).toBe("Buenas noches"); // 23:00
  });
});

describe("Progreso", () => {
  test("nombres de sesión legibles", () => {
    expect(workoutName("pushA")).toBe("Pierna y empuje A");
    expect(workoutName("expres20")).toBe("Exprés 20 min");
    expect(workoutName("descanso")).toBe("Descanso activo");
  });
  test("sigue los ejercicios que el usuario sí registró", () => {
    const s = (exercise: string, day: string, kg: number | null = 60, reps = 8) => ({ exercise, day, kg, reps });
    const l = pickLifts([s("goblet", "2026-10-01"), s("goblet", "2026-10-08", 64), s("hammer", "2026-10-02"), s("pushup", "2026-10-03", null), s("ds:0043", "2026-10-05", 80)]);
    expect(l.map((x) => x.id)).toEqual(["goblet", "ds:0043", "hammer"]);
    expect(l[0].pts).toHaveLength(2);
    expect(l[1].name).toBe("Sentadilla profunda con barra");
  });
});

describe("Biblioteca", () => {
  test("nombres sin sufijos crudos", () => {
    expect(cleanName("Abdominal (v2)")).toBe("Abdominal");
    expect(cleanName("Remo agarre invertido con mancuernas (mujer)")).toBe("Remo agarre invertido con mancuernas");
    expect(getLibEx("0260")!.n).not.toMatch(/capullo/i);
    for (let p = 1; p <= 30; p++) for (const e of searchLibrary({ page: p }).items) expect(e.n).not.toMatch(/\(v\d\)/);
  });
  test("sentadillas con cuádriceps como principal", () => {
    expect(getLibEx("0042")!.t).toBe("quads");
    expect(getLibEx("0043")!.t).toBe("quads");
  });
  test("alternativas del mismo patrón: la sentadilla no sugiere peso muerto", () => {
    const sq = getLibEx("0043")!;
    const alts = similar(sq, "gym");
    expect(alts.length).toBeGreaterThan(2);
    for (const x of alts) expect(patternOf(x.en)).toBe("squat");
  });
  test("tempo solo en fuerza; animación de referencia por patrón", () => {
    expect(isStrength(getLibEx("0025")!)).toBe(true);
    expect(isStrength(getLibEx("1160")!)).toBe(false);
    expect(animFor(getLibEx("0025")!)).toBe("bench");
    expect(animFor(getLibEx("1494")!)).toBeNull();
  });
});

test("si falta mucho para una sola comida, suma una merienda en vez de porciones dobles", () => {
  const m = planMenu({ kcal: 1240, protein: 84 }, ["cena"]);
  expect(m.items.map((x) => x.r.slot)).toEqual(["merienda", "cena"]);
  expect(Math.abs(m.kcal - 1240)).toBeLessThan(250);
});
