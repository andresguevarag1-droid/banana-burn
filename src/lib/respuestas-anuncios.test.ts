import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLANS, TRIAL_DAYS } from "./plans";
import { promoPrice } from "./trial";
import { usd2 } from "./num";

const doc = readFileSync("marketing/comunidad/respuestas-anuncios.md", "utf8");
const replies = doc.split("\n").filter((line) => line.startsWith("> ")).map((line) => line.slice(2));

describe("banco de respuestas de anuncios", () => {
  it("mantiene todas las respuestas copiables por debajo de 40 palabras", () => {
    expect(replies).toHaveLength(9);
    for (const reply of replies) {
      expect(reply.trim().split(/\s+/).length, reply).toBeLessThan(40);
      expect(reply).not.toMatch(/\p{Extended_Pictographic}|inteligencia artificial|\bIA\b|—/u);
    }
    for (const reply of replies.filter((r) => !r.startsWith("Cancela desde"))) {
      expect(reply).toContain(`${TRIAL_DAYS} días`);
      expect(reply).toContain("https://bananaburn.app");
    }
  });

  it("precios de respuesta y netos siguen los planes y la promoción", () => {
    for (const plan of PLANS) {
      expect(replies[0]).toContain(`US${usd2(plan.price.mes)}`);
      expect(replies[0]).toContain(`US${usd2(plan.price.anual)}`);
      for (const [label, amount] of [
        [`${plan.name} mensual`, plan.price.mes],
        [`${plan.name} anual`, plan.price.anual],
        [`${plan.name} primer mes con promoción`, promoPrice(plan.id)],
      ] as const) {
        const net = (rate: number) => usd2(amount / 1.13 - amount * rate - 0.35);
        expect(doc).toContain(`| ${label} | ${usd2(amount)} | ${net(0.039)} | ${net(0.0425)} |`);
      }
    }
  });
});
