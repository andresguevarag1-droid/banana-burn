import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pruebaIniciada, recordatorioCobro } from "@/lib/email/templates";

// QA del issue #90: reglas de marca, campos completos, medición y que la secuencia no repita los correos transaccionales.
const doc = readFileSync("docs/emails/secuencia-prueba.md", "utf8");
const emails = [...doc.matchAll(/^## Día (\d+):[^\n]*\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)]
  .map(([, day, text]) => ({ day: Number(day), text }));

function field(text: string, name: string): string {
  const match = text.match(new RegExp(`\\*\\*${name}:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\n\\*\\*|$)`));
  expect(match, `falta ${name}`).not.toBeNull();
  return match![1].trim();
}

const charge = { name: "Ana Pérez", plan: "Entreno", amount: 9.99, chargeAt: "2026-11-08T06:00:00.000Z", kind: "prueba" as const };

describe("secuencia de prueba: QA del issue #90", () => {
  it("cada correo trae asunto, vista previa, cuerpo, botón y ruta", () => {
    expect(emails).toHaveLength(3);
    for (const { text } of emails) {
      for (const name of ["Asunto", "Vista previa", "Cuerpo", "Botón", "Ruta"]) expect(field(text, name).length, name).toBeGreaterThan(0);
    }
  });

  it("cuenta las palabras del cuerpo sin la firma y sin vacíos", () => {
    for (const { day, text } of emails) {
      const words = field(text, "Cuerpo").replace(/\n+Coach Banana$/, "").split(/\s+/).filter(Boolean);
      expect(words.length, `día ${day}`).toBeGreaterThan(20);
      expect(words.length, `día ${day}`).toBeLessThan(120);
    }
  });

  it("respeta la marca: sin emojis, guiones largos, IA, testimonios ni exclamaciones en serie", () => {
    expect(doc).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(doc).not.toMatch(/[—–]/);
    expect(doc).not.toMatch(/\b(IA|inteligencia artificial|AI)\b/);
    expect(doc).not.toMatch(/!{2,}|banano/i);
    expect(doc).not.toMatch(/testimonio de|según (María|Juan)|“[^”]+”,? dice/i);
    expect(doc).toContain("#FFF8E3");
    expect(doc).toContain("#FFD60A");
    expect(doc).toContain("#1B1505");
    expect(doc).toContain("Plus Jakarta Sans");
  });

  it("si menciona GLP-1 incluye el aviso médico", () => {
    if (/GLP-1|Banana Shield/.test(doc)) expect(doc).toContain("No sustituye la indicación de tu médico.");
  });

  it("dice cómo se mide: aperturas, clics y pruebas que pasan a pago", () => {
    const medicion = doc.slice(doc.indexOf("## Medición"));
    expect(medicion).toMatch(/Aperturas/);
    expect(medicion).toMatch(/Clics/);
    expect(medicion).toMatch(/Pruebas que pasan a pago/);
    expect(medicion).toContain("trial_charges.status = 'succeeded'");
  });

  it("no repite pruebaIniciada ni recordatorioCobro", () => {
    const transactional = [pruebaIniciada(charge), recordatorioCobro(charge)];
    for (const { day, text } of emails) {
      const subject = field(text, "Asunto");
      const preview = field(text, "Vista previa");
      const body = field(text, "Cuerpo");
      for (const mail of transactional) {
        expect(subject, `asunto del día ${day}`).not.toBe(mail.subject);
        expect(preview, `vista previa del día ${day}`).not.toBe(mail.preheader);
      }
      // Los transaccionales confirman tarjeta, fecha y cancelación: la secuencia no lo repite.
      expect(`${subject} ${preview} ${body}`, `día ${day}`).not.toMatch(/tarjeta|se cobra|cancela|en 2 días/i);
    }
  });
});
