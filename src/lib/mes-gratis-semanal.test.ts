import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONDO_STATUSES } from "@/lib/condos";
import { usd2 } from "@/lib/num";
import { PLANS } from "@/lib/plans";

const doc = readFileSync("marketing/condominios/mes-gratis-semanal.md", "utf8");
const nav = readFileSync("src/components/app-nav.tsx", "utf8");
const messages = [...doc.matchAll(/^```text\r?\n([\s\S]*?)^```\s*$/gm)].map((m) => m[1].trim());

describe("mensajes semanales del mes gratis", () => {
  it("incluye exactamente cuatro mensajes de menos de 80 palabras con enlace del condominio y sin costo para la administración", () => {
    expect(messages).toHaveLength(4);
    for (const message of messages) {
      expect(message.split(/\s+/).length).toBeLessThan(80);
      expect(message).toContain("https://www.bananaburn.app/c/");
      expect(message).toContain("La administración nunca paga");
    }
  });

  it("mantiene los precios mensuales del mensaje y los mensuales y anuales de la tabla sincronizados con plans.ts", () => {
    const rows = doc.split("\n").filter((line) => /^\| Entreno(?: \+ Nutrición)? \|/.test(line))
      .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
    expect(rows).toEqual(PLANS.map((plan) => [plan.name, usd2(plan.price.mes), usd2(plan.price.anual)]));
    const copy = messages.join("\n");
    for (const plan of PLANS) {
      expect(messages[3]).toContain(`${plan.name} por ${usd2(plan.price.mes)}/mes`);
    }
    // También valida cualquier precio anual que se añada a los mensajes.
    const quotedPrices = [...copy.matchAll(/\$[\d,]+\.\d{2}/g)].map((m) => m[0]);
    const validPrices = PLANS.flatMap((plan) => [usd2(plan.price.mes), usd2(plan.price.anual)]);
    for (const price of quotedPrices) expect(validPrices).toContain(price);
  });

  it("usa las etiquetas reales de navegación y el estado del condominio", () => {
    for (const label of ["Mi plan", "Progreso"]) {
      expect(messages.join("\n")).toContain(label);
      expect(nav).toContain(`label: "${label}"`);
    }
    expect(messages[3]).toContain("Mes gratis");
    expect(CONDO_STATUSES.map(([, label]) => label)).toContain("Mes gratis");
  });

  it("no incluye teléfonos de WhatsApp, emojis ni guiones largos", () => {
    expect(doc).not.toMatch(/wa\.me|api\.whatsapp\.com|whatsapp:\/\/|(?:\+?\d[\s().-]*){8,}/i);
    expect(doc).not.toMatch(/\p{Extended_Pictographic}|\p{Regional_Indicator}|[\uFE0F\u20E3]/u);
    expect(doc).not.toContain("\u2014");
  });
});
