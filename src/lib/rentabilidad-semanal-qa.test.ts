// QA de la PR #103: casos de rentabilidad-semanal.sql y de las tablas de CAC que las pruebas del documento no cubren.
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { usd2 as usd } from "@/lib/num";
import { PLANS } from "@/lib/plans";
import { promoPrice } from "@/lib/trial";

const doc = readFileSync("docs/metas/rentabilidad-semanal.md", "utf8");
const sql = readFileSync("docs/metas/rentabilidad-semanal.sql", "utf8");
const price = (id: string) => PLANS.find((p) => p.id === id)!.price;

describe("tabla de CAC máximo", () => {
  it("la recuperación en 3 meses suma los 3 cobros de cada plan", () => {
    const rows = doc.split("\n").filter((l) => /^\| Entreno/.test(l)).map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
    const expected: Record<string, [number, number]> = {};
    for (const id of ["entreno", "completo"]) {
      const name = id === "entreno" ? "Entreno" : "Entreno + Nutrición";
      const p = price(id);
      expected[`${name}, primer mes con 50 %`] = [promoPrice(id as "entreno"), promoPrice(id as "entreno") + 2 * p.mes];
      expected[`${name}, mensual sin 50 %`] = [p.mes, 3 * p.mes];
      expected[`${name}, anual`] = [p.anual, p.anual];
    }
    const cac = rows.filter((r) => r[0] in expected);
    expect(cac).toHaveLength(6);
    for (const r of cac) {
      const [first, three] = expected[r[0]];
      expect(r[1], r[0]).toBe(usd(first));
      expect(r[3], r[0]).toBe(usd(Math.round(three * 100) / 100));
    }
  });
});

describe("rentabilidad-semanal.sql, casos límite", () => {
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
  async function total(seed: string, observed = "2026-11-16 12:00+00") {
    await db.exec(`truncate trial_charges, subscriptions, comp_grants; ${seed}`);
    const report = sql.replace("now() as observado_en", `timestamptz '${observed}' as observado_en`);
    const rows = (await db.query<Record<string, unknown>>(report)).rows;
    const t = rows.find((r) => r.plan === "total")!;
    return { n: t.pagos_nuevos, usd: Number(t.ingresos_brutos_usd) };
  }

  it("sin last_attempt_at fecha el cobro con updated_at", async () => {
    expect(await total(`insert into trial_charges values ('${id(1)}', 'succeeded', 'entreno', 'mes', 999, null, null, '2026-11-04 12:00+00');`))
      .toEqual({ n: 1, usd: 9.99 });
    expect(await total(`insert into trial_charges values ('${id(1)}', 'succeeded', 'entreno', 'mes', 999, null, null, '2026-11-12 12:00+00');`))
      .toEqual({ n: 0, usd: 0 });
  });

  it("no cuenta pagos posteriores al momento en que se corre", async () => {
    const seed = `insert into trial_charges values ('${id(1)}', 'succeeded', 'completo', 'mes', 749, 'primer_mes_50', '2026-11-06 12:00+00', '2026-11-06 12:00+00');`;
    expect(await total(seed, "2026-11-05 12:00+00")).toEqual({ n: 0, usd: 0 });
    expect(await total(seed)).toEqual({ n: 1, usd: 7.49 });
  });

  it("cuenta la suscripción cancelada al final del periodo y la fecha con la primera fila de la persona", async () => {
    expect(await total(
      `insert into subscriptions values ('${id(2)}', 'canceled', 'tilopay', 'completo', 'mes', '2026-12-04', true, '2026-11-04 12:00+00');`,
    )).toEqual({ n: 1, usd: 14.99 });
    // Primera fila en octubre, renovación en la semana: no es pago nuevo.
    expect(await total(
      `insert into subscriptions values ('${id(2)}', 'canceled', 'onvo', 'entreno', 'mes', '2026-11-01', false, '2026-10-01 12:00+00');` +
      `insert into subscriptions values ('${id(2)}', 'active', 'onvo', 'entreno', 'mes', '2026-12-04', false, '2026-11-04 12:00+00');`,
    )).toEqual({ n: 0, usd: 0 });
    // Cancelada sin seguir vigente: no aparece.
    expect(await total(
      `insert into subscriptions values ('${id(2)}', 'canceled', 'onvo', 'entreno', 'mes', '2026-12-04', false, '2026-11-04 12:00+00');`,
    )).toEqual({ n: 0, usd: 0 });
  });

  it("una cortesía revocada o vencida no excluye el pago", async () => {
    const pay = `insert into trial_charges values ('${id(1)}', 'succeeded', 'entreno', 'anual', 5999, null, '2026-11-04 12:00+00', '2026-11-04 12:00+00');`;
    expect(await total(pay + `insert into comp_grants values ('${id(1)}', '2026-10-01', '2026-12-01', '2026-10-15');`)).toEqual({ n: 1, usd: 59.99 });
    expect(await total(pay + `insert into comp_grants values ('${id(1)}', '2026-10-01', '2026-11-01', null);`)).toEqual({ n: 1, usd: 59.99 });
    expect(await total(pay + `insert into comp_grants values ('${id(1)}', '2026-10-01', '2026-12-01', null);`)).toEqual({ n: 0, usd: 0 });
  });
});
