import { describe, expect, it } from "vitest";
import { COACH_STYLE_RULE, demoReply, safetyCheck, stripEmoji } from "./coach";
import { ruleFeedback } from "./feedback";

const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}]/u;

describe("stripEmoji", () => {
  it("quita emojis, banderas, tonos de piel y secuencias ZWJ", () => {
    expect(stripEmoji("¡Pura vida! 🍌 Hoy toca pierna 💪🏽.")).toBe("¡Pura vida! Hoy toca pierna.");
    expect(stripEmoji("Hecho en Costa Rica 🇨🇷")).toBe("Hecho en Costa Rica ");
    expect(stripEmoji("Equipo 👨‍👩‍👧 listo")).toBe("Equipo listo");
    expect(stripEmoji("⚠️ Para ahora")).toBe(" Para ahora");
    expect(stripEmoji("Racha 🔥")).not.toMatch(EMOJI);
  });
  it("no toca texto normal, markdown ni saltos de línea", () => {
    const md = "**Sentadilla** 4×6-8\n  - Baja en 3 s\n- 1,6 g/kg de proteína";
    expect(stripEmoji(md)).toBe(md);
    expect(stripEmoji("")).toBe("");
    expect(stripEmoji(" ")).toBe(" ");
  });
  it("funciona trozo por trozo, como llega el stream", () => {
    const chunks = ["Completaste ", "todo 💪", " Así ", "se hace 🔥\n", "- Proteína"];
    expect(chunks.map(stripEmoji).join("")).not.toMatch(EMOJI);
  });
});

describe("copy del coach sin emojis", () => {
  it("la regla de estilo prohíbe emojis y raya larga", () => {
    expect(COACH_STYLE_RULE).toContain("No uses emojis");
    expect(COACH_STYLE_RULE).toContain("**negritas**");
  });
  it("respuestas demo, de seguridad y feedback por reglas", () => {
    for (const q of ["quiero cambiar un ejercicio", "qué ceno", "me duele la rodilla", "estoy estancado", "hola", "me duele el pecho", "no quiero vivir", "dolor abdominal fuerte"]) {
      expect(demoReply(q, "Andrés")).not.toMatch(EMOJI);
      expect(demoReply(q, "Andrés")).not.toContain("—");
    }
    expect(safetyCheck("hola")).toBeNull();
    const fb = ruleFeedback({ prs: ["Banca"], done: 12, total: 12, fun: 1, easy: 3, streak: 5 });
    expect(fb).not.toMatch(EMOJI);
    expect(fb).not.toContain("⇄");
  });
});
