import { describe, expect, it } from "vitest";
import { shouldAutoSave } from "./leave";

describe("shouldAutoSave", () => {
  const base = { phase: "summary" as const, doneSets: 1, saved: false, sending: false };
  it("guarda al salir del resumen con al menos una serie", () => expect(shouldAutoSave(base)).toBe(true));
  it("no guarda sin series hechas", () => expect(shouldAutoSave({ ...base, doneSets: 0 })).toBe(false));
  it("no guarda en medio del entreno (el avance se retoma)", () => expect(shouldAutoSave({ ...base, phase: "play" })).toBe(false));
  it("no guarda dos veces", () => {
    expect(shouldAutoSave({ ...base, saved: true })).toBe(false);
    expect(shouldAutoSave({ ...base, sending: true })).toBe(false);
    expect(shouldAutoSave({ ...base, phase: "saved" })).toBe(false);
  });
});
