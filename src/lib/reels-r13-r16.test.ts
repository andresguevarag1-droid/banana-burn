import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLANS } from "./plans";
import { usd2 } from "./num";
import * as r13 from "../../marketing/videos/R13_comida-musculo/proyecto/escenas.mjs";
import * as r14 from "../../marketing/videos/R14_tres-dias/proyecto/escenas.mjs";
import * as r15 from "../../marketing/videos/R15_primer-5k/proyecto/escenas.mjs";
import * as r16 from "../../marketing/videos/R16_gym-entrenador/proyecto/escenas.mjs";
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const medicalLine = "No sustituye la indicación de tu médico.";
for (const { CONFIG, versiones, linea } of [r13, r14, r15, r16]) {
  const guion = readFileSync(`marketing/videos/${CONFIG.slug}/guion.md`, "utf8");
  const table = guion.split("## Guion toma por toma")[1].split("\n## ")[0];
  const rows = table.split("\n")
    .filter((line) => /^\|\s*\d/.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));

  describe(CONFIG.slug, () => {
    it("mantiene CTA, hashtags y marca en las escenas y el post público", () => {
      const post = guion.split("## Post propuesto\n")[1].split("\n## ")[0];
      const cta = "Empieza 7 días gratis en bananaburn.app";
      expect(CONFIG.escenas.at(-1)?.texto).toBe(cta);
      expect(post.toLowerCase()).toContain(cta.toLowerCase());
      expect(post).toContain("#BananaBurn");
      expect(post.match(/#\w+/g)).toHaveLength(5);
      const publico = [...CONFIG.escenas.map((scene) => scene.texto), post].join("\n");
      expect(publico).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(publico).not.toMatch(/\bIA\b|inteligencia artificial|banano|[—–!¡]/i);
    });

    it("tiene nueve escenas y hasta ocho palabras añadidas, incluida la etiqueta", () => {
      expect(CONFIG.escenas).toHaveLength(9);
      expect(CONFIG.captura.startsWith("public/landing/")).toBe(true);
      expect(existsSync(CONFIG.captura)).toBe(true);
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

    if (["R11_dia-inyeccion"].includes(CONFIG.slug)) {
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

it("publica precios y escenarios derivados de los planes", () => {
 const doc = readFileSync("marketing/videos/R13-R16_medicion.md", "utf8");
 for (const plan of PLANS) {
   expect(doc).toContain(`| ${plan.name} | ${usd2(plan.price.mes)} | ${usd2(plan.price.mes * 100)} | ${usd2(plan.price.anual)} | ${usd2(plan.price.anual * 100)} |`);
 }
});
it("R15 excluye ritmos del ejemplo 21K con un recorte explícito", () => {
 expect(r15.CONFIG.recorte).toEqual({x:32, y:138, w:716, h:475});
 expect(r15.CONFIG.escenas.filter(s => s.tipo === "telefono")).toHaveLength(2);
});
