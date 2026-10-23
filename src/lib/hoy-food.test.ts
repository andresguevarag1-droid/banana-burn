import { describe, expect, it } from "vitest";
import { hoyFood } from "./hoy-food";
import type { MealItem } from "./meals-shared";

const meal = (slot: MealItem["slot"], name: string, kcal: number, protein: number): MealItem => ({ id: name, slot, name, qty: 1, kcal, protein, carbs: 0, fat: 0 });
const target = { kcal: 2000, protein: 150 };

describe("hoyFood", () => {
  it("resume lo comido por tiempo de comida, en orden", () => {
    const m = [meal("desayuno", "Gallo pinto", 400, 20), meal("desayuno", "Café", 30, 0)];
    const r = hoyFood({ meals: m, hour: 9, todayIso: "2026-10-23", eaten: { kcal: 430, protein: 20 }, target });
    expect(r.slots.map((s) => s.slot)).toEqual(["desayuno", "almuerzo", "merienda", "cena"]);
    expect(r.slots[0]).toMatchObject({ items: ["Gallo pinto", "Café"], kcal: 430, protein: 20 });
    expect(r.slots[1].items).toEqual([]);
  });
  it("recomienda para un tiempo que falta hoy", () => {
    const r = hoyFood({ meals: [meal("desayuno", "Avena", 400, 25)], hour: 12, todayIso: "2026-10-23", eaten: { kcal: 400, protein: 25 }, target });
    expect(r.next?.when).toMatch(/^Para tu /);
    expect(r.next?.title.length).toBeGreaterThan(3);
    expect(r.slots[0].open).toBe(false);
  });
  it("de noche recomienda para mañana", () => {
    const r = hoyFood({ meals: [], hour: 21, todayIso: "2026-10-23", eaten: { kcal: 1800, protein: 140 }, target });
    expect(r.next?.when).toMatch(/^Mañana/);
  });
  it("sin recomendación para hoy si ya cubrió la meta antes de la noche", () => {
    const r = hoyFood({ meals: [], hour: 13, todayIso: "2026-10-23", eaten: { kcal: 2000, protein: 150 }, target });
    expect(r.next).toBeNull();
  });
});
