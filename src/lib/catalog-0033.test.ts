import { fixThousands } from "./num";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FREE_HIDE, FREE_MAX_DAYS, FREE_REWORK, catalog0033Sql } from "./catalog-0033";
import { SEED_CHALLENGES, storeSection } from "./challenges";
import { CHALLENGE_ART } from "./challenge-art";

const sql = readFileSync(new URL("../../supabase/migrations/0033_retos_gratis.sql", import.meta.url), "utf8");
const by = Object.fromEntries(SEED_CHALLENGES.map((c) => [c.id, c]));
const today = "2026-10-23";

describe("0033: retos gratis", () => {
  it("la migración es la de catalog-0033.ts (regenerar con scripts/gen-catalog-0033.ts)", () => {
    expect(sql).toContain(catalog0033Sql().trim());
  });
  it("en la tienda quedan solo los 4 gratis elegidos, todos de 15 días o menos y con portada", () => {
    const free = SEED_CHALLENGES.filter((c) => c.kind === "reto" && c.priceUsd === 0 && storeSection(c, today) === "gratis");
    expect(free.map((c) => c.id).sort()).toEqual(Object.keys(FREE_REWORK).sort());
    for (const c of free) {
      expect(c.days, c.id).toBeLessThanOrEqual(FREE_MAX_DAYS);
      expect(CHALLENGE_ART[c.id], c.id).toBeTruthy();
    }
  });
  it("cada uno trae un plan completo, uno por día, sin emojis ni raya larga", () => {
    for (const [slug, r] of Object.entries(FREE_REWORK)) {
      expect(r.plan.length, slug).toBe(r.days);
      expect(by[slug].task(1)).toBe(fixThousands(r.plan[0].t));
      expect(/[—\p{Extended_Pictographic}]/u.test(JSON.stringify(r)), slug).toBe(false);
    }
  });
  it("los demás gratis quedan ocultos", () => {
    for (const slug of FREE_HIDE) expect(by[slug].status, slug).toBe("oculto");
  });
});
