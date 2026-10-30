import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ANNUAL_SEASON_NOTE, PLANS } from "@/lib/plans";
import { usd2 } from "@/lib/num";

const doc = readFileSync("docs/emails/recuperacion-prueba.md", "utf8");
const pieces = doc.split(/^## /m).slice(1, 4);
const bodies = pieces.map((piece) => piece.match(/\*\*Cuerpo:\*\*\s*([\s\S]*?)\s*\*\*Botón:\*\*/)?.[1] ?? "");
const amounts = (text: string) => text.match(/\$[\d,]+\.\d{2}/g) ?? [];
const price = (id: string) => PLANS.find((plan) => plan.id === id)!.price;
const monthly = [price("entreno").mes, price("completo").mes];
const annual = [price("entreno").anual, price("completo").anual];

describe("recuperación de prueba: copy respaldado por el producto", () => {
  it("compara todos los precios de los correos con PLANS y usd2", () => {
    expect(amounts(bodies[0])).toEqual(monthly.map(usd2));
    expect(amounts(bodies[1])).toEqual([...annual, ...monthly].map(usd2));
    expect(amounts(bodies[2])).toEqual([]);
  });

  it("mantiene la tabla y los importes derivados sincronizados con PLANS", () => {
    const rows = doc.split("\n").filter((line) => /^\| Entreno/.test(line));
    expect(rows).toEqual(PLANS.map((plan) => `| ${plan.name} | ${usd2(plan.price.mes)} | ${usd2(plan.price.anual)} |`));
    const formula = doc.split("\n").find((line) => line.startsWith("Ingreso bruto potencial")) ?? "";
    expect(amounts(formula)).toEqual([
      ...monthly, ...annual,
      monthly[1] - monthly[0], annual[1] - annual[0],
    ].map(usd2));
    const reference = doc.split("\n").find((line) => line.startsWith("Como referencia aritmética")) ?? "";
    expect(amounts(reference)).toEqual([...monthly, ...annual].map((value) => usd2(value * 100)));
  });

  it("respalda la temporada por año pagado y el IVA con las fuentes actuales", () => {
    expect(ANNUAL_SEASON_NOTE).toBe("Incluye 1 temporada deportiva gratis");
    const plansSource = readFileSync("src/lib/plans.ts", "utf8");
    expect(plansSource).toContain("cada año pagado incluye una temporada deportiva gratis");
    expect(bodies[1]).toContain("Cada año pagado incluye una temporada deportiva gratis.");
    const pricingCopy = readFileSync("src/components/trial-card-notice.tsx", "utf8");
    expect(pricingCopy).toContain("IVA incluido.");
    for (const body of bodies.slice(0, 2)) expect(body).toContain("IVA incluido");
  });

  it("incluye tres cuerpos no vacíos de menos de 120 palabras y sin ofertas de descuento", () => {
    expect(bodies).toHaveLength(3);
    for (const [index, body] of bodies.entries()) {
      expect(body.trim().length, `cuerpo ${index + 1}`).toBeGreaterThan(0);
      expect(body.trim().split(/\s+/).length, `cuerpo ${index + 1}`).toBeLessThan(120);
      // Revisar toda la pieza pública, incluido asunto, vista previa y botón.
      expect(pieces[index]).not.toMatch(/%|descuent|oferta|promoci[oó]n|ahorr|rebaja|cup[oó]n|c[oó]digo promocional/i);
    }
  });

  it("cada botón dirige únicamente a Mi plan", () => {
    expect([...doc.matchAll(/\*\*Botón:\*\*/g)]).toHaveLength(3);
    expect([...doc.matchAll(/\*\*Destino:\*\*/g)]).toHaveLength(3);
    for (const piece of pieces) {
      expect(piece).toMatch(/\*\*Botón:\*\* .+/);
      expect(piece).toMatch(/\*\*Destino:\*\* `\/app\/suscripcion`/);
      const links = piece.match(/https?:\/\/[^\s)]+/g) ?? [];
      for (const link of links) expect(link).toBe("https://bananaburn.app/app/suscripcion");
    }
  });
});
