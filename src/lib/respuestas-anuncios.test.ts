import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLANS, TRIAL_DAYS } from "./plans";
import { promoPrice } from "./trial";
import { usd2 } from "./num";

const doc = readFileSync("marketing/comunidad/respuestas-anuncios.md", "utf8");
const replies = doc.split("\n").filter((line) => line.startsWith("> ")).map((line) => line.slice(2));

describe("banco de respuestas de anuncios", () => {
  it("mantiene cada respuesta por debajo de 40 palabras y enlaza las de captación", () => {
    expect(replies).toHaveLength(11);
    for (const reply of replies) {
      expect(reply.trim().split(/\s+/).length).toBeLessThan(40);
      expect(reply).not.toMatch(/\p{Extended_Pictographic}|inteligencia artificial|\bIA\b|—/u);
      if (reply.includes("gratis")) {
        expect(reply).toContain(`${TRIAL_DAYS} días gratis`);
        expect(reply).toContain("sin tarjeta");
        expect(reply).toContain("https://bananaburn.app");
      }
    }
  });

  it("conserva los precios y netos de cada modalidad y promoción", () => {
    const rows = doc.split("\n").filter((line) => /^\| (Entreno)/.test(line));
    const expected = [
      ...PLANS.map((p) => [p.name + " mensual", p.price.mes] as const),
      ...PLANS.map((p) => [p.name + " anual", p.price.anual] as const),
      ...PLANS.map((p) => [p.name + " primer mes con promoción", promoPrice(p.id)] as const),
    ];
    expect(rows).toHaveLength(expected.length);
    for (const [label, amount] of expected) {
      const net = (rate: number) => usd2(amount / 1.13 - amount * rate - 0.35);
      expect(rows).toContain(`| ${label} | ${usd2(amount)} | ${net(0.039)} | ${net(0.0425)} |`);
    }
    for (const p of PLANS) {
      expect(replies[0]).toContain(`US${usd2(p.price.mes)} al mes`);
      expect(replies[1]).toContain(`US${usd2(p.price.anual)} al año`);
    }
  });
});
