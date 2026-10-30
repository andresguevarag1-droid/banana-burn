// QA: docs/metas/embudo-de-pago.sql contra el esquema real (todas las migraciones sobre PGlite) y contra los nombres de
// eventos que la app acepta. Las pruebas de embudo-de-pago-qa.test.ts usan tablas mínimas y no detectan un nombre de
// columna o de evento que no exista en producción.
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FUNNEL_EVENTS } from "@/app/api/track/event";

const sql = readFileSync("docs/metas/embudo-de-pago.sql", "utf8");
const db = new PGlite({ extensions: { pgcrypto } });

beforeAll(async () => {
  await db.exec(readFileSync("supabase/tests/stub.sql", "utf8"));
  for (const f of readdirSync("supabase/migrations").filter(f => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(`supabase/migrations/${f}`, "utf8"));
  }
}, 120000);
afterAll(async () => { await db.close(); });

describe("QA: embudo de pago sobre el esquema de las migraciones", () => {
  it("corre sin errores en una transacción de solo lectura y devuelve las columnas del documento", async () => {
    await db.exec("begin read only");
    try {
      const { rows, fields } = await db.query(sql);
      expect(rows.length).toBeGreaterThan(0);
      const names = fields.map(f => f.name);
      for (const col of ["cuentas_creadas", "registro", "primer_entreno", "tarjeta_guardada", "pagaron", "renovaron",
        "tasa_pago_pct", "paso_con_mas_perdida", "visita_a_cuenta", "tarjeta_que_fallo", "plan_mirado_sin_pagar"]) {
        expect(names).toContain(col);
      }
    } finally { await db.exec("rollback"); }
  });

  it("solo usa nombres de funnel_events que la app acepta en /api/track", () => {
    const used = [...sql.matchAll(/e\.name = '([a-z_]+)'/g)].map(m => m[1]);
    expect(used.length).toBeGreaterThanOrEqual(4);
    for (const name of used) expect(FUNNEL_EVENTS as readonly string[]).toContain(name);
  });

  it("solo usa tipos de payment_events que escriben los webhooks y el cobro verificado", () => {
    const types = sql.match(/e\.type in \(([^)]*)\)/)![1].match(/'([^']+)'/g)!.map(t => t.slice(1, -1));
    const code = readFileSync("src/lib/onvo.ts", "utf8") + readFileSync("src/lib/billing.ts", "utf8");
    for (const t of types) expect(code).toContain(`"${t}"`);
  });
});
