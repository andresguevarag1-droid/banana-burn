import { readFileSync, existsSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { PLANS, annualSaving } from "./plans";
import { usd2 } from "./num";
import * as a01 from "../../marketing/videos/A01_un-ano-un-pago/proyecto/escenas.mjs";
import * as a02 from "../../marketing/videos/A02_ahorro-anual/proyecto/escenas.mjs";
import * as a03 from "../../marketing/videos/A03_temporada-incluida/proyecto/escenas.mjs";
for (const { CONFIG, linea, versiones } of [a01, a02, a03]) {
 describe(CONFIG.slug, () => {
  const doc = readFileSync(`marketing/videos/${CONFIG.slug}/guion.md`, "utf8");
  it("conserva guion y proyecto, capturas reales, CTA y marca", () => {
   expect(existsSync(CONFIG.captura)).toBe(true);
   for (const scene of CONFIG.escenas) {
    expect(doc).toContain(scene.texto);
    expect(`${scene.texto} ${"etiqueta" in scene ? scene.etiqueta : ""}`.trim().split(/\s+/).length).toBeLessThanOrEqual(8);
    expect(scene.texto).not.toMatch(/\p{Extended_Pictographic}|\bIA\b|[—–]/u);
   }
   expect(CONFIG.escenas.at(-1)?.texto).toBe("Empieza 7 días gratis en bananaburn.app");
   expect(doc.split("## Post propuesto")[1].split("## Producción")[0].match(/#\w+/g)).toHaveLength(5);
  });
  for (const version of Object.keys(versiones)) it(`${version}: cortes y cierre del kit`, () => {
   const scenes = linea(version);
   expect(scenes[0].inicio).toBe(0);
   scenes.forEach((scene, i) => {
    if (i) expect(scene.inicio).toBe(scenes[i-1].fin);
    const duration = scene.fin - scene.inicio;
    if (i === 8) expect(duration).toBe(3);
    else { expect(duration).toBeGreaterThanOrEqual(1.5); expect(duration).toBeLessThanOrEqual(2.5); }
   });
   expect(scenes.at(-1)?.fin).toBe(version === "reel" ? 19 : 15);
  });
 });
}
it("mantiene cifras y escenarios alineados con plans.ts", () => {
 const doc = readFileSync("marketing/videos/A01-A03_medicion.md", "utf8");
 for (const plan of PLANS) {
  expect(doc).toContain(`| ${plan.name} | ${usd2(plan.price.mes)} | ${usd2(plan.price.mes * 12)} | ${usd2(plan.price.anual)} | ${usd2(annualSaving(plan))} | ${usd2(plan.price.anual * 100)} |`);
  expect(a01.CONFIG.escenas.map(s=>s.texto).join("\n")).toContain(`${plan.name}: ${usd2(plan.price.anual)} al año`);
  expect(a02.CONFIG.escenas.map(s=>s.texto).join("\n")).toContain(usd2(annualSaving(plan)));
 }
 expect(doc).toContain("sin promociones");
 expect(a03.CONFIG.escenas.map(s=>s.texto)).toContain("Los retos Premium se compran aparte");
});
