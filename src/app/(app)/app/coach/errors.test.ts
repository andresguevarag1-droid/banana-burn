import { describe, expect, it } from "vitest";
import { CUT_SUFFIX, LIMIT_TEXT, errorFor, isLocalOnly, splitCut } from "./errors";

describe("errores del chat del coach", () => {
  it("mensajes por status", () => {
    expect(errorFor(null).retry).toBe(true);
    expect(errorFor(413).text).toMatch(/largo/);
    expect(errorFor(413).retry).toBe(false);
    expect(errorFor(403).text).toMatch(/Recárgala/);
    expect(errorFor(401).text).toMatch(/sesión/);
    expect(errorFor(500).retry).toBe(true);
  });
  it("402: sin plan ni prueba, muestra el mensaje del servidor y no reintenta", () => {
    expect(errorFor(402, "Tu prueba gratis terminó. Elige un plan para seguir registrando.")).toEqual({ text: "Tu prueba gratis terminó. Elige un plan para seguir registrando.", retry: false });
    expect(errorFor(402).text).toMatch(/plan/);
  });
  it("503 usa el texto del servidor; configurando no ofrece reintentar", () => {
    expect(errorFor(503, "El coach se está configurando. Vuelve en un rato.")).toEqual({ text: "El coach se está configurando. Vuelve en un rato.", retry: false });
    expect(errorFor(503, "").retry).toBe(true);
  });
  it("respuesta cortada", () => {
    expect(splitCut(`Haz 3 series.\n\n${CUT_SUFFIX}`)).toEqual({ content: "Haz 3 series.", cut: true });
    expect(splitCut("Todo bien")).toEqual({ content: "Todo bien", cut: false });
  });
  it("avisos locales no se reenvían al modelo", () => {
    expect(isLocalOnly({ role: "assistant", content: LIMIT_TEXT })).toBe(true);
    expect(isLocalOnly({ role: "assistant", content: "" })).toBe(true);
    expect(isLocalOnly({ role: "assistant", content: "Hola" })).toBe(false);
    expect(isLocalOnly({ role: "user", content: LIMIT_TEXT })).toBe(false);
  });
});
