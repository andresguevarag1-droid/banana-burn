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
/** Comisiones que confirmó Andrés el 31 oct 2026; el IVA de 13 % va incluido en el precio. */
const ONVO = { c: 0.039, f: 0.35 };
const TILOPAY = { c: 0.0425, f: 0.35 };
const neto = (cobro: number, k: { c: number; f: number }) => cobro / 1.13 - (cobro * k.c + k.f);

describe("punto de equilibrio por usuario de pago", () => {
  const rows = tableRows(section("## 1. Punto de equilibrio"));

  const prices = [promoPrice("entreno"), promoPrice("completo"), price("entreno").mes, price("completo").mes, price("entreno").anual, price("completo").anual];

  it("el primer mes con 50 % usa el redondeo de trial.ts ($4.99 y $7.49, no $5.00 y $7.50)", () => {
    expect(promoPrice("entreno")).toBe(4.99);
    expect(promoPrice("completo")).toBe(7.49);
    expect(firstChargeMinor("entreno", "anual", PROMO_ID)).toBe(amountMinorFor("entreno", "anual"));
    expect(doc).toContain("no $5.00 y $7.50");
  });

  it("los precios salen de plans.ts y trial.ts, y los netos de la fórmula con IVA y comisión", () => {
    expect(rows.map((r) => r[1])).toEqual(prices.map(usd));
    for (const [i, p] of prices.entries()) {
      const [o, t] = [round2(neto(p, ONVO)), round2(neto(p, TILOPAY))];
      expect(rows[i].slice(2), rows[i][0]).toEqual([usd(o), usd(t), usd(round2(o - t))]);
    }
  });

  it("los netos con ONVO son los del plan de anuncios de noviembre", () => {
    expect(rows.map((r) => r[2])).toEqual(["$3.87", "$5.99", "$8.10", "$12.33", "$50.40", "$75.78"]);
  });

  it("la fórmula y las comisiones están escritas y no queda nada por confirmar", () => {
    const s = section("## 1. Punto de equilibrio");
    expect(s).toContain("**Neto por cobro = cobro ÷ 1.13 − (cobro × c + f)**");
    expect(s).toContain("**ONVO** (tarjetas de Costa Rica): c = 3.9 % y f = $0.35 por cobro.");
    expect(s).toContain("**Tilopay** (tarjetas de fuera de Costa Rica): c = 4.25 % y f = $0.35 por cobro.");
    expect(s).toContain("Lo paga Atlas Resources SRL");
    expect(s).toContain(`4.99 ÷ 1.13 − (4.99 × 0.039 + 0.35) = 4.4159 − 0.5446 = **${usd(round2(neto(4.99, ONVO)))}**`);
    expect(doc).not.toMatch(/por confirmar/);
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

  it.each(cases)("%s: primer pago y 3 meses salen de la fórmula del neto y la muestran", (name, first, three) => {
    const r = rows.find((x) => x[0] === name)!;
    const sum = (k: typeof ONVO) => round2(three.reduce((a, b) => a + neto(b, k), 0));
    expect(r[1]).toBe(usd(round2(neto(first, ONVO))));
    expect(r[2]).toContain(`neto(${first})`);
    expect(r[3]).toBe(usd(sum(ONVO)));
    expect(r[4]).toContain("neto(");
    expect(r[5]).toBe(`${usd(round2(neto(first, TILOPAY)))} / ${usd(sum(TILOPAY))}`);
    expect(r[6]).toMatch(/por medir|no depende de la renovación/);
  });

  it("la renovación no tiene dato y dice por medir", () => {
    expect(section("## 2. Costo máximo")).toMatch(/Renovación en el mes 2 \(`r2`\) y en el mes 3 \(`r3`\): \*\*por medir\*\*/);
  });

  it("el techo del acta es la recuperación en 2 meses de Entreno con 50 %", () => {
    expect(doc).toContain(`${usd(round2(promoPrice("entreno") + price("entreno").mes))} del [acta]`);
  });
});

describe("la regla y el reporte", () => {
  it("el gasto de la semana siguiente no pasa de los ingresos nuevos netos ni de los topes aprobados", () => {
    const rule = section("## 3. La regla");
    expect(rule).toContain("**Gasto máximo de la semana N + 1 = mínimo(ingresos nuevos netos de la semana N, tope semanal, tope del mes − gasto del mes)**");
    expect(rule).toContain("**Tope semanal:** **$70.00**");
    expect(rule).toContain("**Tope del mes:** **$200.00** en noviembre");
    expect(rule).toContain("I = B ÷ 1.13 − (0.039 × B de ONVO + 0.0425 × B de Tilopay) − 0.35 × N");
    expect(rule).toMatch(/nunca "subir"/);
  });

  it("no propone gasto nuevo: los únicos montos de la regla son los topes de Andrés y $0.00", () => {
    expect(doc).toMatch(/\*\*no propone gasto nuevo\*\*/);
    expect([...new Set(section("## 3. La regla").match(/\$\d[\d,]*(\.\d+)?/g))]).toEqual(["$70.00", "$200.00", "$0.00"]);
  });

  it("Costa Rica y Colombia van en conjuntos separados, cada uno con su costo por usuario de pago", () => {
    const s = section("## 3. La regla");
    expect(s).toContain("**Costa Rica y Colombia, cada país en su propio conjunto de anuncios**");
    const rows = tableRows(s.slice(s.indexOf("| Conjunto |")));
    expect(rows.map((r) => r[0])).toEqual(["Costa Rica", "Colombia"]);
    expect(rows[0][3]).toBe("G de Costa Rica ÷ N de ONVO");
    expect(rows[1][3]).toBe("G de Colombia ÷ N de Tilopay");
    expect(readFileSync("src/lib/pay-provider.ts", "utf8")).toMatch(/if \(!c \|\| c === "CR"\) return "onvo";\s+return "tilopay";/);
  });

  it("la plantilla trae gasto, pagos por plan, ingresos, CAC, margen y decisión, sin cifras inventadas", () => {
    const tpl = doc.slice(doc.indexOf("### Plantilla"), doc.indexOf("### Cómo se decide"));
    for (const field of ["Gasto en Meta Ads", "Pagos nuevos por plan", "Ingresos de la semana", "CAC de la semana", "Margen de la semana", "Decisión propuesta: subir / mantener / pausar"])
      expect(tpl).toContain(field);
    for (const line of tpl.split("\n").filter((l) => /^\s+(Entreno|Total de pagos)/.test(l))) expect(line).toMatch(/por medir$/);
    for (const formula of ["G ÷ N", "I − G", "B ÷ 1.13 − (0.039 × B de ONVO + 0.0425 × B de Tilopay) − 0.35 × N", "mínimo(I, tope semanal, tope del mes − gasto del mes)"])
      expect(tpl).toContain(formula);
    for (const line of tpl.split("\n").filter((l) => /^\s+Con (ONVO|Tilopay)/.test(l))) expect(line).toMatch(/por medir$/);
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
      create table payment_methods (user_id uuid primary key, provider text);
    `);
  }, 30000);
  afterAll(async () => { await db.close(); });

  const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
  const card = (n: number, provider: string) => `insert into payment_methods values ('${id(n)}', '${provider}');`;
  const charge = (n: number, plan: string, billing: string, promo: boolean, at: string, status = "succeeded") =>
    `insert into trial_charges values ('${id(n)}', '${status}', '${plan}', '${billing}',
      ${firstChargeMinor(plan as "entreno", billing as "mes", promo ? PROMO_ID : null)}, ${promo ? `'${PROMO_ID}'` : "null"}, '${at}', '${at}');`;
  const sub = (n: number, plan: string, billing: string, created: string, end = "2026-12-20", status = "active") =>
    `insert into subscriptions values ('${id(n)}', '${status}', 'onvo', '${plan}', '${billing}', '${end}', false, '${created}');`;

  async function query(seed: string) {
    await db.exec(`truncate trial_charges, subscriptions, comp_grants, payment_methods; ${seed}`);
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

  it("separa ONVO y Tilopay y calcula el neto con el IVA y la comisión de cada uno", async () => {
    const rows = await query(
      charge(1, "entreno", "mes", true, "2026-11-08 12:00+00") +             // sin tarjeta guardada: ONVO
      charge(2, "completo", "mes", true, "2026-11-08 12:00+00") + card(2, "tilopay") +
      charge(3, "entreno", "anual", false, "2026-11-04 12:00+00") + card(3, "onvo") +
      `insert into subscriptions values ('${id(4)}', 'active', 'tilopay', 'completo', 'mes', '2026-12-20', false, '2026-11-04 12:00+00');`);
    const sub = (p: string) => rows.find((r) => r.procesador === p && r.plan === "subtotal")!;
    const onvo = neto(promoPrice("entreno"), ONVO) + neto(price("entreno").anual, ONVO);
    const tilo = neto(promoPrice("completo"), TILOPAY) + neto(price("completo").mes, TILOPAY);
    expect(sub("onvo")).toMatchObject({ pagos_nuevos: 2, billing: "total", primer_mes_50: "total" });
    expect(Number(sub("onvo").ingresos_netos_usd)).toBe(round2(onvo));
    expect(sub("tilopay")).toMatchObject({ pagos_nuevos: 2 });
    expect(Number(sub("tilopay").ingresos_netos_usd)).toBe(round2(tilo));
    const total = rows.find((r) => r.plan === "total")!;
    expect(total.procesador).toBe("total");
    expect(Number(total.ingresos_netos_usd)).toBe(round2(onvo + tilo));
    expect(Number(rows.find((r) => r.procesador === "onvo" && r.plan === "entreno" && r.billing === "mes")!.ingresos_netos_usd))
      .toBe(round2(neto(promoPrice("entreno"), ONVO)));
    expect(rows.at(-1)).toBe(total);
  });

  it.each([
    ["entreno", "mes", true], ["completo", "mes", true],
    ["entreno", "mes", false], ["completo", "mes", false],
    ["entreno", "anual", false], ["completo", "anual", false],
  ] as const)("SQL: %s %s promo=%s calcula ambos procesadores sin redondear cada cobro", async (plan, billing, promo) => {
    const amount = firstChargeMinor(plan, billing, promo ? PROMO_ID : null) / 100;
    const seed = Array.from({ length: 6 }, (_, i) =>
      charge(i + 1, plan, billing, promo, "2026-11-04 12:00+00") +
      card(i + 1, i < 3 ? "onvo" : "tilopay")).join("");
    const rows = await query(seed);
    for (const [provider, fees] of [["onvo", ONVO], ["tilopay", TILOPAY]] as const) {
      const detail = rows.find((r) => r.procesador === provider && r.plan === plan)!;
      const subtotal = rows.find((r) => r.procesador === provider && r.plan === "subtotal")!;
      for (const row of [detail, subtotal]) {
        expect(row.pagos_nuevos).toBe(3);
        expect(Number(row.ingresos_brutos_usd)).toBe(round2(3 * amount));
        expect(Number(row.ingresos_netos_usd)).toBe(round2(3 * neto(amount, fees)));
      }
    }
    const total = rows.find((r) => r.plan === "total")!;
    expect(total.pagos_nuevos).toBe(6);
    expect(Number(total.ingresos_netos_usd)).toBe(round2(3 * neto(amount, ONVO) + 3 * neto(amount, TILOPAY)));
  });

  it("no cuenta cortesías vigentes, renovaciones ni suscripciones vencidas, y una semana vacía da cero", async () => {
    const rows = await query(
      charge(1, "entreno", "mes", true, "2026-11-04 12:00+00") +
      `insert into comp_grants values ('${id(1)}', '2026-10-01', '2026-12-01', null);` +
      sub(2, "entreno", "mes", "2026-10-20 12:00+00") + sub(2, "entreno", "mes", "2026-11-04 12:00+00") +
      sub(3, "completo", "mes", "2026-11-04 12:00+00", "2026-11-10"));
    expect(rows).toEqual([{ procesador: "total", plan: "total", billing: "total", primer_mes_50: "total", pagos_nuevos: 0, ingresos_brutos_usd: "0", ingresos_netos_usd: "0" }]);
  });
});
