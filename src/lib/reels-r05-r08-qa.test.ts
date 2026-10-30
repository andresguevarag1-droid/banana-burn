import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as r05 from "../../marketing/videos/R05_sin-reloj/proyecto/escenas.mjs";
import * as r06 from "../../marketing/videos/R06_proteina-primero/proyecto/escenas.mjs";
import * as r07 from "../../marketing/videos/R07_gym-edificio/proyecto/escenas.mjs";
import * as r08 from "../../marketing/videos/R08_bascula/proyecto/escenas.mjs";

const kit = readFileSync("marketing/kit-reels-noviembre-2026.md", "utf8");
const kitRow = (n: number) => {
  const line = kit.split("\n").find((l) => new RegExp(`^\\|[^|]*\\| ${n} \\|`).test(l));
  const [, , , hook, base, capture] = line!.split("|").map((cell) => cell.trim());
  return { hook, base, capture };
};
const cta = "Empieza 7 días gratis en bananaburn.app";
const medicalLine = "No sustituye la indicación de tu médico.";

for (const [n, { CONFIG }] of [[5, r05], [6, r06], [7, r07], [8, r08]] as const) {
  const dir = `marketing/videos/${CONFIG.slug}`;
  const guion = readFileSync(`${dir}/guion.md`, "utf8");
  const render = readFileSync(`${dir}/proyecto/render.mjs`, "utf8");
  const post = guion.split("## Post propuesto")[1].split("\n## ")[0];
  const added = [...CONFIG.escenas.map((s) => s.texto), post].join("\n");
  const row = kitRow(n);

  describe(`${CONFIG.slug} frente al kit`, () => {
    it("usa el gancho, el video base y la captura del plan de noviembre", () => {
      expect(CONFIG.escenas[0].texto).toBe(row.hook);
      expect(guion).toContain(`Referencia del kit: **video ${row.base}**`);
      expect(CONFIG.captura).toMatch(new RegExp(`^public/landing/${row.capture}\\.(png|webp)$`));
      expect(guion).toContain(`\`${CONFIG.captura}\``);
    });

    it("cierra con Coach Banana y el CTA de 7 días, y el post lleva CTA y hashtags", () => {
      const cierre = CONFIG.escenas.at(-1)!;
      expect(cierre.tipo).toBe("cierre");
      expect(cierre.texto).toBe(cta);
      expect(cierre.visual).toContain("Coach Banana");
      expect(post).toContain(cta);
      expect(post.match(/#\w+/g)!.length).toBeGreaterThanOrEqual(3);
      expect(post).toContain("#BananaBurn");
    });

    it("respeta la marca: sin emojis, IA, banano, guiones largos ni exclamaciones", () => {
      expect(added).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(added).not.toMatch(/\bIA\b|inteligencia artificial/i);
      expect(added).not.toMatch(/banano/i);
      expect(added).not.toMatch(/[—–!¡]/);
      expect(render).toContain("paper: '#FFF8E3', banana: '#FFD60A', ink: '#1B1505'");
    });

    it("lleva la advertencia médica cuando menciona GLP-1", () => {
      if (/GLP-?1/i.test(added)) expect(post).toContain(medicalLine);
    });

    it("el texto de cada escena cabe a su tamaño mínimo de 38 px (render no falla)", () => {
      // texto() baja hasta 38 px y exige líneas * size * 1.2 <= maxAlto.
      const calls = [...render.matchAll(/texto\(ctx, [^,]+, \d+, \d+, (\d+), C\.\w+, (\d+)\)/g)];
      expect(calls.length).toBeGreaterThan(0);
      for (const [call, size, maxAlto] of calls) {
        expect(Math.min(Number(size), 38) * 1.2, call).toBeLessThanOrEqual(Number(maxAlto));
      }
    });
  });
}
