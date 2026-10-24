import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { wording0039Sql } from "./wording-0039";
import { NEUTRAL_WORDING, es419Text } from "./num";
import { SEED as CHALLENGE_SEED } from "./challenge-seed";
import { ALL_PROGRAM_SEED } from "./program-seed";

const sql = readFileSync(new URL("../../supabase/migrations/0039_textos_neutros.sql", import.meta.url), "utf8");

describe("0039: textos neutros", () => {
  it("la migración trae el SQL generado (regenerar con scripts/gen-wording-0039.ts)", () => {
    expect(sql).toContain(wording0039Sql().trim());
  });
  it("cada frase existe en la siembra (si no, sobra) y la versión neutra no asume a un hombre", () => {
    const seed = JSON.stringify([CHALLENGE_SEED, ALL_PROGRAM_SEED]);
    for (const [a, b] of NEUTRAL_WORDING) {
      expect(seed, a).toContain(a);
      expect(/cansado|descansado|listo|fresco/.test(b), b).toBe(false);
    }
  });
  it("en la app se leen neutras", () => {
    expect(es419Text("Completa cualquier entreno; si estás cansado, usa el modo suave")).toBe("Completa cualquier entreno; si te falta energía, usa el modo suave");
    expect(es419Text("Llega descansado al cierre. Camina 8.000 pasos")).toBe("Llega con energía al cierre. Camina 8,000 pasos");
  });
});
