import { describe, expect, it } from "vitest";
import { LO_MEJOR_HIDDEN, PP_CELEBRATED, PP_HIDDEN, isLearnKey, showLoMejor } from "./primeros-pasos";

describe("Lo mejor de Banana Burn en Hoy", () => {
  it("no aparece mientras la lista de primeros pasos sigue activa", () => expect(showLoMejor([])).toBe(false));
  it("aparece cuando la lista se completó o se ocultó", () => {
    expect(showLoMejor([PP_HIDDEN])).toBe(true);
    expect(showLoMejor([PP_CELEBRATED])).toBe(true);
  });
  it("se puede cerrar", () => expect(showLoMejor([PP_CELEBRATED, LO_MEJOR_HIDDEN])).toBe(false));
  it("la clave de cierre es válida para guardarse", () => expect(isLearnKey(LO_MEJOR_HIDDEN)).toBe(true));
});
