import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { afterAll, beforeAll, expect, it } from "vitest";

const db = new PGlite({ extensions: { pgcrypto } });
const migration = readFileSync("supabase/migrations/0064_referidos_al_pagar.sql", "utf8");
const uid = (n: number) => `17800000-0000-4000-8000-${String(n).padStart(12, "0")}`;

beforeAll(async () => {
  await db.exec(readFileSync("supabase/tests/stub.sql", "utf8"));
  for (const f of readdirSync("supabase/migrations").filter(f => f.endsWith(".sql") && f < "0064").sort()) {
    await db.exec(readFileSync(`supabase/migrations/${f}`, "utf8"));
  }
  for (let n = 0; n <= 6; n++) {
    await db.query("insert into auth.users(id,email) values ($1,$2)", [uid(n), `migration-${n}@prueba.test`]);
  }
  await db.query("insert into public.referral_codes(user_id,code) values ($1,'qaab2345')", [uid(0)]);
  for (let n = 1; n <= 6; n++) {
    await db.query(`insert into public.referrals(referrer,referred,code,status,created_at,qualified_at)
      values ($1,$2,'qaab2345',$3,now()-interval '30 days',case when $3='calificado' then now()-interval '20 days' end)`,
    [uid(0), uid(n), n <= 3 ? "calificado" : "registrado"]);
  }
  await db.query("select public._referral_settle($1)", [uid(0)]);
  for (const [n, note] of [[4, "plan=entreno"], [5, "renovación fallida -> past_due (ONVO: past_due), plan=free"], [6, "reto fuerza otorgado"]] as const) {
    await db.query(`insert into public.payment_events(event_key,type,user_id,status,note,processed_at)
      values ($1,'charge.approved',$2,'processed',$3,now()-interval '10 days')`, [`qa-${n}`, uid(n), note]);
  }
  await db.exec(migration);
}, 120000);
afterAll(async () => { await db.close(); });

it("0064 preserves pre-migration qualifications and already delivered rewards", async () => {
  const { rows } = await db.query("select count(*)::int n from public.referrals where status='calificado' and paid_at is null and group_no=1");
  expect(rows).toEqual([{ n: 3 }]);
  const rewards = await db.query("select months, revoked_at from public.referral_rewards");
  expect(rewards.rows).toEqual([{ months: 1, revoked_at: null }]);
});

it("0064 backfills a verified plan payment but excludes failed renewals and standalone challenges", async () => {
  const { rows } = await db.query("select status, paid_at is not null as paid from public.referrals where referred in ($1,$2,$3) order by referred", [uid(4), uid(5), uid(6)]);
  expect(rows).toEqual([{ status: "calificado", paid: true }, { status: "registrado", paid: false }, { status: "registrado", paid: false }]);
});

it("0064 can run twice without granting duplicate rewards or changing qualifications", async () => {
  const before = await db.query("select * from public.referrals order by id");
  await db.exec(migration);
  expect((await db.query("select * from public.referrals order by id")).rows).toEqual(before.rows);
  expect((await db.query("select count(*)::int n from public.referral_rewards")).rows).toEqual([{ n: 1 }]);
});
