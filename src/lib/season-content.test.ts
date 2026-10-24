import { describe, expect, it } from "vitest";
import { SEASON_SEED } from "./season-content";
import { AVOID_SWAPS, INJURY_SWAPS, SPORTS } from "./seasons";
import { programErrors } from "./programs";
import { knownExercise } from "./programs-server";

describe("contenido de la Temporada 1", () => {
  it("tres deportes, 8 semanas, 4 sesiones por fase y sin errores de programa", () => {
    expect(SEASON_SEED.map((s) => s.slug)).toEqual(["temporada-running-1", "temporada-raquetas-1", "temporada-cross-1"]);
    for (const p of SEASON_SEED) {
      expect(p.meta.phases.reduce((a, x) => a + x.weeks, 0), p.slug).toBe(8);
      expect(p.meta.phases.find((x) => x.deload)?.name).toBe("Descarga");
      for (const ph of [1, 2, 3, 4]) expect(p.sessions.filter((s) => s.phase === ph).map((s) => s.day), `${p.slug} fase ${ph}`).toEqual([1, 2, 3, 4]);
      expect(programErrors(p.meta, p.sessions, knownExercise), p.slug).toEqual([]);
      for (const s of p.sessions) { expect(s.title.length, s.title).toBeLessThanOrEqual(60); expect(s.focus.length, s.focus).toBeLessThanOrEqual(160); for (const e of s.exercises) expect((e.note ?? "").length, e.note).toBeLessThanOrEqual(160); }
      expect(p.title.length).toBeLessThanOrEqual(60);
    }
  });
  it("solo ejercicios que existen, también en las alternativas por molestias", () => {
    for (const p of SEASON_SEED) for (const s of p.sessions) for (const e of s.exercises) {
      expect(knownExercise(e.id), `${p.slug} ${e.id}`).toBe(true);
      if (e.home) expect(knownExercise(e.home), `${p.slug} ${e.home}`).toBe(true);
    }
    for (const m of [...Object.values(INJURY_SWAPS), ...Object.values(AVOID_SWAPS)]) for (const [from, to] of Object.entries(m)) {
      expect(knownExercise(from), from).toBe(true);
      if (to) expect(knownExercise(to), to).toBe(true);
    }
  });
  it("textos de marca: sin CrossFit, sin rayas largas, sin IA, sin cadenas de puntos", () => {
    const all = JSON.stringify(SEASON_SEED) + JSON.stringify(SPORTS);
    expect(all).not.toMatch(/crossfit/i);
    expect(all).not.toMatch(/—/);
    expect(all).not.toMatch(/\bIA\b/);
    expect(all).not.toMatch(/ · /);
    expect(all).not.toMatch(/banano/i);
    // Lenguaje neutro (0039): sin adjetivos con género para la persona.
    expect(all).not.toMatch(/\b(fresco|cansado|Bienvenido|listo para)\b/);
  });
  it("la experiencia transforma la app con el modo del deporte", () => {
    for (const p of SEASON_SEED) expect(p.meta.experience?.mode).toMatch(/^Modo (Running|Raquetas|Cross Training)$/);
  });
});

import { readFileSync } from "node:fs";
import { seasonSeedSql } from "./season-content";
describe("0046", () => {
  it("la siembra de la migración coincide con el código", () => {
    const sql = readFileSync(new URL("../../supabase/migrations/0046_temporadas.sql", import.meta.url), "utf8");
    expect(sql).toContain(seasonSeedSql());
  });
});
