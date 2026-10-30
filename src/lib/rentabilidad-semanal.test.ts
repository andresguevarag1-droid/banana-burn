// La regla de presupuesto autofinanciado (docs/metas/rentabilidad-semanal.md) cita precios de plans.ts y trial.ts y se
// alimenta con rentabilidad-semanal.sql: estas pruebas vigilan las cifras, las reglas de marca y que la consulta sea de solo lectura.
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { usd2 as usd } from "@/lib/num";
import { PLANS } from "@/lib/plans";
import { amountMinorFor, firstChargeMinor, promoPrice, PROMO_ID } from "@/lib/trial";

const doc = readFileSync("docs/metas/rentabilidad-semanal.md", "utf8");
const sql = readFileSync("docs/metas/rentabilidad-semanal.sql", "utf8");

const cells = (line: string) => line.split("|").slice(1, -1).map((c) => c.trim());
function section(title: string): string {
  const start = doc.indexOf(title);
  expect(start, `falta la sección ${title}`).toBeGreaterThanOrEqual(0);
  const next = doc.indexOf("\n## ", start + title.length);
  return doc.slice(start, next === -1 ? undefined : next);
}
const tableRows = (text: string) => text.split("\n").filter((l) => l.startsWith("|") && !/^\|\s*-/.test(l)).slice(1).map(cells);
const price = (id: string) => PLANS.find((p) => p.id === id)!.price;
const round2 = (n: number) => Math.round(n * 100) / 100;

describe("punto de equilibrio por usuario de pago", () => {
  const rows = tableRows(section("## 1. Punto de equilibrio"));

  it("el primer mes con 50 % usa el redondeo de trial.ts ($4.99 y $7.49, no $5.00 y $7.50)", () => {
    expect(promoPrice("entreno")).toBe(4.99);
    expect(promoPrice("completo")).toBe(7.49);
    expect(firstChargeMinor("entreno", "anual", PROMO_ID)).toBe(amountMinorFor("entreno", "anual"));
    expect(rows[0].slice(1, 3)).toEqual([usd(promoPrice("entreno")), usd(promoPrice("completo"))]);
    expect(doc).toContain("no $5.00 y $7.50");
  });

  it("los meses siguientes y el anual salen de plans.ts", () => {
    expect(rows[1].slice(1, 3)).toEqual([usd(price("entreno").mes), usd(price("completo").mes)]);
    expect(rows[2].slice(1, 3)).toEqual([usd(price("entreno").anual), usd(price("completo").anual)]);
  });

  it("cada neto muestra su fórmula y la comisión queda por confirmar con Andrés", () => {
    for (const r of rows) expect(r[3]).toMatch(/precio × \(1 − c\) − f; c y f por confirmar con Andrés/);
    expect(section("## 1. Punto de equilibrio")).toMatch(/`c` = comisión porcentual del procesador por cobro: \*\*por confirmar con Andrés\*\*/);
  });
});

describe("CAC máximo por plan", () => {
  const rows = tableRows(section("## 2. Costo máximo"));
  const cases: [string, number, number[]][] = [
    ["Entreno, primer mes con 50 %", promoPrice("entreno"), [promoPrice("entreno"), price("entreno").mes, price("entreno").mes]],
    ["Entreno, mensual sin 50 %", price("entreno").mes, [price("entreno").mes, price("entreno").mes, price("entreno").mes]],
    ["Entreno, anual", price("entreno").anual, [price("entreno").anual]],
    ["Entreno + Nutrición, primer mes con 50 %", promoPrice("completo"), [promoPrice("completo"), price("completo").mes, price("completo").mes]],
    ["Entreno + Nutrición, mensual sin 50 %", price("completo").mes, [price("completo").mes, price("completo").mes, price("completo").mes]],
    ["Entreno + Nutrición, anual", price("completo").anual, [price("completo").anual]],
  ];

  it("tiene las 6 combinaciones de plan y forma de pago", () => {
    expect(rows.map((r) => r[0])).toEqual(cases.map((c) => c[0]));
  });

  it.each(cases)("%s: primer pago y 3 meses cuadran con el código y muestran su fórmula", (name, first, three) => {
    const r = rows.find((x) => x[0] === name)!;
    expect(r[1]).toBe(usd(first));
    expect(r[2]).toContain(String(first));
    expect(r[3]).toBe(usd(round2(three.reduce((a, b) => a + b, 0))));
    expect(r[4]).toMatch(/menos comisión de [13] cobros?/);
    expect(r[5]).toMatch(/por medir|no depende de la renovación/);
  });

  it("la renovación no tiene dato y dice por medir", () => {
    expect(section("## 2. Costo máximo")).toMatch(/Renovación en el mes 2 \(`r2`\) y en el mes 3 \(`r3`\): \*\*por medir\*\*/);
  });

  it("el techo del acta es la recuperación en 2 meses de Entreno con 50 %", () => {
    expect(doc).toContain(`${usd(round2(promoPrice("entreno") + price("entreno").mes))} del [acta]`);
  });
});

describe("la regla y el reporte", () => {
  it("el gasto de la semana siguiente no pasa de los ingresos nuevos netos ni del tope de Andrés", () => {
    const rule = section("## 3. La regla");
    expect(rule).toContain("**Gasto máximo de la semana N + 1 = mínimo(ingresos nuevos netos de la semana N, tope semanal)**");
    expect(rule).toMatch(/\*\*Tope semanal:\*\* \*\*por confirmar con Andrés\*\*/);
    expect(rule).toMatch(/nunca "subir"/);
  });

  it("no propone gasto nuevo: el único monto de la regla es $0.00", () => {
    expect(doc).toMatch(/\*\*no propone gasto nuevo\*\*/);
    expect(section("## 3. La regla").match(/\$\d[\d,]*(\.\d+)?/g)).toEqual(["$0.00"]);
  });

  it("la plantilla trae gasto, pagos por plan, ingresos, CAC, margen y decisión, sin cifras inventadas", () => {
    const tpl = doc.slice(doc.indexOf("### Plantilla"), doc.indexOf("### Cómo se decide"));
    for (const field of ["Gasto en Meta Ads", "Pagos nuevos por plan", "Ingresos de la semana", "CAC de la semana", "Margen de la semana", "Decisión propuesta: subir / mantener / pausar"])
      expect(tpl).toContain(field);
    for (const line of tpl.split("\n").filter((l) => /^\s+(Entreno|Total de pagos)/.test(l))) expect(line).toMatch(/por medir$/);
    for (const formula of ["G ÷ N", "I − G", "B × (1 − c) − f × N", "mínimo(I, tope semanal)"]) expect(tpl).toContain(formula);
    expect(tpl).toContain("tablero-diario.sql");
  });

  it("decide en orden pausar, mantener, subir", () => {
    const rows = tableRows(doc.slice(doc.indexOf("### Cómo se decide")));
    expect(rows.slice(0, 3).map((r) => r[1])).toEqual(["**Pausar**", "**Mantener**", "**Subir**"]);
  });

  it("dice qué paso del embudo mueve, cómo se mide y por qué no agrega costo", () => {
    const s = section("## 5. Qué paso del embudo");
    expect(s).toMatch(/\*\*Paso:\*\* pago/);
    expect(s).toMatch(/\*\*Cómo se mide:\*\*/);
    expect(s).toMatch(/\*\*Por qué no agrega costo:\*\*/);
  });

  it("sigue las reglas de marca", () => {
    expect(doc).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(doc).not.toMatch(/—|\bIA\b|banano|!/);
  });
});

describe("rentabilidad-semanal.sql", () => {
  it("es una sola consulta de solo lectura con los precios de plans.ts", () => {
    expect(sql).not.toMatch(/\b(insert|update|delete|create|drop|alter|truncate|grant)\b/i);
    for (const p of PLANS) for (const b of ["mes", "anual"] as const)
      expect(sql).toContain(`('${p.id}', '${b}', ${amountMinorFor(p.id, b)})`);
  });

  const db = new PGlite();
  beforeAll(async () => {
    await db.exec(`
      create table trial_charges (user_id uuid unique, status text, plan text, billing text, amount_minor int,
        promo text, last_attempt_at timestamptz, updated_at timestamptz);
      create table subscriptions (user_id uuid, status text, provider text, plan text, billing text,
        current_period_end timestamptz, cancel_at_period_end boolean default false, created_at timestamptz);
      create table comp_grants (user_id uuid, starts_at timestamptz, expires_at timestamptz, revoked_at timestamptz);
    `);
  }, 30000);
  afterAll(async () => { await db.close(); });

  const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
  const charge = (n: number, plan: string, billing: string, promo: boolean, at: string, status = "succeeded") =>
    `insert into trial_charges values ('${id(n)}', '${status}', '${plan}', '${billing}',
      ${firstChargeMinor(plan as "entreno", billing as "mes", promo ? PROMO_ID : null)}, ${promo ? `'${PROMO_ID}'` : "null"}, '${at}', '${at}');`;
  const sub = (n: number, plan: string, billing: string, created: string, end = "2026-12-20", status = "active") =>
    `insert into subscriptions values ('${id(n)}', '${status}', 'onvo', '${plan}', '${billing}', '${end}', false, '${created}');`;

  async function query(seed: string) {
    await db.exec(`truncate trial_charges, subscriptions, comp_grants; ${seed}`);
    const report = sql.replace("now() as observado_en", "timestamptz '2026-11-16 12:00+00' as observado_en");
    await db.exec("begin read only");
    try { return (await db.query<Record<string, unknown>>(report)).rows; } finally { await db.exec("rollback"); }
  }

  it("cuenta la semana de lunes a domingo en hora de Costa Rica, por plan, con montos reales", async () => {
    const rows = await query(
      charge(1, "entreno", "mes", true, "2026-11-08 06:00+00") +   // domingo 8 nov, medianoche CR: entra
      charge(2, "completo", "mes", true, "2026-11-08 07:00+00") +
      charge(3, "entreno", "anual", true, "2026-11-03 15:00+00") + // el anual no lleva 50 %
      charge(4, "entreno", "mes", false, "2026-11-02 05:59+00") +  // domingo 1 nov en CR: fuera
      charge(5, "entreno", "mes", false, "2026-11-09 06:00+00") +  // lunes 9 nov en CR: fuera
      charge(6, "completo", "mes", true, "2026-11-05 12:00+00", "failed") +
      sub(7, "completo", "anual", "2026-11-04 12:00+00") +         // pago en el muro de planes
      sub(1, "entreno", "mes", "2026-11-08 06:00+00"));           // ya contado por su cobro de prueba
    const total = rows.find((r) => r.plan === "total")!;
    expect(total.pagos_nuevos).toBe(4);
    expect(Number(total.ingresos_brutos_usd)).toBe(round2(promoPrice("entreno") + promoPrice("completo") + price("entreno").anual + price("completo").anual));
    expect(rows.find((r) => r.plan === "entreno" && r.billing === "anual")).toMatchObject({ primer_mes_50: "false", pagos_nuevos: 1 });
    expect(rows.find((r) => r.plan === "entreno" && r.billing === "mes")).toMatchObject({ primer_mes_50: "true", pagos_nuevos: 1 });
  });

  it("no cuenta cortesías vigentes, renovaciones ni suscripciones vencidas, y una semana vacía da cero", async () => {
    const rows = await query(
      charge(1, "entreno", "mes", true, "2026-11-04 12:00+00") +
      `insert into comp_grants values ('${id(1)}', '2026-10-01', '2026-12-01', null);` +
      sub(2, "entreno", "mes", "2026-10-20 12:00+00") + sub(2, "entreno", "mes", "2026-11-04 12:00+00") +
      sub(3, "completo", "mes", "2026-11-04 12:00+00", "2026-11-10"));
    expect(rows).toEqual([{ plan: "total", billing: "total", primer_mes_50: "total", pagos_nuevos: 0, ingresos_brutos_usd: "0" }]);
  });
});
