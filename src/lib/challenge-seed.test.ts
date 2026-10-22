import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SEED } from "./challenge-seed";
import { seedSql } from "./challenge-seed-sql";
import { GRACE_LEVEL_XP } from "./gamify";

const sql = readFileSync(new URL("../../supabase/migrations/0018_tienda_retos.sql", import.meta.url), "utf8");

describe("0018 coincide con el código", () => {
  it("la siembra de la migración es la de challenge-seed.ts (regenerar con scripts/gen-retos-seed.ts)", () => {
    expect(sql).toContain(seedSql(SEED).trim());
  });
  it("los comodines extra por nivel usan los mismos umbrales que gamify", () => {
    for (const xp of GRACE_LEVEL_XP) expect(sql).toContain(`when xp >= ${xp} then 1`);
  });
  it("el bono de racha tiene el mismo tope en la base", () => {
    expect(sql).toMatch(/p_xp > 150/);
  });
});
