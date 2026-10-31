import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLANS, annualSaving } from "./plans";
import { usd2 } from "./num";

const doc = readFileSync("docs/upsell-anual.md", "utf8");
describe("cifras del anual", () => {
  it("mantiene el escenario de caja y el ahorro alineados con los precios", () => {
    for (const p of PLANS) {
      expect(doc).toContain(`| ${p.name} | ${usd2(p.price.mes)} | ${usd2(p.price.mes * 12)} | ${usd2(p.price.anual)} | ${usd2(annualSaving(p))} | ${usd2(p.price.anual - p.price.mes)} |`);
      expect(doc).toContain(usd2(p.price.anual * 10));
      expect(doc).toContain(usd2((p.price.anual - p.price.mes) * 10));
    }
  });
});
