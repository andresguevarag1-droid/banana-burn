import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { PLANS } from "./plans";
import { usd2 } from "./num";

const base = resolve(process.cwd(), "marketing/videos");
const medicion = readFileSync(resolve(base, "CP2-CP4_medicion.md"), "utf8");

describe("CP2 a CP4: tarifas y evidencia de producto", () => {
  it("mantiene el neto por procesador alineado con los precios reales", () => {
    for (const p of PLANS) {
      for (const [ciclo, precio] of Object.entries(p.price)) {
        const neto = (tasa: number) => usd2(precio / 1.13 - precio * tasa - 0.35);
        expect(medicion).toContain(`| ${p.name} ${ciclo === "mes" ? "mensual" : "anual"} | ${usd2(precio)} | ${neto(0.039)} | ${neto(0.0425)} |`);
      }
    }
  });

  it.each(["CP2_otra-persona-condominio", "CP3_con-cuanto-empiezo", "CP4_peso-en-pantalla"])("%s conserva la captura original y etiqueta su ejemplo", (slug) => {
    const escenas = readFileSync(resolve(base, slug, "proyecto/escenas.mjs"), "utf8");
    const config = JSON.parse(escenas.split("export const CONFIG = ")[1].split(";\nexport const FPS")[0]);
    expect(config.captura).toBe("public/landing/entreno.png");
    expect(existsSync(resolve(process.cwd(), config.captura))).toBe(true);
    expect(config.escenas.at(-1)).toMatchObject({ tipo: "cierre", etiqueta: "Ejemplo", texto: "Empieza 7 días gratis en bananaburn.app" });
    if (slug.startsWith("CP3")) expect(config.escenas[0].texto).toBe("¿Con cuánto peso empiezo?");
    const guion = readFileSync(resolve(base, slug, "guion.md"), "utf8");
    expect(guion).toContain("10 a 12 repeticiones con 20 kg");
    expect(guion).toContain("18 s");
    expect(guion).toContain("11 s");
  });
});
