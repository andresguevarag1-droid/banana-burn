import { describe, expect, it } from "vitest";
import { DRILLS, drillAnim, drillDose, drillsBy, drillsFor } from "@/lib/run-drills";
import { sheetFor } from "@/lib/exercise-frames";

describe("técnica de carrera", () => {
  it("cada animación tiene su hoja revisada (nunca la de otro movimiento)", () => {
    for (const d of DRILLS) if (d.anim) expect(sheetFor(d.anim), d.id).not.toBeNull();
    expect(drillAnim(DRILLS.find((d) => d.id === "rectas")!)).toBeNull();
  });
  it("trae los ejercicios clave", () => {
    for (const id of ["askip", "bskip", "highknees", "buttkicks", "carioca", "pogo", "legswing", "lunge", "calfstretch", "quadstretch"]) expect(DRILLS.some((d) => d.id === id)).toBe(true);
    expect(drillsBy("enfriar").length).toBeGreaterThanOrEqual(3);
    expect(new Set(DRILLS.map((d) => d.id)).size).toBe(DRILLS.length);
  });
  it("se pegan solas a las sesiones", () => {
    expect(drillsFor("intervalos", false).before).toEqual(["calentamiento", "tecnica"]);
    expect(drillsFor("larga", false).after).toEqual(["enfriar"]);
    expect(drillsFor("facil", true).after).toEqual(["tecnica"]);
    expect(drillsFor("facil", false)).toEqual({ before: [], after: [] });
  });
  it("dosis con las palabras del reproductor", () => {
    const by = (id: string) => drillDose(DRILLS.find((d) => d.id === id)!);
    expect(by("askip")).toBe("2 x 20 metros");
    expect(by("calfstretch")).toBe("30 segundos por lado");
    expect(by("calfraise")).toBe("3 x 15 repeticiones");
    for (const d of DRILLS) expect(drillDose(d)).not.toMatch(/undefined|NaN/);
  });
  it("sin raya larga ni punto medio", () => {
    expect(JSON.stringify(DRILLS)).not.toMatch(/[—·]/);
  });
});
