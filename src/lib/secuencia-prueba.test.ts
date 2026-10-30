import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { usd2 } from "@/lib/num";
import { ANNUAL_SEASON_NOTE, PLANS, annualSaving } from "@/lib/plans";

const doc = readFileSync("docs/emails/secuencia-prueba.md", "utf8");
const nav = readFileSync("src/components/app-nav.tsx", "utf8");
const emails = [...doc.matchAll(/^## Día (\d+):[^\n]*\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)]
  .map(([, day, text]) => ({ day: Number(day), text }));

function field(text: string, name: string): string {
  const match = text.match(new RegExp(`\\*\\*${name}:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\n\\*\\*|$)`));
  expect(match, `falta ${name}`).not.toBeNull();
  return match![1].trim();
}

describe("secuencia de correos durante la prueba", () => {
  it("conserva las tres piezas de los días 2, 4 y 6", () => {
    expect(emails.map(({ day }) => day)).toEqual([2, 4, 6]);
  });

  it("vincula los precios y ahorros de cada plan al cuerpo del día 6", () => {
    const body = field(emails.find(({ day }) => day === 6)!.text, "Cuerpo");
    const annual = body.match(/Anual: ([\s\S]*?)\n\n/)![1];
    const monthly = body.match(/Mensual: ([\s\S]*?)\n\n/)![1];
    const annualAmounts = PLANS.flatMap((plan) => [usd2(plan.price.anual), usd2(annualSaving(plan))]);
    expect(annual.match(/\$[\d,]+\.\d{2}/g)).toEqual(annualAmounts);
    expect(monthly.match(/\$[\d,]+\.\d{2}/g)).toEqual(PLANS.map((plan) => usd2(plan.price.mes)));
    for (const plan of PLANS) {
      expect(annual).toContain(`${plan.name} cuesta ${usd2(plan.price.anual)} al año; ahorras ${usd2(annualSaving(plan))}`);
    }
  });

  it("mantiene la promesa de temporadas alineada con ANNUAL_SEASON_NOTE", () => {
    for (const day of [4, 6]) {
      const body = field(emails.find((email) => email.day === day)!.text, "Cuerpo");
      const sentence = body.match(/(?:cada año pagado de un plan anual|Cada año pagado) incluye [^.]+\./)?.[0];
      expect(sentence, `temporadas del día ${day}`).toBeDefined();
      const canonical = sentence!
        .replace(/^(?:cada año pagado de un plan anual|Cada año pagado) incluye una /, "Incluye 1 ")
        .replace(/\.$/, "");
      expect(canonical).toBe(ANNUAL_SEASON_NOTE);
    }
  });

  it("cada asunto tiene menos de 45 caracteres y cada cuerpo menos de 120 palabras", () => {
    for (const { day, text } of emails) {
      const subject = field(text, "Asunto");
      const body = field(text, "Cuerpo");
      expect(subject.length, `asunto del día ${day}`).toBeGreaterThan(0);
      expect([...subject].length, `asunto del día ${day}`).toBeLessThan(45);
      expect(body.split(/\s+/).length, `cuerpo del día ${day}`).toBeLessThan(120);
    }
    const alternative = doc.match(/B usa «([^»]+)»/);
    expect(alternative).not.toBeNull();
    expect([...alternative![1]].length).toBeLessThan(45);
  });

  it("los botones llevan a páginas existentes de la app", () => {
    const routes = emails.map(({ text }) => text.match(/\*\*Ruta:\*\* `([^`]+)`/)?.[1]);
    expect(routes).toEqual(["/app/entrenar", "/app/incluye", "/app/suscripcion"]);
    for (const route of routes) {
      expect(existsSync(`src/app/(app)${route}/page.tsx`), route).toBe(true);
    }
  });

  it("Mi plan usa el nombre de la pantalla en la navegación", () => {
    const label = nav.match(/href: "\/app\/suscripcion", label: "([^"]+)"/)?.[1];
    expect(label).toBe("Mi plan");
    const email = emails.find(({ day }) => day === 6)!.text;
    expect(field(email, "Vista previa")).toContain(label!);
    expect(field(email, "Cuerpo")).toContain(`En ${label} puedes`);
  });
});
