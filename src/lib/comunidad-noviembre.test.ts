import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REF_GROUP_SIZE, REF_BASE_MONTHS, REF_WINDOW_DAYS } from "./referrals";

const read = (name: string) => readFileSync(new URL(`../../marketing/comunidad/${name}`, import.meta.url), "utf8");

describe("comunidad noviembre: ofertas y entregables revisables", () => {
  it("mantiene la recompensa y ventana de activación del programa real", () => {
    const docs = read("reto-12-entrenos.md") + read("respuestas.md");
    expect(docs).toContain(`${REF_GROUP_SIZE} amigos activos = ${REF_BASE_MONTHS} mes gratis`);
    expect(docs).toContain(`primeros ${REF_WINDOW_DAYS} días`);
    expect(read("reto-12-entrenos.md")).toContain("Los 12 entrenos no desbloquean el mes gratis");
    expect(read("respuestas.md").match(/^## \d{2}\./gm)).toHaveLength(20);
  });

  it("entrega cada fecha con aprobación, encuesta y PNG vertical válido", () => {
    for (let day = 1; day <= 8; day++) {
      const date = `2026-11-${String(day).padStart(2, "0")}`;
      const doc = read(`${date}.md`);
      expect(doc).toContain("aprobación escrita de Andrés");
      expect(doc).toContain("Sticker nativo de encuesta");
      expect(doc).toContain("250 px y abajo 350 px libres");
      const png = readFileSync(new URL(`../../marketing/comunidad/historias/${date}.png`, import.meta.url));
      expect(png.subarray(1, 4).toString()).toBe("PNG");
      expect(png.readUInt32BE(16)).toBe(1080);
      expect(png.readUInt32BE(20)).toBe(1920);
    }
  });

  it("mantiene la cautela clínica y los límites de atribución", () => {
    expect(read("respuestas.md")).toContain("No sustituye la indicación de tu médico.");
    expect(read("README.md")).toContain("sin atribución demostrada a una historia");
    expect(read("README.md")).toContain("'succeeded'");
  });
});
