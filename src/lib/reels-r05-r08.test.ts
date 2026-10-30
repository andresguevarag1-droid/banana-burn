import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as r05 from "../../marketing/videos/R05_sin-reloj/proyecto/escenas.mjs";
import * as r06 from "../../marketing/videos/R06_proteina-primero/proyecto/escenas.mjs";
import * as r07 from "../../marketing/videos/R07_gym-edificio/proyecto/escenas.mjs";
import * as r08 from "../../marketing/videos/R08_bascula/proyecto/escenas.mjs";

const medicalLine = "No sustituye la indicación de tu médico.";
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

for (const { CONFIG, versiones, linea } of [r05, r06, r07, r08]) {
  const guion = readFileSync(`marketing/videos/${CONFIG.slug}/guion.md`, "utf8");
  const table = guion.split("## Guion toma por toma")[1].split("\n## ")[0];
  const rows = table.split("\n")
    .filter((line) => /^\|\s*\d/.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));

  describe(CONFIG.slug, () => {
    it("tiene nueve escenas y hasta ocho palabras añadidas, incluida la etiqueta", () => {
      expect(CONFIG.escenas).toHaveLength(9);
      for (const scene of CONFIG.escenas) {
        expect(words(`${scene.texto} ${"etiqueta" in scene ? scene.etiqueta : ""}`))
          .toBeLessThanOrEqual(8);
      }
    });

    for (const version of Object.keys(versiones)) {
      it(`${version}: dura de 15 a 25 s, con cortes de 1.5 a 2.5 s y cierre de 3 s`, () => {
        const scenes = linea(version);
        expect(scenes).toHaveLength(9);
        expect(scenes[0].inicio).toBe(0);
        expect(scenes[8].fin).toBe(versiones[version as keyof typeof versiones].duracion);
        expect(scenes[8].fin).toBeGreaterThanOrEqual(15);
        expect(scenes[8].fin).toBeLessThanOrEqual(25);
        scenes.forEach((scene, index) => {
          if (index > 0) expect(scene.inicio).toBe(scenes[index - 1].fin);
          const duration = scene.fin - scene.inicio;
          if (index === 8) {
            expect(scene.tipo).toBe("cierre");
            expect(duration).toBe(3);
          } else {
            expect(duration).toBeGreaterThanOrEqual(1.5);
            expect(duration).toBeLessThanOrEqual(2.5);
          }
        });
      });
    }

    it("cada fila del guion coincide con el texto y la captura rotulada del proyecto", () => {
      expect(rows).toHaveLength(9);
      rows.forEach((row, index) => {
        const scene = CONFIG.escenas[index];
        const label = row[2].endsWith(' + etiqueta “Ejemplo”');
        const text = row[2].replace(/ \+ etiqueta “Ejemplo”$/, "");
        expect(text, scene.id).toBe(scene.texto);
        expect("etiqueta" in scene ? scene.etiqueta : undefined, scene.id)
          .toBe(label ? "Ejemplo" : undefined);
        expect(scene.tipo === "telefono", scene.id).toBe(label);
        expect(Number(row[3]), scene.id).toBe(words(text) + Number(label));
      });
    });

    if (["R06_proteina-primero", "R08_bascula"].includes(CONFIG.slug)) {
      it("conserva la advertencia médica exacta en ambas versiones y en el guion", () => {
        for (const version of Object.keys(versiones)) {
          expect(linea(version).filter((scene) => scene.texto === medicalLine)).toHaveLength(1);
        }
        expect(rows.some((row) => row[2] === medicalLine)).toBe(true);
        expect(guion.split("## Post propuesto")[1]).toContain(medicalLine);
      });
    }
  });
}
