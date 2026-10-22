import { describe, expect, test } from "vitest";
import { dateSeed, flashPlan, localHour, nextDay, slotsLeftToday } from "@/lib/recipes";

const target = { kcal: 2000, protein: 160 };

describe("menú flash según la hora", () => {
  test("ventanas: el desayuno deja de sugerirse a las 11:00", () => {
    expect(slotsLeftToday(7, [])).toEqual(["desayuno", "almuerzo", "merienda", "cena"]);
    expect(slotsLeftToday(10.99, [])).toContain("desayuno");
    expect(slotsLeftToday(11, [])).toEqual(["almuerzo", "merienda", "cena"]);
    expect(slotsLeftToday(15, [])).toEqual(["merienda", "cena"]);
    expect(slotsLeftToday(18, [])).toEqual(["cena"]);
    expect(slotsLeftToday(20, [])).toEqual([]);
  });

  test("14:00 con el almuerzo registrado: hoy solo merienda y cena; mañana desayuno y almuerzo", () => {
    const p = flashPlan({ hour: 14, todayIso: "2026-10-22", logged: ["almuerzo"], left: { kcal: 956, protein: 70 }, target });
    expect(p.mode).toBe("hoy");
    expect(p.today.slots).toEqual(["merienda", "cena"]);
    const slots = p.today.menu.items.map((x) => x.r.slot);
    expect(slots).not.toContain("desayuno");
    expect(slots).not.toContain("almuerzo");
    expect(Math.abs(p.today.menu.kcal - 956)).toBeLessThan(250);
    expect(p.tomorrow.iso).toBe("2026-10-23");
    expect(p.tomorrow.slots).toEqual(["desayuno", "almuerzo"]);
    expect(p.tomorrow.menu.items.map((x) => x.r.slot)).toEqual(["desayuno", "almuerzo"]);
  });

  test("en la mañana sin registros no hay bloque de mañana", () => {
    const p = flashPlan({ hour: 8, todayIso: "2026-10-22", logged: [], left: target, target });
    expect(p.today.slots).toHaveLength(4);
    expect(p.tomorrow.slots).toEqual([]);
    expect(p.tomorrow.menu.items).toHaveLength(0);
  });

  test("después de las 20:00 el principal es mañana completo", () => {
    const p = flashPlan({ hour: 20.5, todayIso: "2026-10-22", logged: ["desayuno"], left: { kcal: 900, protein: 60 }, target });
    expect(p.mode).toBe("manana");
    expect(p.today.menu.items).toHaveLength(0);
    expect(p.tomorrow.menu.items.map((x) => x.r.slot)).toEqual(["desayuno", "almuerzo", "merienda", "cena"]);
    expect(Math.abs(p.tomorrow.menu.kcal - 2000)).toBeLessThan(400);
  });

  test("sin merienda extra si su horario ya pasó", () => {
    const p = flashPlan({ hour: 19, todayIso: "2026-10-22", logged: ["desayuno", "almuerzo"], left: { kcal: 1300, protein: 90 }, target });
    expect(p.today.menu.items.map((x) => x.r.slot)).toEqual(["cena"]);
  });

  test("determinista: el desayuno de mañana no cambia al recargar", () => {
    const a = flashPlan({ hour: 14, todayIso: "2026-10-22", logged: ["almuerzo"], left: { kcal: 956, protein: 70 }, target });
    const b = flashPlan({ hour: 16, todayIso: "2026-10-22", logged: ["almuerzo"], left: { kcal: 700, protein: 50 }, target });
    expect(a.tomorrow.menu.items[0].r.id).toBe(b.tomorrow.menu.items[0].r.id);
    expect(dateSeed("2026-10-23")).toBe(dateSeed("2026-10-23"));
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
  });

  test("hora local según la zona del usuario", () => {
    const at = new Date("2026-10-22T20:00:00Z");
    expect(localHour(at, "America/Costa_Rica")).toBe(14);
    expect(localHour(at, "America/Argentina/Buenos_Aires")).toBe(17);
  });
});
