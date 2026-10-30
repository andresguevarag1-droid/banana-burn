// docs/metas/embudo-de-pago.sql: embudo semanal de cuenta a renovación. Estas pruebas la corren en PostgreSQL embebido
// dentro de una transacción de solo lectura y revisan que docs/metas/embudo-de-pago.md cite los precios del código.
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { usd2 as usd } from "@/lib/num";
import { BETA_GRACE_UNTIL, PLANS } from "@/lib/plans";
import { promoPrice, RETRY_AFTER_DAYS } from "@/lib/trial";

const sql = readFileSync("docs/metas/embudo-de-pago.sql", "utf8");
const doc = readFileSync("docs/metas/embudo-de-pago.md", "utf8");
const db = new PGlite();
// Proyección mínima de las columnas de las migraciones que usa la consulta. Sin datos de producción.
beforeAll(async () => {
  await db.exec(`
    create table profiles (id uuid primary key, created_at timestamptz);
    create table funnel_events (user_id uuid, name text, created_at timestamptz);
    create table workouts (user_id uuid, finished_at timestamptz);
    create table trial_charges (user_id uuid unique, status text, plan text, billing text,
      last_attempt_at timestamptz, updated_at timestamptz default '2026-11-08 06:00+00');
    create table subscriptions (user_id uuid, status text, provider text, plan text, billing text,
      current_period_end timestamptz, cancel_at_period_end boolean default false,
      created_at timestamptz default '2026-11-09');
    create table comp_grants (user_id uuid, starts_at timestamptz,
      expires_at timestamptz, revoked_at timestamptz);
    create table payment_events (user_id uuid, type text, status text,
      period_start timestamptz, received_at timestamptz);
  `);
}, 30000);
afterAll(async () => { await db.close(); });

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
type Row = Record<string, unknown>;
async function query(seed = "", observed = "2026-12-31 12:00+00", hasta = "2026-11-15", desde = "2026-10-28") {
  await db.exec(`truncate profiles, funnel_events, workouts, trial_charges, subscriptions, comp_grants, payment_events; ${seed}`);
  const report = sql.replace("select date '2026-10-28' as desde", `select date '${desde}' as desde`).replace("(now() at time zone 'America/Costa_Rica')::date as hasta", `date '${hasta}' as hasta`)
    .replace("now() as observado_en", `timestamptz '${observed}' as observado_en`);
  expect(report).not.toBe(sql);
  await db.exec("begin read only");
  try {
    return (await db.query<Row>(report)).rows.map((row): Row => ({
      ...row, semana: (row.semana as Date).toISOString().slice(0, 10),
    }));
  } finally { await db.exec("rollback"); }
}
const week = (rows: Row[], monday = "2026-10-26") => rows.find(r => r.semana === monday)!;

const account = (n: number, at = "2026-10-29 06:00+00") => `insert into profiles values ('${id(n)}', '${at}');`;
const onboarding = (n: number, at = "2026-10-30") => `insert into funnel_events values ('${id(n)}', 'onboarding_done', '${at}');`;
const event = (n: number, name: string) => `insert into funnel_events values ('${id(n)}', '${name}', '2026-10-30');`;
const workout = (n: number, at: string | null = "2026-10-31") =>
  `insert into workouts values ('${id(n)}', ${at ? `'${at}'` : "null"});`;
const card = (n: number, status = "scheduled", plan = "entreno", billing = "mes", paidAt = "2026-11-08 06:05+00") =>
  `insert into trial_charges values ('${id(n)}', '${status}', '${plan}', '${billing}', '${paidAt}');`;
const subscription = (n: number, plan = "completo", billing = "mes", status = "active", end = "2027-01-15") =>
  `insert into subscriptions values ('${id(n)}', '${status}', 'tilopay', '${plan}', '${billing}', '${end}');`;
const payment = (n: number, periodStart: string | null, type = "charge.approved", status = "processed", at = "2026-12-08 06:05+00") =>
  `insert into payment_events values ('${id(n)}', '${type}', '${status}', ${periodStart ? `'${periodStart}'` : "null"}, '${at}');`;
// Persona que hizo todos los pasos hasta pagar con su tarjeta.
const payer = (n: number, plan = "entreno", billing = "mes", at?: string) =>
  account(n, at) + onboarding(n) + workout(n) + card(n, "succeeded", plan, billing);

describe("QA: la consulta del embudo corre en una transacción de solo lectura", () => {
  it("es un solo SELECT sin escrituras ni funciones con efectos", () => {
    const code = sql.replace(/--.*$/gm, "");
    expect(code.trim().startsWith("with")).toBe(true);
    expect(code).not.toMatch(/\b(insert|update|delete|truncate|drop|alter|create|grant|revoke|merge|copy|call|do)\b\s/i);
    expect(code).not.toMatch(/nextval|setval|pg_sleep|dblink|http_|net\./i);
    expect(code.trim().endsWith(";")).toBe(true);
    expect(code.trim().slice(0, -1)).not.toContain(";");
  });

  it("devuelve todas las semanas del rango, vacías incluidas, empezando el 28 de octubre", async () => {
    const rows = await query();
    expect(rows.map(r => r.semana)).toEqual(["2026-10-26", "2026-11-02", "2026-11-09"]);
    expect((week(rows).desde_efectivo as Date).toISOString().slice(0, 10)).toBe("2026-10-28");
    expect((week(rows, "2026-11-09").hasta_efectivo as Date).toISOString().slice(0, 10)).toBe("2026-11-15");
    expect(week(rows)).toMatchObject({ cuentas_creadas: 0, registro: 0, pagaron: 0, tasa_registro_pct: null,
      tasa_pago_pct: null, paso_con_mas_perdida: null });
  });

  it("usa la medianoche de Costa Rica y semanas de lunes a domingo", async () => {
    const rows = await query(account(1, "2026-11-02 05:59:59+00") + account(2, "2026-11-02 06:00+00") +
      account(3, "2026-10-28 05:59:59+00"));
    expect(week(rows).cuentas_creadas).toBe(1);
    expect(week(rows, "2026-11-02").cuentas_creadas).toBe(1);
  });

  it("cuenta cada persona una vez aunque repita eventos, entrenos o pagos", async () => {
    const rows = await query(payer(1) + onboarding(1) + workout(1, "2026-11-01") + workout(1, null) +
      subscription(1, "entreno") + subscription(1, "entreno"));
    expect(week(rows)).toMatchObject({ cuentas_creadas: 1, registro: 1, primer_entreno: 1, tarjeta_guardada: 1,
      pagaron: 1, usuarios_pago_total: 1, tasa_registro_pct: "100.00", tasa_pago_pct: "100.00" });
  });

  it("es una cadena: cada paso exige el anterior y la pérdida queda en el paso donde se quedó", async () => {
    const rows = await query(
      account(1) + // solo cuenta
      account(2) + onboarding(2) + // registro sin entreno
      account(3) + workout(3) + card(3, "succeeded") + // sin registro: no avanza aunque pague
      account(4) + onboarding(4) + workout(4) + // entreno sin tarjeta
      account(5) + onboarding(5) + workout(5) + card(5, "failed") + // tarjeta sin pago
      payer(6));
    expect(week(rows)).toMatchObject({ cuentas_creadas: 6, registro: 4, primer_entreno: 3, tarjeta_guardada: 2,
      pagaron: 1, usuarios_pago_total: 2, tasa_registro_pct: "66.67", tasa_primer_entreno_pct: "75.00",
      tasa_tarjeta_pct: "66.67", tasa_pago_pct: "50.00", paso_con_mas_perdida: "registro" });
  });

  it("no cuenta entrenos sin terminar ni eventos antes de la cuenta o después de la observación", async () => {
    const rows = await query(account(1) + onboarding(1, "2026-10-28") + account(2) + onboarding(2, "2027-01-02") +
      account(3) + onboarding(3) + workout(3, null) + workout(3, "2027-01-02"), "2027-01-01 12:00+00");
    expect(week(rows)).toMatchObject({ cuentas_creadas: 3, registro: 1, primer_entreno: 0 });
  });

  it("muestra el plan elegido al guardar la tarjeta y al pagar, también en el muro de planes", async () => {
    const rows = await query(
      account(1) + onboarding(1) + workout(1) + card(1, "scheduled", "entreno", "anual") +
      payer(2, "completo", "anual") + payer(3, "entreno", "mes") +
      // Su cobro de la prueba falló y pagó después en el muro: cuenta el plan de la suscripción.
      account(4) + onboarding(4) + workout(4) + card(4, "failed", "entreno", "mes") + subscription(4, "completo", "anual"));
    expect(week(rows)).toMatchObject({ tarjeta_guardada: 4, tarjeta_mensual: 2, tarjeta_anual: 2,
      pagaron: 3, pagaron_mensual: 1, pagaron_anual: 2, pagaron_entreno: 1, pagaron_completo: 2 });
  });

  it("no cuenta como pago cobros fallidos, suscripciones vencidas, de prueba ni cortesías vigentes", async () => {
    const rows = await query(
      account(1) + onboarding(1) + workout(1) + card(1, "failed") +
      account(2) + onboarding(2) + workout(2) + card(2, "canceled") + subscription(2, "entreno", "mes", "active", "2026-12-01") +
      account(3) + onboarding(3) + workout(3) + card(3, "canceled") + subscription(3, "entreno", "mes", "trialing") +
      payer(4) + `insert into comp_grants values ('${id(4)}', '2026-10-01', '2027-06-01', null);` +
      payer(5) + `insert into comp_grants values ('${id(5)}', '2026-10-01', '2026-12-01', null);`);
    expect(week(rows)).toMatchObject({ tarjeta_guardada: 5, pagaron: 1, usuarios_pago_total: 1 });
  });

  it("separa a quien pagó en el muro sin tarjeta, que la cadena deja en el paso de tarjeta", async () => {
    const rows = await query(account(1) + onboarding(1) + workout(1) + subscription(1, "entreno", "mes"));
    expect(week(rows)).toMatchObject({ tarjeta_guardada: 0, pagaron: 0, usuarios_pago_total: 1, pagaron_sin_tarjeta: 1 });
  });

  it("renovó: un cobro procesado 20 días o más después del primer pago, solo en mensual", async () => {
    const rows = await query(
      payer(1) + payment(1, "2026-11-08 06:05+00", "charge.approved", "processed", "2026-11-08 06:05+00") +
        payment(1, "2026-12-08 06:00+00") + payment(1, "2026-12-08 06:00+00", "subscription.renewal.succeeded") +
      payer(2) + payment(2, "2026-11-08 06:05+00", "payment-intent.succeeded", "processed", "2026-11-08 06:05+00") +
      payer(3) + payment(3, "2026-12-08 06:00+00", "subscription.renewal.failed") +
      payer(4) + payment(4, "2026-12-08 06:00+00", "charge.approved", "error") +
      payer(5) + payment(5, null, "subscription.renewal.succeeded") +
      payer(6, "entreno", "anual") + payment(6, "2026-12-08 06:00+00") +
      payer(7) + payment(7, "2026-12-08 06:00+00", "charge.approved", "processed", "2027-01-02"));
    expect(week(rows)).toMatchObject({ pagaron: 7, pagaron_mensual: 6, renovaron: 2, tasa_renovacion_pct: "33.33" });
  });

  it("no cuenta pérdidas de pago ni de renovación mientras la cohorte no ha llegado a esos cobros", async () => {
    const grace = Date.parse(BETA_GRACE_UNTIL);
    expect(new Date(grace).toISOString()).toBe("2026-11-08T06:00:00.000Z");
    expect(sql).toContain(`timestamptz '2026-11-08 06:00+00' as cobro_beta`);
    expect(RETRY_AFTER_DAYS).toBeLessThan(2);
    // Solo cuentas de la beta (hasta el 31 oct): cobro del 8 nov + 2 días de margen = 10 nov 06:00 UTC.
    const seed = account(1) + onboarding(1) + workout(1) + card(1) + payer(2) + payer(3);
    const open = week(await query(seed, "2026-11-10 05:59+00", "2026-10-31"));
    expect(open).toMatchObject({ pago_cerrado: false, renovacion_cerrada: false, paso_con_mas_perdida: null });
    const closed = week(await query(seed, "2026-11-10 06:00+00", "2026-10-31"));
    expect(closed).toMatchObject({ pago_cerrado: true, renovacion_cerrada: false, paso_con_mas_perdida: "pago" });
    const renewal = week(await query(seed, "2026-12-13 06:00+00", "2026-10-31"));
    expect(renewal).toMatchObject({ renovacion_cerrada: true, renovaron: 0, paso_con_mas_perdida: "renovacion" });
    // La semana del 26 oct incluye el 1 nov, ya sin beta: 7 días desde el fin del domingo = 9 nov, más 2 días.
    expect(week(await query(seed, "2026-11-11 05:59+00")).pago_cerrado).toBe(false);
    expect(week(await query(seed, "2026-11-11 06:00+00")).pago_cerrado).toBe(true);
    // Semana del 2 nov: termina el domingo 8, más 7 días de prueba y 2 de margen = 18 nov 06:00 UTC.
    const later = await query(account(4, "2026-11-04 06:00+00"), "2026-11-18 06:00+00");
    expect(week(later, "2026-11-02").pago_cerrado).toBe(true);
    expect(week(await query(account(4, "2026-11-04 06:00+00"), "2026-11-18 05:59+00"), "2026-11-02").pago_cerrado).toBe(false);
  });

  it("en empate de pérdidas marca el paso más temprano", async () => {
    const rows = await query(account(1) + account(2) + onboarding(2));
    expect(week(rows).paso_con_mas_perdida).toBe("registro");
    const tie = await query(account(1) + onboarding(1) + account(2) + onboarding(2) + workout(2));
    expect(week(tie).paso_con_mas_perdida).toBe("primer_entreno");
  });

  it("sin evento de registro (antes del 28 oct) deja registro en NULL y salta ese paso", async () => {
    const [r] = await query(account(1, "2026-10-26 12:00+00") + workout(1) + card(1, "succeeded") +
      account(2, "2026-10-29 12:00+00") + workout(2), "2026-12-31 12:00+00", "2026-11-01", "2026-10-26");
    expect(r).toMatchObject({ cuentas_creadas: 2, registro: null, tasa_registro_pct: null, primer_entreno: 1,
      tarjeta_guardada: 1, pagaron: 1, tasa_primer_entreno_pct: "50.00" });
  });

  it("cuenta quién vio la oferta de tarjeta, el muro de planes y la página de pago", async () => {
    const rows = await query(account(1) + event(1, "card_banner_view") + event(1, "card_banner_view") +
      event(1, "plan_wall_view") + account(2) + event(2, "checkout_view") + event(2, "workout_open"));
    expect(week(rows)).toMatchObject({ vieron_oferta_tarjeta: 1, vieron_muro_planes: 1, abrieron_pago: 1 });
  });

  it("marca como sin evento lo que hoy no se puede medir, con el evento que faltaría", async () => {
    const [r] = await query();
    for (const [col, missing] of [["visita_a_cuenta", "visit_id"], ["tarjeta_que_fallo", "card_error"],
      ["plan_mirado_sin_pagar", "plan_select"]] as const) {
      expect(r[col]).toMatch(/^sin evento: falta /);
      expect(r[col]).toContain(missing);
      expect(doc).toMatch(new RegExp(`\\| \`${col}\` \\| sin evento \\| \`${missing}\``));
    }
  });
});

describe("el documento del embudo cuadra con el código", () => {
  const price = (id: string) => PLANS.find((p) => p.id === id)!.price;
  const row = (label: string) => doc.split("\n").find((l) => l.startsWith(`| ${label} |`))!
    .split("|").slice(2, -1).map((c) => c.trim());

  it("los precios por paso salen de plans.ts y trial.ts", () => {
    expect(row("Pagó con tarjeta guardada, primer mes con 50 %")).toEqual([usd(promoPrice("entreno")), usd(promoPrice("completo"))]);
    expect(row("Pagó mensual sin 50 % (muro de planes)")).toEqual([usd(price("entreno").mes), usd(price("completo").mes)]);
    expect(row("Pagó anual")).toEqual([usd(price("entreno").anual), usd(price("completo").anual)]);
    expect(row("Cada renovación mensual")).toEqual([usd(price("entreno").mes), usd(price("completo").mes)]);
  });

  it("las diferencias y los totales para 100 usuarios de pago están bien calculados", () => {
    const r2 = (n: number) => Math.round(n * 100) / 100;
    expect(doc).toContain(`suma ${usd(r2(price("completo").mes - price("entreno").mes))} por mes completo`);
    expect(doc).toContain(`${usd(r2(price("entreno").anual - promoPrice("entreno")))} más en el primer cobro`);
    expect(doc).toContain(`${usd(r2(price("completo").anual - promoPrice("completo")))} más (`);
    expect(doc).toContain(`entre ${usd(r2(100 * promoPrice("entreno")))} (todos Entreno con 50 %) y ${usd(r2(100 * price("completo").anual))}`);
    expect(doc).toContain(`entre ${usd(r2(100 * price("entreno").mes))} y ${usd(r2(100 * price("completo").mes))} si los 100`);
  });

  it("cita las metas del acta y las tablas que usa la consulta", () => {
    expect(doc).toContain("35 % de prueba a pago");
    expect(doc).toContain("40 % de tarjetas × 88 % de cobros");
    for (const t of ["profiles", "funnel_events", "workouts", "trial_charges", "subscriptions", "comp_grants", "payment_events"]) {
      expect(sql).toContain(`public.${t}`);
      expect(doc).toContain(`\`${t}\``);
    }
  });

  it("respeta las reglas de marca: sin emojis, sin guiones largos, sin mencionar IA", () => {
    for (const text of [doc, sql]) {
      expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(text).not.toContain("—");
      expect(text).not.toMatch(/\bIA\b|inteligencia artificial/i);
    }
  });
});
