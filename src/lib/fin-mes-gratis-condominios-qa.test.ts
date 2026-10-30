// QA: ejecuta la consulta "Cuántos residentes siguen" de marketing/condominios/fin-mes-gratis.md (pieza 4) en PostgreSQL
// (PGlite), dentro de una transacción de solo lectura, y la compara con la regla de acceso de la app (profilePlanFor).
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { profilePlanFor } from "./onvo";

const doc = readFileSync("marketing/condominios/fin-mes-gratis.md", "utf8");
const sql = [...doc.matchAll(/```sql\n([\s\S]*?)```/g)].map((m) => m[1])[0];
const db = new PGlite();
// Proyección mínima de las columnas de 0001, 0004, 0005 y 0053 que usa la consulta. Sin datos reales.
beforeAll(async () => {
  await db.exec(`
    create table condos (id bigint primary key, code text unique);
    create table comp_grants (id bigint primary key, user_id uuid, starts_at timestamptz, expires_at timestamptz, revoked_at timestamptz);
    create table condo_members (condo_id bigint, user_id uuid unique, grant_id bigint);
    create table subscriptions (user_id uuid, plan text, status text, current_period_end timestamptz, cancel_at_period_end boolean default false);
  `);
}, 30000);
afterAll(async () => { await db.close(); });

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const past = "now() - interval '2 days'", future = "now() + interval '20 days'";
const member = (n: number, ends = past, condo = 1) =>
  `insert into comp_grants values (${n}, '${id(n)}', now() - interval '30 days', ${ends}, null);
   insert into condo_members values (${condo}, '${id(n)}', ${n});`;
const sub = (n: number, status: string, end = future, cancel = false) =>
  `insert into subscriptions values ('${id(n)}', 'completo', '${status}', ${end}, ${cancel});`;

async function query(seed: string, code = "torres") {
  await db.exec(`truncate condos, comp_grants, condo_members, subscriptions;
    insert into condos values (1, 'torres'), (2, 'otro'); ${seed}`);
  await db.exec("begin read only");
  try {
    return (await db.query<{ terminaron_su_mes: number; siguen_con_su_plan: number }>(sql.replace("[codigo]", code))).rows;
  } finally { await db.exec("rollback"); }
}

describe("QA: la consulta de la pieza 4 corre y solo devuelve conteos", () => {
  it("devuelve una fila con los dos conteos y nada más", async () => {
    const rows = await query("");
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual(["siguen_con_su_plan", "terminaron_su_mes"]);
    expect(rows[0]).toEqual({ terminaron_su_mes: 0, siguen_con_su_plan: 0 });
  });

  it("cuenta solo a quienes terminaron su mes, del condominio pedido, con un plan pagado vigente", async () => {
    const rows = await query(
      member(1) + sub(1, "active") + // terminó y pagó
      member(2) + // terminó y no pagó
      member(3) + sub(3, "active", past) + // pagó pero su periodo ya venció
      member(4, future) + sub(4, "active") + // sigue dentro de su mes: no entra en ningún conteo
      member(5, past, 2) + sub(5, "active") + // de otro condominio
      member(6) + sub(6, "trialing"), // estado que no es un pago
    );
    expect(rows[0]).toEqual({ terminaron_su_mes: 4, siguen_con_su_plan: 1 });
  });

  it("dos suscripciones de la misma cuenta cuentan una sola vez", async () => {
    const rows = await query(member(1) + sub(1, "active") + sub(1, "past_due"));
    expect(rows[0]).toEqual({ terminaron_su_mes: 1, siguen_con_su_plan: 1 });
  });

  it("past_due cuenta como que sigue, igual que en la app mientras dura el periodo", async () => {
    const rows = await query(member(1) + sub(1, "past_due"));
    expect(rows[0].siguen_con_su_plan).toBe(1);
    expect(profilePlanFor({ plan: "completo", status: "past_due", current_period_end: new Date(Date.now() + 20 * 864e5).toISOString() })).toBe("completo");
  });

  // Hallazgo: quien pagó y apagó la renovación queda en status 'canceled' con cancel_at_period_end y sigue con su plan
  // hasta current_period_end (profilePlanFor en src/lib/onvo.ts), pero la consulta solo cuenta 'active' y 'past_due'.
  it.fails("cuenta a quien pagó y apagó la renovación, que la app todavía trata como plan pagado", async () => {
    const end = new Date(Date.now() + 20 * 864e5).toISOString();
    expect(profilePlanFor({ plan: "completo", status: "canceled", current_period_end: end, cancel_at_period_end: true })).toBe("completo");
    const rows = await query(member(1) + sub(1, "canceled", future, true));
    expect(rows[0].siguen_con_su_plan).toBe(1);
  });
});
