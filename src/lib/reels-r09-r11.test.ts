import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { nfmt, usd2 } from "./num";
import { PLANS } from "./plans";
import { SEASON_PRICE_MINOR } from "./seasons";
import { firstChargeMinor, PROMO_ID, PROMO_PCT } from "./trial";
import * as r09 from "../../marketing/videos/R09_fuerza-running/proyecto/escenas.mjs";
import * as r10 from "../../marketing/videos/R10_admin-gym-vacio/proyecto/escenas.mjs";
import * as r11 from "../../marketing/videos/R11_dia-inyeccion/proyecto/escenas.mjs";

const medicalLine = "No sustituye la indicación de tu médico.";
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

describe("R09 a R11: importes publicados", () => {
  const medicion = readFileSync("marketing/videos/R09-R11_medicion.md", "utf8");
  const guion = readFileSync("marketing/videos/R09_fuerza-running/guion.md", "utf8");
  const usuarios = 100;

  it("deriva cada precio y total de la tabla de los planes vigentes", () => {
    expect(medicion).toContain(`| Plan | Un pago mensual normal | ${nfmt(usuarios)} usuarios con ese pago mensual | Un pago anual | ${nfmt(usuarios)} pagos anuales |`);
    for (const plan of PLANS) {
      expect(medicion).toContain(`| ${plan.name} | ${usd2(plan.price.mes)} | ${usd2(plan.price.mes * usuarios)} | ${usd2(plan.price.anual)} | ${usd2(plan.price.anual * usuarios)} |`);
    }
  });

  it("deriva las diferencias entre planes y el primer cobro con promoción", () => {
    const entreno = PLANS.find((plan) => plan.id === "entreno")!;
    const completo = PLANS.find((plan) => plan.id === "completo")!;
    expect(medicion).toContain(`mueve ${usd2(completo.price.mes - entreno.price.mes)} más por mes a tarifa normal, o ${usd2(completo.price.anual - entreno.price.anual)} más por año`);
    expect(medicion).toContain(`primer mes al ${nfmt(PROMO_PCT)} % modifica el primer cobro (${usd2(firstChargeMinor(entreno.id, "mes", PROMO_ID) / 100)} / ${usd2(firstChargeMinor(completo.id, "mes", PROMO_ID) / 100)} según src/lib/trial.ts)`);
  });

  it("verifica Running en medición, captura y post por separado", () => {
    const precio = usd2(SEASON_PRICE_MINOR.running / 100);
    expect(medicion).toContain(`Una compra Running adicional es ${precio} según src/lib/seasons.ts`);
    const captura = guion.split("## Captura real\n")[1].split("\n## ")[0];
    const post = guion.split("## Post propuesto\n")[1].split("\n## ")[0];
    expect(captura).toContain(`es una compra aparte de ${precio}, salvo la temporada incluida`);
    expect(post).toContain(`Temporada de Running: ${precio} como compra aparte`);
  });
});

for (const { CONFIG, versiones, linea } of [r09, r10, r11]) {
  const guion = readFileSync(`marketing/videos/${CONFIG.slug}/guion.md`, "utf8");
  const table = guion.split("## Guion toma por toma")[1].split("\n## ")[0];
  const rows = table.split("\n")
    .filter((line) => /^\|\s*\d/.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));

  describe(CONFIG.slug, () => {
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
