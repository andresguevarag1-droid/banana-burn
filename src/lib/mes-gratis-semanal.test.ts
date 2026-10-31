import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONDO_STATUSES } from "@/lib/condos";
import { usd2 } from "@/lib/num";
import { PLANS } from "@/lib/plans";

const doc = readFileSync("marketing/condominios/mes-gratis-semanal.md", "utf8");
const nav = readFileSync("src/components/app-nav.tsx", "utf8");
const messages = [...doc.matchAll(/^```text\r?\n([\s\S]*?)^```\s*$/gm)].map((m) => m[1].trim());

describe("mensajes semanales del mes gratis", () => {
  it("cubre los cuatro pasos semanales y deja la continuidad a elección del residente", () => {
    expect(messages[0]).toMatch(/crea tu cuenta/);
    expect(messages[0]).toContain("sin tarjeta");
    expect(messages[0]).toContain("30 días cuentan desde que lo activas");
    expect(messages[1]).toContain("30 minutos en el gimnasio del edificio");
    expect(messages[1]).toMatch(/5 para caminar[\s\S]*20 para seguir[\s\S]*5 para volver/);
    expect(messages[1]).toContain("Guarda tu entreno");
    for (const field of ["peso", "medidas", "fotos"]) expect(messages[2]).toContain(field);
    expect(messages[3]).toContain("No hay cobro automático");
    for (const message of messages) expect(message).toMatch(/cada residente decide/);
    expect(doc).toContain("[fin-mes-gratis.md](fin-mes-gratis.md)");
    expect(readFileSync("marketing/condominios/fin-mes-gratis.md", "utf8")).toContain("Fin del mes gratis");
  });

  it("explica la medición de prueba a pago sin confundir continuidad con ingresos cobrados", () => {
    expect(doc).toContain("Mueve prueba a pago");
    expect(doc).toContain("denominador");
    expect(doc).toContain("numerador");
    expect(doc).toContain("status = 'succeeded'");
    expect(doc).toContain("no usar ese conteo como ingresos cobrados");
    expect(doc).toContain("No es una previsión de conversiones");
    expect(messages.join("\n")).not.toMatch(/\bIA\b|inteligencia artificial/i);
  });

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
