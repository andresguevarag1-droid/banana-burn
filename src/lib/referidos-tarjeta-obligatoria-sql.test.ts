// #333: referidos con tarjeta obligatoria, en la base (PGlite con todas las migraciones hasta 0074). El amigo llega por el
// enlace y queda atribuido; deja la tarjeta (cobro programado, sin pago) y sale "en prueba"; cuenta solo con su primer cobro
// real (referral_paid, que llama activate() en billing.ts el día 8); si cancela antes del día 8 no cuenta; el tercer pago
// entrega el premio una sola vez (3 meses si uno pagó anual). La parte de la app está en referidos-tarjeta-obligatoria.test.ts.
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const db = new PGlite({ extensions: { pgcrypto } });
const uid = (n: number) => `33300000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const R = uid(0);
const NAMES = ["", "Ana María Rojas", "Bruno Díaz", "Carla Mora", "Diego Solís", "Elena Vargas", "Fabio Castro", "Gina Pérez"];
/** Amigos: 1 a 7. Todos llegan por el enlace de R y dejan la tarjeta el día 0. */
const FRIENDS = [1, 2, 3, 4, 5, 6, 7];

async function asReferrer<T>(fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '{"sub":"${R}","role":"authenticated"}', false)`);
  try { return await fn(); } finally { await db.exec("reset role; select set_config('request.jwt.claims', '', false)"); }
}
const mine = () => asReferrer(async () => (await db.query<{ first_name: string | null; initial: string; status: string; in_trial: boolean; annual: boolean }>(
  "select first_name, initial, status, in_trial, annual from public.my_referrals() order by first_name")).rows);
const paid = async (n: number, annual = false) => (await db.query<{ r: string }>("select public.referral_paid($1, $2) r", [uid(n), annual])).rows[0].r;
const rewards = async () => (await db.query<{ group_no: number; months: number }>("select group_no, months from public.referral_rewards where referrer = $1 order by group_no", [R])).rows;
const giftMonths = async () => (await db.query<{ n: number }>("select count(*)::int n from public.comp_grants where user_id = $1 and source = 'referido' and revoked_at is null", [R])).rows[0].n;

beforeAll(async () => {
  await db.exec(readFileSync("supabase/tests/stub.sql", "utf8"));
  for (const f of readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql") && f < "0075").sort()) {
    await db.exec(readFileSync(`supabase/migrations/${f}`, "utf8"));
  }
  for (let n = 0; n < NAMES.length; n++) {
    await db.query("insert into auth.users(id, email, raw_user_meta_data) values ($1, $2, $3)", [uid(n), `referido-${n}@prueba.test`, { full_name: NAMES[n] || "Rita Quesada" }]);
  }
  await db.query("insert into public.referral_codes(user_id, code) values ($1, 'tarj2345')", [R]);
  for (const n of FRIENDS) {
    // El enlace /r/<código> guardó la cookie y el registro llama a referral_attribute (attributeReferral, service_role).
    expect((await db.query<{ r: string }>("select public.referral_attribute($1, 'tarj2345') r", [uid(n)])).rows[0].r).toBe("registrado");
    // Deja la tarjeta: primer cobro programado al día 8 (kind 'prueba', 7 días). Eso no es un pago.
    await db.query(`insert into public.trial_charges(user_id, idem_key, kind, plan, billing, amount_minor, trial_started_at, trial_ends_at, charge_at, next_attempt_at, status)
      values ($1::uuid, 'trial:' || $1::text, 'prueba', 'entreno', $2, 499, now(), now() + interval '7 days', now() + interval '7 days', now() + interval '7 days', 'scheduled')`, [uid(n), n === 3 ? "anual" : "mes"]);
  }
}, 180000);
afterAll(async () => { await db.close(); });

describe("referidos con tarjeta obligatoria (0064 + 0074)", () => {
  it("el enlace guarda quién lo trajo y dejar la tarjeta no cuenta: sale en prueba con su nombre de pila", async () => {
    const { rows } = await db.query("select count(*)::int n from public.referrals where referrer = $1 and status = 'registrado' and paid_at is null", [R]);
    expect(rows).toEqual([{ n: FRIENDS.length }]);
    const list = await mine();
    expect(list).toHaveLength(FRIENDS.length);
    expect(list.every((r) => r.status === "registrado" && r.in_trial)).toBe(true);
    expect(list.map((r) => r.first_name)).toEqual(["Ana", "Bruno", "Carla", "Diego", "Elena", "Fabio", "Gina"]);
    // Nada más del amigo: ni apellido, ni correo, ni ids.
    expect(JSON.stringify(list)).not.toMatch(/Rojas|Díaz|@|[0-9a-f]{8}-[0-9a-f]{4}/);
    expect(await rewards()).toEqual([]);
  });

  it("cancela antes del día 8: deja de estar en prueba, no paga y no cuenta", async () => {
    await db.query("update public.trial_charges set status = 'canceled', canceled_at = now(), next_attempt_at = null where user_id = $1", [uid(4)]);
    const diego = (await mine()).find((r) => r.first_name === "Diego")!;
    expect(diego).toMatchObject({ status: "registrado", in_trial: false });
  });

  it("día 8: el primer cobro real cuenta; con dos que pagaron todavía no hay premio", async () => {
    await db.query("update public.trial_charges set status = 'succeeded' where user_id in ($1, $2)", [uid(1), uid(2)]);
    expect(await paid(1)).toBe("calificado");
    expect(await paid(2)).toBe("calificado");
    const list = await mine();
    expect(list.filter((r) => r.status === "calificado").map((r) => [r.first_name, r.in_trial])).toEqual([["Ana", false], ["Bruno", false]]);
    expect(await rewards()).toEqual([]);
    expect(await giftMonths()).toBe(0);
  });

  it("el tercer pago (anual) entrega el premio una sola vez: 3 meses", async () => {
    await db.query("update public.trial_charges set status = 'succeeded' where user_id = $1", [uid(3)]);
    expect(await paid(3, true)).toBe("calificado");
    expect(await rewards()).toEqual([{ group_no: 1, months: 3 }]);
    expect(await giftMonths()).toBe(1);
    // El webhook repetido del mismo cobro y las renovaciones no vuelven a contar.
    for (const n of [1, 2, 3]) await paid(n, n === 3);
    await paid(3, true);
    expect(await rewards()).toEqual([{ group_no: 1, months: 3 }]);
    expect(await giftMonths()).toBe(1);
    expect((await mine()).find((r) => r.first_name === "Carla")).toMatchObject({ status: "calificado", annual: true });
  });

  it("tres pagos mensuales: 1 mes; quien canceló sigue sin contar", async () => {
    for (const n of [5, 6]) expect(await paid(n)).toBe("calificado");
    expect(await rewards()).toHaveLength(1);
    expect(await paid(7)).toBe("calificado");
    expect(await rewards()).toEqual([{ group_no: 1, months: 3 }, { group_no: 2, months: 1 }]);
    expect(await paid(7)).toBe("calificado");
    expect(await rewards()).toHaveLength(2);
    expect((await mine()).find((r) => r.first_name === "Diego")).toMatchObject({ status: "registrado", in_trial: false });
  });
});
