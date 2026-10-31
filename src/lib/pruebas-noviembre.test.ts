// docs/metas/pruebas-noviembre.md: plan de pruebas A/B de precio y oferta. Estas pruebas revisan que sus cifras salgan de
// plans.ts y trial.ts, que los tamaños de muestra cuadren con su fórmula, que cite el código tal como está y que el
// filtro de grupo que propone corra en embudo-de-pago.sql y reparta igual que el md5 de Node.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { usd2 as usd } from "@/lib/num";
import { PLANS } from "@/lib/plans";
import { promoPrice } from "@/lib/trial";
import { TRIAL_SEQUENCE } from "@/lib/email/templates";

const doc = readFileSync("docs/metas/pruebas-noviembre.md", "utf8");
const sql = readFileSync("docs/metas/embudo-de-pago.sql", "utf8");
const entreno = PLANS.find((p) => p.id === "entreno")!;
const completo = PLANS.find((p) => p.id === "completo")!;
const round2 = (n: number) => Math.round(n * 100) / 100;
const z = 1.96 + 0.8416;
const sampleSize = (p1: number, p2: number) => Math.ceil((z * z * (p1 * (1 - p1) + p2 * (1 - p2))) / (p1 - p2) ** 2);
const base = 0.352;

const section = (title: string) => {
  const start = doc.indexOf(title);
  expect(start, `falta la sección ${title}`).toBeGreaterThanOrEqual(0);
  const next = doc.indexOf("\n## ", start + title.length);
  return doc.slice(start, next === -1 ? undefined : next);
};

describe("el plan de pruebas de noviembre", () => {
  it("tiene como máximo 3 pruebas, ordenadas anual, 50 % y asunto", () => {
    const tests = [...doc.matchAll(/^## Prueba (\d): (.+)$/gm)];
    expect(tests.map((m) => m[1])).toEqual(["1", "2", "3"]);
    expect(tests[0][2]).toMatch(/anual o mensual/);
    expect(tests[1][2]).toMatch(/50 %/);
    expect(tests[2][2]).toMatch(/asunto del correo del día 6/);
  });

  it("cada prueba dice hipótesis, métrica, tamaño, duración, cómo leerla y qué decide Andrés", () => {
    for (const n of [1, 2, 3]) {
      const s = section(`## Prueba ${n}:`);
      for (const part of ["**Hipótesis.**", "**Métrica.**", "**Tamaño mínimo.**", "**Duración.**", "**Cómo se lee.**", "**Qué decide Andrés:**"]) {
        expect(s, `prueba ${n}: ${part}`).toContain(part);
      }
      expect(s).toMatch(/pagos por cohorte/);
    }
  });

  it("ninguna se activa sin Andrés y no gasta", () => {
    expect(doc).toContain("**ninguna prueba se activa sin la aprobación de Andrés**");
    expect(doc).toMatch(/Ninguna de estas pruebas cuesta dinero en anuncios/);
  });
});

describe("el dinero sale de plans.ts y trial.ts", () => {
  it("anual contra mensual con 50 %", () => {
    expect(doc).toContain(`+${usd(round2(entreno.price.anual - promoPrice("entreno")))}`);
    expect(doc).toContain(`+${usd(round2(completo.price.anual - promoPrice("completo")))}`);
    expect(usd(round2(completo.price.anual - promoPrice("completo")))).toBe("$82.50");
    const year = (p: typeof entreno) => round2(promoPrice(p.id) + 11 * p.price.mes);
    expect(doc).toContain(`| ${usd(year(entreno))} | ${usd(year(completo))} |`);
    expect(doc).toContain(`${usd(round2(year(entreno) - entreno.price.anual))} menos en Entreno y ${usd(round2(year(completo) - completo.price.anual))} menos`);
  });

  it("lo que cuesta el 50 % y su punto de equilibrio", () => {
    const off = (p: typeof entreno) => round2(p.price.mes - promoPrice(p.id));
    expect(doc).toContain(`${usd(off(entreno))} por cada pago con tarjeta en Entreno y ${usd(off(completo))} en Entreno + Nutrición`);
    expect(doc).toContain(`entre ${usd(100 * off(entreno))} y ${usd(100 * off(completo))}`);
    const two = (p: typeof entreno, promo: boolean) => round2((promo ? promoPrice(p.id) : p.price.mes) + p.price.mes);
    expect(doc).toContain(`deja ${usd(two(entreno, true))} en Entreno y ${usd(two(completo, true))} en Entreno + Nutrición; sin el 50 %, ${usd(two(entreno, false))} y ${usd(two(completo, false))}`);
    const ratio = two(completo, true) / two(completo, false);
    expect(Math.round(ratio * 100)).toBe(75);
    expect(Math.round(two(entreno, true) / two(entreno, false) * 100)).toBe(75);
    expect(doc).toContain(`**${(base * 0.75 * 100).toFixed(1)} %** en B`);
  });

  it("el rango de pagos del día 6", () => {
    expect(doc).toContain(`de ${usd(promoPrice("entreno"))} (guarda la tarjeta`);
    expect(doc).toContain(`a ${usd(completo.price.anual)} (Entreno + Nutrición anual)`);
  });
});

describe("tamaños de muestra y duración", () => {
  it("cuadran con la fórmula de dos proporciones", () => {
    expect(doc).toContain("(1.96 + 0.8416)²");
    expect(doc).toContain("**n = 327 por grupo, 654 cuentas en total**");
    expect(sampleSize(base, base - 0.1)).toBe(327);
    expect(doc).toContain("**n = 429 por grupo, 858 cuentas en total**");
    expect(sampleSize(base, 0.264)).toBe(429);
    expect(sampleSize(0.1, 0.15)).toBe(683);
    expect(sampleSize(0.2, 0.25)).toBe(1092);
    expect(doc).toMatch(/\| 10 % \| 15 % \| 683 \|/);
    expect(doc).toMatch(/\| 20 % \| 25 % \| 1,092 \|/);
    expect(sampleSize(base, 0.2)).toBe(132);
    expect(sampleSize(base, 0.2)).toBeLessThanOrEqual(142);
  });

  it("las semanas salen de 285 registros en 30 días", () => {
    const week = (285 / 30) * 7;
    expect(doc).toContain(`unos ${week.toFixed(1)} por semana`);
    expect(doc).toContain(`654 ÷ 66.5 = ${(654 / week).toFixed(1)}, o sea **${Math.ceil(654 / week)} semanas de entrada**`);
    expect(doc).toContain(`858 ÷ 66.5 = ${(858 / week).toFixed(1)}, o sea **${Math.ceil(858 / week)} semanas de entrada**`);
    const noCard = week * 0.6;
    expect(doc).toContain(`unos ${noCard.toFixed(1)} por semana: 1,366 ÷ 39.9 = ${(1366 / 39.9).toFixed(1)}, o sea **${Math.ceil(1366 / 39.9)} semanas**`);
  });
});

describe("cita el código como está hoy", () => {
  it("la pantalla de elegir plan marca el mensual y el muro de planes el anual", () => {
    expect(readFileSync("src/app/bienvenida/wizard.tsx", "utf8")).toContain('{ plan: "completo", billing: "mes" }');
    expect(readFileSync("src/app/(app)/app/suscripcion/page.tsx", "utf8")).toContain('{ plan: "completo", billing: "mes" }');
    expect(readFileSync("src/components/pricing.tsx", "utf8")).toContain('useState<Billing>("anual")');
    expect(doc).toContain('`{ plan: "completo", billing: "mes" }`');
  });

  it("el asunto A es el que sale hoy y el B es la variante de la secuencia", () => {
    expect(doc).toContain(`A: «${TRIAL_SEQUENCE[6].subject}», como hoy`);
    const b = doc.match(/B: «([^»]+)»/)![1];
    expect(readFileSync("docs/emails/secuencia-prueba.md", "utf8")).toContain(`B usa «${b}»`);
    expect(readFileSync("src/lib/notify-run.ts", "utf8")).toMatch(/kind: step, local_day: ONCE_DAY/);
  });

  it("el 50 % sigue prometido en las páginas que la prueba 2 obliga a cambiar", () => {
    for (const f of ["src/app/(marketing)/terminos/page.tsx", "src/app/(marketing)/content.tsx", "src/components/pricing.tsx", "src/app/llms.txt/route.ts"]) {
      expect(readFileSync(f, "utf8"), f).toMatch(/PROMO_PCT|50 %/);
      expect(doc).toContain(f.startsWith("src/app/llms") ? "`llms.txt`" : `\`${f}\``);
    }
  });

  it("sigue las reglas de marca", () => {
    expect(doc).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(doc).not.toContain("—");
    expect(doc).not.toMatch(/\bIA\b|GLP|!/);
    expect(doc).not.toMatch(/\d\.\d{3},\d/);
  });
});

describe("QA: el filtro de grupo corre en embudo-de-pago.sql", () => {
  const db = new PGlite();
  beforeAll(async () => {
    await db.exec(`
      create table profiles (id uuid primary key, created_at timestamptz);
      create table funnel_events (user_id uuid, name text, created_at timestamptz);
      create table workouts (user_id uuid, finished_at timestamptz);
      create table trial_charges (user_id uuid unique, status text, plan text, billing text,
        last_attempt_at timestamptz, updated_at timestamptz default '2026-11-08 06:00+00');
      create table subscriptions (user_id uuid, status text, provider text, plan text, billing text,
        current_period_end timestamptz, cancel_at_period_end boolean default false, created_at timestamptz default '2026-11-09');
      create table comp_grants (user_id uuid, starts_at timestamptz, expires_at timestamptz, revoked_at timestamptz);
      create table payment_events (user_id uuid, type text, status text, period_start timestamptz, received_at timestamptz);
      create table notification_log (user_id uuid, kind text, local_day date);
    `);
  }, 30000);
  afterAll(async () => { await db.close(); });

  const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
  const arm = (uid: string, test: string) => createHash("md5").update(`${uid}:${test}`).digest()[0] % 2;
  const blocks = [...doc.matchAll(/```sql\n([\s\S]*?)```/g)].map((m) => m[1]);
  const armFilter = blocks.find((b) => b.includes("not exists (select 1 from public.comp_grants"))!;
  const d6Filter = blocks.find((b) => b.includes("prueba_d6"))!;
  const anchor = "and p.created_at <= q.observado_en";

  async function run(filter: string) {
    expect(sql).toContain(anchor);
    expect(sql).toContain("select date '2026-10-28' as desde");
    expect(doc).toContain("`select date '2026-11-01' as desde`");
    const report = sql.replace("select date '2026-10-28' as desde", "select date '2026-11-01' as desde")
      .replace("(now() at time zone 'America/Costa_Rica')::date as hasta", "date '2026-11-29' as hasta")
      .replace("now() as observado_en", "timestamptz '2026-12-31 12:00+00' as observado_en")
      .replace(anchor, `${anchor}\n${filter.trimEnd()}`);
    await db.exec("begin read only");
    try {
      const rows = (await db.query<{ cuentas_creadas: number; usuarios_pago_total: number }>(report)).rows;
      return rows.reduce((a, r) => ({ n: a.n + Number(r.cuentas_creadas), x: a.x + Number(r.usuarios_pago_total) }), { n: 0, x: 0 });
    } finally { await db.exec("rollback"); }
  }

  it("reparte cada cuenta en el mismo grupo que el md5 de Node y excluye cortesías", async () => {
    let seed = "";
    for (let n = 1; n <= 40; n++) {
      seed += `insert into profiles values ('${id(n)}', '2026-11-03 12:00+00');`;
      if (n % 3 === 0) seed += `insert into subscriptions values ('${id(n)}', 'active', 'tilopay', 'entreno', 'mes', '2027-01-15');`;
    }
    seed += `insert into profiles values ('${id(99)}', '2026-10-30 12:00+00');`; // cuenta de la beta: fuera
    seed += `insert into comp_grants values ('${id(1)}', '2026-11-03', '2026-12-03', null);`;
    seed += `insert into notification_log values ('${id(2)}', 'prueba_d6', '2026-11-08'), ('${id(4)}', 'recordatorio', '2026-11-08');`;
    await db.exec(`truncate profiles, subscriptions, comp_grants, notification_log; ${seed}`);

    const ids = Array.from({ length: 40 }, (_, i) => i + 1).filter((n) => n !== 1);
    for (const g of [0, 1]) {
      const got = await run(armFilter.replace("= 0", `= ${g}`));
      const mine = ids.filter((n) => arm(id(n), "nov-anual") === g);
      expect(got.n).toBe(mine.length);
      expect(got.x).toBe(mine.filter((n) => n % 3 === 0).length);
    }
    const a = await run(armFilter);
    const b = await run(armFilter.replace("= 0", "= 1"));
    expect(a.n + b.n).toBe(39);
    expect(a.n).toBeGreaterThan(0);
    expect(b.n).toBeGreaterThan(0);

    const d6 = await run(armFilter.replace("nov-anual", "nov-asunto-d6").replace("= 0", `= ${arm(id(2), "nov-asunto-d6")}`) + d6Filter);
    expect(d6.n).toBe(1);
  });
});


describe("QA: ingresos por grupo en rentabilidad-semanal.sql", () => {
  it("usa el alias documentado y separa pagos y cuentas creadas en el rango", async () => {
    const db = new PGlite();
    try {
      await db.exec(`
        create table profiles (id uuid, created_at timestamptz);
        create table comp_grants (user_id uuid, revoked_at timestamptz, starts_at timestamptz, expires_at timestamptz);
        create table trial_charges (user_id uuid, plan text, billing text, promo text,
          amount_minor integer, last_attempt_at timestamptz, updated_at timestamptz, status text);
        create table subscriptions (user_id uuid, plan text, billing text, provider text,
          status text, current_period_end timestamptz, cancel_at_period_end boolean, created_at timestamptz);
      `);
      const ids = Array.from({ length: 12 }, (_, i) => `00000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`);
      for (const [i, uid] of ids.entries()) {
        await db.query("insert into profiles values ($1, $2)", [uid, i < 10 ? "2026-11-01 12:00+00" : "2026-10-30 12:00+00"]);
        await db.query(`insert into trial_charges values ($1, 'entreno', 'mes', 'primer_mes_50',
          499, '2026-11-08 12:00+00', '2026-11-08 12:00+00', 'succeeded')`, [uid]);
      }
      const revenue = readFileSync("docs/metas/rentabilidad-semanal.sql", "utf8");
      const filter = doc.match(/`(and get_byte\(decode\(md5\(x\.user_id[^`]+)`/)![1];
      const anchor = "and x.user_id not in (select user_id from cortesia)";
      expect(revenue).toContain(anchor);
      for (const group of [0, 1]) {
        const query = revenue.replace("now() as observado_en", "timestamptz '2026-11-10 12:00+00' as observado_en")
          .replace(anchor, `${anchor}
            ${filter.replace("= 0", `= ${group}`)}
            and exists (select 1 from profiles p where p.id = x.user_id
              and p.created_at >= timestamptz '2026-11-01 06:00+00'
              and p.created_at < timestamptz '2026-11-02 06:00+00')`);
        const rows = (await db.query<{ plan: string; pagos_nuevos: number; ingresos_brutos_usd: string }>(query)).rows;
        const total = rows.find((r) => r.plan === "total")!;
        const expected = ids.slice(0, 10).filter((uid) => createHash("md5").update(`${uid}:nov-anual`).digest()[0] % 2 === group).length;
        expect(Number(total.pagos_nuevos)).toBe(expected);
        expect(Number(total.ingresos_brutos_usd)).toBeCloseTo(expected * 4.99, 2);
      }
    } finally { await db.close(); }
  }, 30000);
});
