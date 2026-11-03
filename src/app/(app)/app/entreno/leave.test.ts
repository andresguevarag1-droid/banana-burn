import { describe, expect, it, vi } from "vitest";
import { HIDDEN_SAVE_MS, hiddenLongEnough, partialSaver, shouldAutoSave, shouldSavePartial } from "./leave";

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

describe("primer entreno a medias (#246)", () => {
  const play = { first: true, phase: "play" as const, doneSets: 1, saved: false, sending: false };
  it("con 0 series no se guarda nada", () => {
    const send = vi.fn();
    const leave = partialSaver(send);
    expect(shouldSavePartial({ ...play, doneSets: 0 })).toBe(false);
    expect(leave({ ...play, doneSets: 0 }, "beacon")).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
  it("con 1 serie o más se guarda una sola vez aunque salga varias veces", () => {
    const send = vi.fn();
    const leave = partialSaver(send);
    expect(leave(play, "save")).toBe(true);
    expect(leave({ ...play, doneSets: 3 }, "beacon")).toBe(false);
    expect(leave(play, "save")).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("save");
  });
  it("con 0 series al salir, la serie de después sí se guarda al volver a salir", () => {
    const send = vi.fn();
    const leave = partialSaver(send);
    leave({ ...play, doneSets: 0 }, "save");
    leave(play, "beacon");
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("el segundo entreno no se guarda solo", () => {
    const send = vi.fn();
    expect(partialSaver(send)({ ...play, first: false, doneSets: 5 }, "beacon")).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
  it("en el resumen o ya guardado manda el guardado de siempre, no el parcial", () => {
    expect(shouldSavePartial({ ...play, phase: "summary" })).toBe(false);
    expect(shouldSavePartial({ ...play, phase: "saved" })).toBe(false);
    expect(shouldSavePartial({ ...play, saved: true })).toBe(false);
    expect(shouldSavePartial({ ...play, sending: true })).toBe(false);
  });
});

describe("hiddenLongEnough: 60 s en segundo plano, medidos al volver (iOS congela los temporizadores)", () => {
  const t0 = 1_000_000;
  it("con 60 s o más cuenta como salir", () => {
    expect(hiddenLongEnough(t0, t0 + HIDDEN_SAVE_MS)).toBe(true);
    expect(hiddenLongEnough(t0, t0 + 5 * 60_000)).toBe(true);
  });
  it("con menos de 60 s no cuenta", () => {
    expect(hiddenLongEnough(t0, t0 + HIDDEN_SAVE_MS - 1)).toBe(false);
    expect(hiddenLongEnough(t0, t0)).toBe(false);
  });
  it("sin hora de salida no cuenta", () => {
    expect(hiddenLongEnough(undefined, t0)).toBe(false);
  });
});
