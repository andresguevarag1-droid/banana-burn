// Libras en el entreno (#300): se guarda en kg y solo se convierte al mostrar o leer, redondeado a 2.5 lb.
import { describe, expect, it } from "vitest";
import { loadKg, loadShown } from "@/lib/i18n/format";
import { ES_LANG, fieldKg, fieldShown, langOf, lbPlatesPerSide, snapKg, stepKg, volFmt, wFmt } from "./lang";
import { targetText, volumeText } from "./logic";

const LB = langOf("en-US", "imperial");
const KG_EN = langOf("en-US", "metric");

describe("conversión kg/lb del entreno (#300)", () => {
  it("loadShown: en kg no cambia; en lb redondea a 2.5", () => {
    expect(loadShown(20, "metric")).toBe(20);
    expect(loadShown(20, "imperial")).toBe(45);
    expect(loadShown(10, "imperial")).toBe(22.5);
    expect(loadShown(100, "imperial")).toBe(220);
  });
  it("loadKg: en kg no cambia; en lb redondea a 2.5 lb y guarda kg con 3 decimales", () => {
    expect(loadKg(20, "metric")).toBe(20);
    expect(loadKg(45, "imperial")).toBe(20.412);
    expect(loadKg(44, "imperial")).toBe(loadKg(45, "imperial"));
  });
  it("ida y vuelta: 20 kg se ve como 45 lb y 45 lb se vuelve a ver como 45 lb", () => {
    const kg = loadKg(loadShown(20, "imperial"), "imperial");
    expect(kg).toBeCloseTo(20.41, 2);
    expect(loadShown(kg, "imperial")).toBe(45);
    for (const lb of [5, 22.5, 45, 135, 225, 312.5]) expect(loadShown(loadKg(lb, "imperial"), "imperial")).toBe(lb);
  });
  it("fieldShown y fieldKg: el campo muestra lb y guarda kg; vacío queda vacío; en kg es texto tal cual", () => {
    expect(fieldShown("20", LB)).toBe("45");
    expect(fieldShown("", LB)).toBe("");
    expect(fieldKg("45", LB)).toBe("20.412");
    expect(fieldShown(fieldKg("135", LB), LB)).toBe("135");
    expect(fieldKg("", LB)).toBe("");
    expect(fieldShown("12.5", ES_LANG)).toBe("12.5");
    expect(fieldKg("12,5", KG_EN)).toBe("12,5");
  });
  it("stepKg: en kg suma el paso de siempre; en lb 5 con barra y 2.5 sin barra, sin bajar del mínimo", () => {
    expect(stepKg(20, 1, { barbell: true, kgStep: 2.5 }, ES_LANG)).toBe(22.5);
    expect(stepKg(1, -1, { barbell: false, kgStep: 2 }, ES_LANG)).toBe(0);
    expect(loadShown(stepKg(20, 1, { barbell: true, kgStep: 2.5 }, LB), "imperial")).toBe(50);
    expect(loadShown(stepKg(20, -1, { barbell: true, kgStep: 2.5 }, LB), "imperial")).toBe(40);
    expect(loadShown(stepKg(10, 1, { barbell: false, kgStep: 1 }, LB), "imperial")).toBe(25);
    expect(stepKg(1, -1, { barbell: false, kgStep: 1 }, LB)).toBe(0);
    expect(stepKg(20, -10, { barbell: true, kgStep: 2.5 }, LB, 20)).toBe(20);
  });
  it("snapKg: un peso del plan cae en el disco de lb más cercano", () => {
    expect(snapKg(20, ES_LANG)).toBe(20);
    expect(snapKg(20, LB)).toBe(20.412);
    expect(loadShown(snapKg(61, LB), "imperial")).toBe(135);
  });
  it("lbPlatesPerSide: discos por lado sobre una barra de 45 lb", () => {
    expect(lbPlatesPerSide(loadKg(45, "imperial"))).toEqual([]);
    expect(lbPlatesPerSide(loadKg(135, "imperial"))).toEqual([45]);
    expect(lbPlatesPerSide(loadKg(185, "imperial"))).toEqual([45, 25]);
    expect(lbPlatesPerSide(loadKg(100, "imperial"))).toEqual([25, 2.5]);
    expect(lbPlatesPerSide(loadKg(40, "imperial"))).toBeNull();
    expect(lbPlatesPerSide(loadKg(47.5, "imperial"))).toBeNull();
  });
  it("wFmt y volFmt: lb en imperial, kg y toneladas como siempre en métrico", () => {
    expect(wFmt(20, LB)).toBe("45 lb");
    expect(wFmt(12.5, ES_LANG)).toBe("12.5 kg");
    expect(volFmt(1000, LB)).toBe("2,205 lb");
    expect(volFmt(850, LB)).toBe("1,874 lb");
    expect(volFmt(850, ES_LANG)).toBe("850 kg");
    expect(volFmt(1250, ES_LANG)).toBe("1.3 t");
    expect(volumeText(1250)).toBe("1.3 t");
  });
  it("la meta de la serie sale en lb en inglés y en kg en español", () => {
    expect(targetText({ kg: "20", reps: "8" }, { bw: false }, LB)).toBe("45 lb × 8 reps");
    expect(targetText({ kg: "20", reps: "8" }, { bw: false })).toBe("20 kg × 8 reps");
  });
});
