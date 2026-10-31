import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { usd2 } from "@/lib/num";
import { PLANS } from "@/lib/plans";

const doc = readFileSync("docs/emails/primer-pago.md", "utf8");
const nav = readFileSync("src/components/app-nav.tsx", "utf8");
const emails = [...doc.matchAll(/^## Día (1|21) después del pago\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)];

describe("correos de primer pago", () => {
  it("mantiene los precios mensuales, anuales y la referencia de 100 renovaciones", () => {
    const rows = doc.split("\n")
      .filter((line) => line.startsWith("| Entreno"))
      .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
    expect(rows).toEqual(PLANS.map((plan) => [plan.name, usd2(plan.price.mes), usd2(plan.price.anual)]));

    const reference = doc.match(/100 renovaciones del mismo plan equivalen a (.+?) brutos de ese mes\./);
    expect(reference?.[1]).toBe(PLANS.map((plan) => usd2(100 * plan.price.mes)).join(" o "));
  });

  it("cada cuerpo incluye su firma y tiene menos de 120 palabras", () => {
    expect(emails.map((email) => email[1])).toEqual(["1", "21"]);
    for (const [, day, email] of emails) {
      const body = email.match(/\*\*Cuerpo:\*\*\s*([\s\S]*?)\s*\*\*Botón:\*\*/)?.[1].trim();
      expect(body, `falta el cuerpo del día ${day}`).toBeTruthy();
      expect(body).toMatch(/\n\nCoach Banana$/);
      expect(body!.split(/\s+/).length, `palabras del día ${day}, incluida la firma`).toBeLessThan(120);
    }
  });

  it("no contiene emojis, guiones largos ni menciones de inteligencia artificial", () => {
    expect(doc).not.toMatch(/[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u20E3]/u);
    expect(doc).not.toMatch(/[\u2013\u2014]/u);
    expect(doc).not.toMatch(/\bIA\b|inteligencia artificial/i);
  });

  it("usa destinos y nombres de secciones que existen juntos en la navegación", () => {
    expect(emails).toHaveLength(2);
    const items = [...nav.matchAll(/\{\s*href:\s*"([^"]+)",\s*label:\s*"([^"]+)"/g)]
      .map(([, href, label]) => ({ href, label }));
    const expected = [
      { href: "/app/entrenar", label: "Entrenar" },
      { href: "/app/progreso", label: "Progreso" },
    ];
    emails.forEach(([, , email], index) => {
      const destination = email.match(/\*\*Destino:\*\*\s*(\S+)/)?.[1];
      expect(destination).toBe(`https://bananaburn.app${expected[index].href}`);
      expect(items).toContainEqual(expected[index]);
      expect(email).toContain(`Abre ${expected[index].label}`);
    });
  });
});
