import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { usd2 } from "@/lib/num";
import { PLANS } from "@/lib/plans";
import { longDate, SEASONS_T1, SPORTS } from "@/lib/seasons";

const doc = readFileSync("marketing/comunidad/temporada-1-ventas.md", "utf8");
const fullDate = (iso: string) => `${longDate(iso)} de ${iso.slice(0, 4)}`;
const priceRows = doc.split("\n").filter((line) => line.startsWith("| "));

function productRow(product: string): string {
  const row = priceRows.find((line) => line.startsWith(`| ${product} |`));
  expect(row, `falta el producto ${product}`).toBeDefined();
  return row!;
}

describe("Temporada 1: ventas orgánicas", () => {
  it.each(SEASONS_T1)("vincula el precio de $sport con seasons.ts", (season) => {
    expect(productRow(`Temporada ${SPORTS[season.sport].name}`))
      .toContain(`| US${usd2(season.priceMinor / 100)} |`);
  });

  it.each(PLANS)("vincula los precios de $name con plans.ts", (plan) => {
    expect(productRow(`${plan.name} mensual`)).toContain(`| US${usd2(plan.price.mes)}/mes |`);
    expect(productRow(`${plan.name} anual`)).toContain(`| US${usd2(plan.price.anual)}/año |`);
  });

  it.each(SEASONS_T1)("usa las fechas oficiales de $sport", (season) => {
    expect(doc).toContain(`del **${fullDate(season.startsOn)} al ${fullDate(season.endsOn)}**`);
    expect(doc).toContain(`Inscripciones hasta el **${fullDate(season.enrollUntil)}**, incluido`);
  });

  it("calcula las dos comparaciones de doce mensualidades más cada temporada", () => {
    const comparison = doc.split("\n").find((line) => line.startsWith("Referencia por decisión,"));
    expect(comparison).toBeDefined();
    for (const plan of PLANS) {
      const totals = SEASONS_T1.map((season) =>
        `US${usd2(plan.price.mes * 12 + season.priceMinor / 100)}`).join(" / ");
      expect(comparison).toContain(`${plan.name} ${totals}`);
      expect(comparison).toContain(`frente a US${usd2(plan.price.anual)}`);
    }
  });

  it("solo usa importes US$ que salen de plans.ts o seasons.ts", () => {
    const cents = (n: number) => Math.round(n * 100);
    const known = new Set<number>([0]);
    for (const season of SEASONS_T1) known.add(cents(season.priceMinor / 100));
    for (const plan of PLANS) {
      known.add(cents(plan.price.mes));
      known.add(cents(plan.price.anual));
      for (const season of SEASONS_T1) known.add(cents(plan.price.mes * 12 + season.priceMinor / 100));
    }
    const amounts = [...doc.matchAll(/US\$(\d+(?:\.\d+)?)/g)].map((m) => cents(Number(m[1])));
    expect(amounts.length).toBeGreaterThan(0);
    for (const amount of amounts) expect(known.has(amount), `importe no conocido: ${amount / 100}`).toBe(true);
  });

  it("respeta las reglas de marca en todo el documento", () => {
    expect(doc).not.toMatch(/\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u);
    expect(doc).not.toMatch(/[\u2013\u2014]/u);
    expect(doc).not.toMatch(/\bIA\b/i);
  });
});
