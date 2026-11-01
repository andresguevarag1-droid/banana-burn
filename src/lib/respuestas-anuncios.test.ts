import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLANS, TRIAL_DAYS } from "./plans";
import { promoPrice } from "./trial";
import { usd2 } from "./num";

const doc = readFileSync("marketing/comunidad/respuestas-anuncios.md", "utf8");
const bank = doc.split("## Banco listo para revisión")[1].split("La fila de spam")[0];
const replies = bank.split("\n").filter((line) => line.startsWith("| ") && !line.startsWith("| Caso") && !line.startsWith("| ---")).map((line) => line.split("|")[2].trim());

describe("banco de respuestas a anuncios", () => {
  it("mantiene las nueve variantes por debajo de 40 palabras y CTA para las consultas comerciales", () => {
    expect(replies).toHaveLength(9);
    for (const reply of replies) expect(reply.split(/\s+/).length).toBeLessThan(40);
    for (const index of [0, 1, 3, 4, 5, 6, 7]) {
      expect(replies[index]).toContain(`${TRIAL_DAYS} días`);
      expect(replies[index]).toContain("https://bananaburn.app/registro");
    }
  });

  it("conserva precios y netos de los dos procesadores contra los planes y la promoción", () => {
    for (const plan of PLANS) {
      for (const amount of [plan.price.mes, plan.price.anual]) expect(replies[0]).toContain(`US${usd2(amount)}`);
      for (const amount of [promoPrice(plan.id), plan.price.mes, plan.price.anual]) {
        const net = (rate: number) => usd2(amount / 1.13 - amount * rate - 0.35);
        expect(doc).toContain(`| ${usd2(amount)} | ${net(0.039)} | ${net(0.0425)} |`);
      }
    }
  });

  it("mantiene límites de seguridad y aprobación", () => {
    expect(doc).toContain("Nunca pedir datos de tarjeta, salud ni documentos");
    expect(doc).toContain("sin aprobación de Andrés");
    expect(bank).not.toMatch(/\p{Extended_Pictographic}|\bIA\b|—/u);
    expect(replies[5]).toContain("No podemos garantizar que tu tarjeta sea aceptada");
  });
});
