import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { profilePlanFor } from "./onvo";

const sql = readFileSync("docs/metas/tablero-diario.sql", "utf8");
const db = new PGlite();
// Minimal projection of the migration columns consumed by the report. No production data.
beforeAll(async () => {
  await db.exec(`
    create table profiles (id uuid primary key, created_at timestamptz);
    create table funnel_events (user_id uuid, name text, created_at timestamptz);
    create table workouts (user_id uuid, finished_at timestamptz);
    create table trial_charges (user_id uuid unique, status text);
    create table subscriptions (user_id uuid, status text, provider text,
      current_period_end timestamptz, cancel_at_period_end boolean default false);
    create table comp_grants (user_id uuid, starts_at timestamptz,
      expires_at timestamptz, revoked_at timestamptz);
  `);
}, 30000);
afterAll(async () => { await db.close(); });

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
async function query(seed = "", spending?: string) {
  await db.exec(`truncate profiles, funnel_events, workouts, trial_charges, subscriptions, comp_grants; ${seed}`);
  let report = sql.replace("(now() at time zone 'America/Costa_Rica')::date as hasta", "date '2026-10-30' as hasta")
    .replace("now() as observado_en", "timestamptz '2026-11-15 12:00+00' as observado_en");
  if (spending) report = report.replace("values (null::date, null::numeric)", spending);
  await db.exec("begin read only");
  try {
    return (await db.query<Record<string, unknown>>(report)).rows.map((row): Record<string, unknown> => ({
      ...row, dia: (row.dia as Date).toISOString().slice(0, 10),
    }));
  } finally { await db.exec("rollback"); }
}
const account = (n: number, at = "2026-10-28 06:00+00") =>
  `insert into profiles values ('${id(n)}', '${at}');`;
const subscription = (n: number, status = "active", end = "2026-12-01", provider = "onvo", cancel = false) =>
  `insert into subscriptions values ('${id(n)}', '${status}', '${provider}', '${end}', ${cancel});`;
const charge = (n: number, status = "succeeded") =>
  `insert into trial_charges values ('${id(n)}', '${status}');`;
const onboarding = (n: number) =>
  `insert into funnel_events values ('${id(n)}', 'onboarding_done', '2026-11-01');`;
const day = (rows: Record<string, unknown>[], date = "2026-10-28") => rows.find(r => r.dia === date)!;

describe("QA: daily SQL executes in a read-only PostgreSQL transaction", () => {
  it("includes empty days, unknown historical registrations and pending costs", async () => {
    const rows = await query();
    expect(rows).toHaveLength(6);
    expect(rows.map(r => r.dia)).toEqual(["2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"]);
    expect(rows[0].registros_completos).toBeNull();
    expect(day(rows)).toMatchObject({ cuentas_creadas: 0, registros_completos: 0, usuarios_pago: 0,
      prueba_a_pago_pct: null, costo_cliente_pago_usd: null, total_registros_completos: null,
      costo_cliente_pago_total_usd: null });
  });

  it("uses the Costa Rica midnight boundary", async () => {
    const rows = await query(account(1, "2026-10-28 05:59:59+00") + account(2));
    expect(day(rows, "2026-10-27").cuentas_creadas).toBe(1);
    expect(day(rows).cuentas_creadas).toBe(1);
  });

  it("counts people once across repeated events, workouts and both payment sources", async () => {
    const rows = await query(account(1) + onboarding(1) + onboarding(1) + charge(1) + subscription(1) + subscription(1) + `
      insert into workouts values ('${id(1)}', null), ('${id(1)}', '2026-11-01'), ('${id(1)}', '2026-11-02');`);
    expect(day(rows)).toMatchObject({ registros_completos: 1, primer_entreno: 1, tarjeta_guardada: 1,
      cobros_exitosos: 1, pagos_suscripcion_sin_duplicar: 0, usuarios_pago: 1, prueba_a_pago_pct: "100.00" });
  });

  it("does not count unfinished workouts, failed charges, expired or trial subscriptions as payment", async () => {
    const rows = await query(account(1) + account(2) + account(3) + charge(1, "failed") +
      subscription(2, "active", "2026-11-01") + subscription(3, "trialing") +
      `insert into workouts values ('${id(1)}', null);`);
    expect(day(rows)).toMatchObject({ primer_entreno: 0, tarjeta_guardada: 1, usuarios_pago: 0 });
  });

  it("excludes current courtesy, but not expired or revoked courtesy, and accepts Tilopay", async () => {
    const rows = await query(account(1) + account(2) + account(3) + charge(1) + charge(2) + subscription(3, "active", "2026-12-01", "tilopay") + `
      insert into comp_grants values
        ('${id(1)}', '2026-10-01', '2026-12-01', null),
        ('${id(2)}', '2026-10-01', '2026-11-01', null),
        ('${id(3)}', '2026-10-01', '2026-12-01', '2026-11-01');`);
    expect(day(rows)).toMatchObject({ cobros_exitosos: 1, pagos_suscripcion_sin_duplicar: 1, usuarios_pago: 2 });
  });

  it("uses total spending divided by total payers, preserves confirmed zero and missing spending", async () => {
    const seed = account(1) + charge(1) + account(2, "2026-10-29 06:00+00") + charge(2) +
      account(3, "2026-10-29 06:00+00") + charge(3);
    const spending = `select d::date, case when d::date = date '2026-10-28' then 12::numeric else 0::numeric end
      from generate_series(date '2026-10-25', date '2026-10-30', interval '1 day') d`;
    const rows = await query(seed, spending);
    expect(day(rows).costo_cliente_pago_usd).toBe("12.00");
    expect(day(rows, "2026-10-29").costo_cliente_pago_usd).toBe("0.00");
    expect(day(rows).costo_cliente_pago_total_usd).toBe("4.00");
    expect(day(await query(seed)).costo_cliente_pago_total_usd).toBeNull();
  });

  it("includes a paid subscription canceled at period end while its paid period is still valid", async () => {
    const now = new Date("2026-11-15T12:00:00Z");
    expect(profilePlanFor({ plan: "entreno", status: "canceled", cancel_at_period_end: true,
      current_period_end: "2026-12-01T00:00:00Z" }, now)).toBe("entreno");
    const rows = await query(account(1) + onboarding(1) + subscription(1, "canceled", "2026-12-01", "onvo", true));
    expect(day(rows)).toMatchObject({ usuarios_pago: 1, pagos_suscripcion_sin_duplicar: 1 });
  });

  it("excludes immediate cancellations, the exact period-end boundary and unrecognized providers", async () => {
    const rows = await query(account(1) + account(2) + account(3) + account(4) +
      subscription(1, "canceled", "2026-12-01", "onvo", false) +
      subscription(2, "canceled", "2026-11-15 12:00+00", "onvo", true) +
      subscription(3, "active", "2026-11-15 12:00+00") +
      subscription(4, "active", "2026-12-01", "demo"));
    expect(day(rows)).toMatchObject({ usuarios_pago: 0, pagos_suscripcion_sin_duplicar: 0 });
  });

  it("keeps real payers whose courtesy has not started or ends exactly at observation", async () => {
    const rows = await query(account(1) + charge(1) + account(2) + charge(2) + `
      insert into comp_grants values
        ('${id(1)}', '2026-11-16', '2026-12-01', null),
        ('${id(2)}', '2026-10-01', '2026-11-15 12:00+00', null);`);
    expect(day(rows)).toMatchObject({ usuarios_pago: 2, cobros_exitosos: 2 });
  });

  it("ignores onboarding before account creation and activation after observation", async () => {
    const rows = await query(account(1) + account(2) + `
      insert into funnel_events values
        ('${id(1)}', 'onboarding_done', '2026-10-27'),
        ('${id(2)}', 'onboarding_done', '2026-11-16');
      insert into workouts values ('${id(1)}', '2026-11-16');`);
    expect(day(rows)).toMatchObject({ cuentas_creadas: 2, registros_completos: 0, primer_entreno: 0 });
  });
  it("limits acquisition cohorts and uses only onboarded payers for conversion", async () => {
    const rows = await query(account(1) + onboarding(1) + charge(1) +
      account(2) + onboarding(2) + account(3) + charge(3) +
      account(4, "2026-10-25 05:59:59+00") + charge(4) +
      account(5, "2026-10-31 06:00+00") + charge(5));
    expect(day(rows)).toMatchObject({ cuentas_creadas: 3, registros_completos: 2,
      usuarios_pago: 2, registros_que_pagan: 1, prueba_a_pago_pct: "50.00",
      total_usuarios_pago: "2", costo_cliente_pago_usd: null });
  });

});
