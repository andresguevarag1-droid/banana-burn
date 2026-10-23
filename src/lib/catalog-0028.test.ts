import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RESTYLE, catalog0028Sql } from "./catalog-0028";
import { FREE_REWORK } from "./catalog-0033";
import { SEED_CHALLENGES, storeSection } from "./challenges";
import { CHALLENGE_ART, LEVEL_ART } from "./challenge-art";
import { LEVELS } from "./gamify";

const sql = readFileSync(new URL("../../supabase/migrations/0028_retos_visual.sql", import.meta.url), "utf8");
const by = Object.fromEntries(SEED_CHALLENGES.map((c) => [c.id, c]));

describe("0028: retos más llamativos", () => {
  it("la migración es la de catalog-0028.ts (regenerar con scripts/gen-catalog-0028.ts)", () => {
    expect(sql).toContain(catalog0028Sql().trim());
  });
  it("21 días de abdomen queda oculto y fuera de la tienda", () => {
    expect(by["abdomen-21"].status).toBe("oculto");
    expect(storeSection(by["abdomen-21"], "2026-10-23")).toBeNull();
  });
  it("cada programa Premium visible tiene su propio color y su portada ilustrada", () => {
    const programs = SEED_CHALLENGES.filter((c) => c.kind === "programa" && c.status === "publicado");
    expect(programs.length).toBe(8);
    expect(new Set(programs.map((c) => c.cover)).size).toBe(8);
    for (const c of programs) expect(CHALLENGE_ART[c.id], c.id).toBeTruthy();
  });
  it("nombres nuevos en el catálogo de respaldo, sin emojis ni raya larga", () => {
    for (const [slug, r] of Object.entries(RESTYLE)) if (r.title && !FREE_REWORK[slug]) {
      expect(by[slug].title).toBe(r.title);
      expect(/[—\p{Extended_Pictographic}]/u.test(r.title)).toBe(false);
    }
    expect(by["brazos-definidos"].program?.experience?.mode).toBe("Modo gorila");
  });
  it("un dibujo de Coach Banana por nivel", () => {
    expect(LEVEL_ART.length).toBe(LEVELS.length);
  });
});
