import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ANNUAL_SEASON_NOTE, PLANS } from "@/lib/plans";
import { usd2 } from "@/lib/num";
import { EXPORT_BY_USER } from "@/lib/account-export";

const doc = readFileSync("docs/emails/recuperacion-prueba.md", "utf8");
const pieces = doc.split(/^## /m).slice(1, 4);
const bodies = pieces.map((piece) => piece.match(/\*\*Cuerpo:\*\*\s*([\s\S]*?)\s*\*\*Botón:\*\*/)?.[1] ?? "");
const amounts = (text: string) => text.match(/\$[\d,]+\.\d{2}/g) ?? [];
const price = (id: string) => PLANS.find((plan) => plan.id === id)!.price;
const monthly = [price("entreno").mes, price("completo").mes];
const annual = [price("entreno").anual, price("completo").anual];

describe("recuperación de prueba: copy respaldado por el producto", () => {
  it("incluye asunto y vista previa y presenta el anual antes del mensual el día 14", () => {
    for (const piece of pieces) {
      expect(piece).toMatch(/\*\*Asunto(?: \/ título)?:\*\* \S/);
      expect(piece).toMatch(/\*\*Vista previa(?: \/ apoyo)?:\*\* \S/);
    }
    expect(pieces[0]).toContain("Tu historial sigue guardado");
    expect(bodies[1].indexOf(usd2(annual[0]))).toBeLessThan(bodies[1].indexOf(usd2(monthly[0])));
  });

  it("limita la continuidad al historial existente de la misma cuenta", () => {
    for (const table of ["workouts", "workout_sets", "weights", "measurements", "progress_photos"] as const) {
      expect(EXPORT_BY_USER).toContain(table);
      expect(doc).toContain(`\`${table}\``);
    }
    for (const body of bodies) expect(body).toMatch(/registraste|guardaste/);
    expect(doc).toContain("Usar siempre la misma cuenta");
    expect(doc).toContain("no garantizar conservación perpetua");
    expect(doc).toContain("no de una suscripción reservada o de acceso gratis");
  });

  it("distingue reactivación por inactividad y define pagos por enviados sin duplicarlos", () => {
    expect(doc).toContain("3 o 7 días de inactividad");
    expect(doc).toContain("vencimiento sin compra, aunque la persona siga entrando");
    expect(doc).toContain("sustituir el correo `reactivacion` o recordatorio diario");
    expect(doc).toContain("destinatarios únicos con primer pago confirmado dentro de los 7 días posteriores al envío / correos enviados");
    expect(doc).toContain("incluir rebotes en enviados");
    expect(doc).toContain("Un primer pago cuenta una sola vez");
    expect(doc).toContain("trial_charges.status = 'succeeded'");
    expect(doc).toContain("todavía no instrumentada");
  });

  it("compara todos los precios de los correos con PLANS y usd2", () => {
    expect(amounts(bodies[0])).toEqual(monthly.map(usd2));
    expect(amounts(bodies[1])).toEqual([...annual, ...monthly].map(usd2));
    expect(amounts(bodies[2])).toEqual([]);
  });

  it("mantiene la tabla y los importes derivados sincronizados con PLANS", () => {
    const rows = doc.split("\n").filter((line) => /^\| Entreno/.test(line));
    expect(rows).toEqual(PLANS.map((plan) => `| ${plan.name} | ${usd2(plan.price.mes)} | ${usd2(plan.price.anual)} |`));
    const formula = doc.split("\n").find((line) => line.startsWith("Ingreso bruto potencial")) ?? "";
    expect(amounts(formula)).toEqual([
      ...monthly, ...annual,
      monthly[1] - monthly[0], annual[1] - annual[0],
    ].map(usd2));
    const reference = doc.split("\n").find((line) => line.startsWith("Como referencia aritmética")) ?? "";
    expect(amounts(reference)).toEqual([...monthly, ...annual].map((value) => usd2(value * 100)));
  });

  it("respalda la temporada por año pagado y el IVA con las fuentes actuales", () => {
    expect(ANNUAL_SEASON_NOTE).toBe("Incluye 1 temporada deportiva gratis");
    const plansSource = readFileSync("src/lib/plans.ts", "utf8");
    expect(plansSource).toContain("cada año pagado incluye una temporada deportiva gratis");
    expect(bodies[1]).toContain("Cada año pagado incluye una temporada deportiva gratis.");
    const pricingCopy = readFileSync("src/components/trial-card-notice.tsx", "utf8");
    expect(pricingCopy).toContain("IVA incluido.");
    for (const body of bodies.slice(0, 2)) expect(body).toContain("IVA incluido");
  });

  it("incluye tres cuerpos no vacíos de menos de 120 palabras y sin ofertas de descuento", () => {
    expect(bodies).toHaveLength(3);
    for (const [index, body] of bodies.entries()) {
      expect(body.trim().length, `cuerpo ${index + 1}`).toBeGreaterThan(0);
      expect(body.trim().split(/\s+/).length, `cuerpo ${index + 1}`).toBeLessThan(120);
      // Revisar toda la pieza pública, incluido asunto, vista previa y botón.
      expect(pieces[index]).not.toMatch(/%|descuent|oferta|promoci[oó]n|ahorr|rebaja|cup[oó]n|c[oó]digo promocional/i);
    }
  });

  it("cada botón dirige únicamente a Mi plan", () => {
    expect([...doc.matchAll(/\*\*Botón:\*\*/g)]).toHaveLength(3);
    expect([...doc.matchAll(/\*\*Destino:\*\*/g)]).toHaveLength(3);
    for (const piece of pieces) {
      expect(piece).toMatch(/\*\*Botón:\*\* .+/);
      expect(piece).toMatch(/\*\*Destino:\*\* `\/app\/suscripcion`/);
      const links = piece.match(/https?:\/\/[^\s)]+/g) ?? [];
      for (const link of links) expect(link).toBe("https://bananaburn.app/app/suscripcion");
    }
  });
});
