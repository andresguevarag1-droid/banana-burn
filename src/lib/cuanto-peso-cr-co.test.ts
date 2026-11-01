import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { nfmt, usd2 } from "@/lib/num";
import { PLANS, TRIAL_DAYS } from "@/lib/plans";
import { PROMO_PCT, promoPrice } from "@/lib/trial";

const doc = readFileSync("marketing/anuncios/cuanto-peso-cr-co.md", "utf8");
const entreno = PLANS.find((plan) => plan.id === "entreno")!;
const completo = PLANS.find((plan) => plan.id === "completo")!;
const usd = (amount: number) => `US${usd2(amount)}`;
const net = (charge: number, pct: number) => charge / 1.13 - (charge * pct + 0.35);
const variants = [...doc.matchAll(/^### ((?:CR|CO)-[ABC]):[^\n]*\n([\s\S]*?)(?=\n##|(?![\s\S]))/gm)];

function section(title: string) {
  const start = doc.indexOf(`## ${title}\n`);
  expect(start, title).toBeGreaterThanOrEqual(0);
  const end = doc.indexOf("\n## ", start + 3);
  return doc.slice(start, end < 0 ? undefined : end);
}

describe("anuncios Cuánto peso para Costa Rica y Colombia", () => {
  it("mantiene los precios de los anuncios y la promoción alineados con el código", () => {
    expect(variants.map(([, id]) => id)).toEqual(["CR-A", "CR-B", "CR-C", "CO-A", "CO-B", "CO-C"]);
    for (const [, id, copy] of variants) {
      const prices = [...copy.matchAll(/US\$[\d,.]+/g)].map(([price]) => price);
      expect(prices, id).toHaveLength(2);
      expect(prices, id).toEqual(prices.map(() => usd(entreno.price.mes)));
    }
    const conditions = section("Condiciones y revisión de las piezas");
    expect(conditions).toContain(`${nfmt(PROMO_PCT)} % de descuento: Entreno ${usd(promoPrice("entreno"))} o Entreno + Nutrición ${usd(promoPrice("completo"))}`);
    expect(conditions).toContain("No aplica al anual.");
  });

  it("comprueba cada cobro y cada neto de los dos procesadores", () => {
    const rows = section("Dinero neto que puede mover").split("\n")
      .filter((line) => line.startsWith("| Entreno"))
      .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
    const expected = [
      [entreno, "primer mes promocional", promoPrice("entreno")],
      [completo, "primer mes promocional", promoPrice("completo")],
      [entreno, "mensual normal", entreno.price.mes],
      [completo, "mensual normal", completo.price.mes],
      [entreno, "anual por cobro anual", entreno.price.anual],
      [completo, "anual por cobro anual", completo.price.anual],
    ] as const;
    expect(rows).toHaveLength(expected.length);
    expected.forEach(([plan, label, charge], index) => {
      expect(rows[index]).toEqual([
        `${plan.name}, ${label}`, nfmt(charge, 2, 2),
        nfmt(net(charge, 0.039), 2, 2), nfmt(net(charge, 0.0425), 2, 2),
      ]);
    });
  });

  it("calcula los totales de 100 cobros antes de redondear", () => {
    const totals = doc.split("\n").find((line) => line.startsWith("Si 100 personas pagan"));
    const amounts = [...(totals ?? "").matchAll(/US\$[\d,.]+/g)].map(([amount]) => amount);
    expect(amounts).toEqual([promoPrice("entreno"), entreno.price.mes]
      .flatMap((charge) => [0.039, 0.0425].map((pct) => usd(net(charge, pct) * 100))));
  });

  it("respeta la marca y conserva el gancho y la prueba en cada variante", () => {
    expect(doc).not.toMatch(/\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u);
    expect(doc).not.toContain("\u2014");
    expect(doc).not.toMatch(/\bbanano\b/i);
    expect(section("Colombia")).not.toMatch(/col[oó]n(?:es)?|₡|\bCRC\b/i);
    expect(variants).toHaveLength(6);
    for (const [, id, copy] of variants) {
      expect(copy, id).toContain("Cuando no sabes cuánto peso usar");
      expect(copy, id).toContain(`${nfmt(TRIAL_DAYS)} días`);
      expect(copy, id).toContain("sin tarjeta");
      expect(copy, id).toContain("bananaburn.app");
      for (const field of ["Texto principal", "Título", "Descripción"]) {
        expect(copy, id).toContain(`**${field}:**`);
      }
      const main = copy.split("\n").find((line) => line.startsWith("- **Texto principal:**"))!;
      expect(main, id).toContain("sin cobro durante la prueba");
      expect(main, id).toContain("en dólares estadounidenses");
      expect(copy, id).not.toMatch(/\btico\b/i);
      if (id.endsWith("-A")) expect(copy, id).toContain("carga sugerida");
    }
  });
});
