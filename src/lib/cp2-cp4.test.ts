import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { PLANS } from "./plans";
import { usd2 } from "./num";
import { promoPrice } from "./trial";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const base = resolve(process.cwd(), "marketing/videos");
const medicion = readFileSync(resolve(base, "CP2-CP4_medicion.md"), "utf8");

describe("CP2 a CP4: tarifas y evidencia de producto", () => {
  it("conserva los cobros promocionales y sus netos según trial.ts", () => {
    const precios = PLANS.map((plan) => promoPrice(plan.id));
    expect(medicion).toContain(precios.map(usd2).join(" o "));
    for (const [nombre, tasa] of [["ONVO", 0.039], ["Tilopay", 0.0425]] as const) {
      const netos = precios.map((precio) => usd2(precio / 1.13 - precio * tasa - 0.35));
      expect(medicion).toContain(`neto ${nombre}: ${netos.join(" / ")}`);
    }
  });

  it.each(["CP2_otra-persona-condominio", "CP3_con-cuanto-empiezo", "CP4_peso-en-pantalla"])("%s ejecuta ambos montajes sin huecos y conserva el cierre real", (slug) => {
    const url = pathToFileURL(resolve(base, slug, "proyecto/escenas.mjs")).href;
    const montajes = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e",
      `const m = await import(${JSON.stringify(url)}); console.log(JSON.stringify([m.linea('reel'), m.linea('anuncio')]));`,
    ], { encoding: "utf8" })) as { inicio: number; fin: number; tipo: string; texto: string; etiqueta?: string }[][];
    for (const [i, escenas] of montajes.entries()) {
      expect(escenas[0].inicio).toBe(0);
      expect(escenas.at(-1)?.fin).toBe(i === 0 ? 18 : 11);
      escenas.forEach((escena, j) => {
        expect(escena.fin).toBeGreaterThan(escena.inicio);
        if (j) expect(escena.inicio).toBe(escenas[j - 1].fin);
      });
      const cierre = escenas.at(-1)!;
      expect(cierre.tipo).toBe("cierre");
      expect(cierre.fin - cierre.inicio).toBe(3);
      expect(cierre.etiqueta).toBe("Ejemplo");
      if (slug.startsWith("CP3")) expect(escenas[0].texto).toBe("¿Con cuánto peso empiezo?");
    }
    expect(execFileSync(process.execPath, [resolve(base, slug, "proyecto/render.mjs"), "check"], { encoding: "utf8" })).toContain("sin renderizar");
  });

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
