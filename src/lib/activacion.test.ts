// Activación del día (#200): el mismo día de ejemplo pasa por el resumen diario del dueño (con una base falsa) y por
// docs/metas/activacion.sql (sobre todas las migraciones en PGlite), y los dos tienen que dar las mismas cifras.
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { FUNNEL_EVENTS } from "@/app/api/track/event";
import { activationPct, activationText, computeActivation, type Activation } from "./activacion";
import { summarize, summaryText } from "./admin-avisos";

vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => null }));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn(async () => ({ ok: true })) }));

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
// Día que se resume: 1 nov 2026 en Costa Rica (06:00 UTC a 06:00 UTC). El cron corre a las 02:00 UTC del 2 nov.
const RANGE = { start: "2026-11-01T06:00:00.000Z", end: "2026-11-02T06:00:00.000Z" };
const NOW = new Date("2026-11-02T02:00:00.000Z");

// Cohorte del 29 oct: u1 entrena a las 48 h, u2 a las 73 h (no cuenta), u3 nunca. u4 es del 28 oct (fuera de la cohorte).
// Hoy: se registran u5 y u6; u5 abre, se sale y termina; u6 abre y se sale dos veces; u3 se sale; u2 termina.
const sample = {
  profiles: [
    { id: id(1), created_at: "2026-10-29T10:00:00.000Z" },
    { id: id(2), created_at: "2026-10-29T12:00:00.000Z" },
    { id: id(3), created_at: "2026-10-29T20:00:00.000Z" },
    { id: id(4), created_at: "2026-10-29T05:00:00.000Z" },
    { id: id(5), created_at: "2026-11-01T15:00:00.000Z" },
    { id: id(6), created_at: "2026-11-02T01:00:00.000Z" },
  ],
  workouts: [
    { user_id: id(1), finished_at: "2026-10-31T10:00:00.000Z" },
    { user_id: id(2), finished_at: "2026-11-01T13:00:00.000Z" },
    { user_id: id(4), finished_at: "2026-10-30T10:00:00.000Z" },
    { user_id: id(5), finished_at: "2026-11-01T16:00:00.000Z" },
    { user_id: id(6), finished_at: null },
  ],
  funnel_events: [
    { user_id: id(2), name: "workout_open", created_at: "2026-11-01T12:30:00.000Z", props: {} },
    { user_id: id(5), name: "workout_open", created_at: "2026-11-01T15:10:00.000Z", props: {} },
    { user_id: id(5), name: "workout_leave", created_at: "2026-11-01T15:20:00.000Z", props: { phase: "summary", done: 12, total: 12, seconds_on_screen: 600 } },
    { user_id: id(6), name: "workout_open", created_at: "2026-11-02T01:10:00.000Z", props: {} },
    { user_id: id(6), name: "workout_leave", created_at: "2026-11-02T01:12:00.000Z", props: { phase: "play", done: 0, total: 12, seconds_on_screen: 90 } },
    { user_id: id(6), name: "workout_leave", created_at: "2026-11-02T01:30:00.000Z", props: { phase: "play", done: 3, total: 12, seconds_on_screen: 300 } },
    { user_id: id(3), name: "workout_leave", created_at: "2026-11-01T20:00:00.000Z", props: { phase: "play", done: 0, total: 10, seconds_on_screen: 40 } },
    { user_id: id(3), name: "workout_open", created_at: "2026-10-31T20:00:00.000Z", props: {} },
  ],
  // u5 guarda tarjeta hoy; a u1 (tarjeta del 30 oct) se le cobra hoy y además tiene su suscripción: un solo pago.
  trial_charges: [
    { user_id: id(5), status: "scheduled", created_at: "2026-11-01T15:30:00.000Z", last_attempt_at: null, updated_at: "2026-11-01T15:30:00.000Z" },
    { user_id: id(1), status: "succeeded", created_at: "2026-10-30T10:00:00.000Z", last_attempt_at: "2026-11-01T18:00:00.000Z", updated_at: "2026-11-01T18:00:01.000Z" },
  ],
  subscriptions: [
    { user_id: id(1), provider: "onvo", status: "active", created_at: "2026-11-01T18:00:02.000Z" },
    { user_id: id(4), provider: "tilopay", status: "active", created_at: "2026-11-01T19:00:00.000Z" },
  ],
};
const EXPECTED: Activation = { registros: 2, cohorte: 3, cohorteActivada: 1, abiertos: 3, abandonados: 2, terminados: 2, tarjetas: 1, pagos: 2 };

type Row = Record<string, unknown>;
/** Base falsa con lo justo del cliente de Supabase que usan el resumen y la activación. */
function fakeDb(tables: Record<string, Row[]>) {
  const inserted: { table: string; row: Row }[] = [];
  const t = (v: unknown) => new Date(v as string).getTime();
  const from = (table: string) => {
    let rows = [...(tables[table] ?? [])];
    let head = false;
    const q = {
      select: (_c?: string, o?: { head?: boolean }) => { head = !!o?.head; return q; },
      gte: (c: string, v: string) => { rows = rows.filter((r) => r[c] != null && t(r[c]) >= t(v)); return q; },
      lt: (c: string, v: string) => { rows = rows.filter((r) => r[c] != null && t(r[c]) < t(v)); return q; },
      eq: (c: string, v: unknown) => { rows = rows.filter((r) => r[c] === v); return q; },
      in: (c: string, vs: unknown[]) => { rows = rows.filter((r) => vs.includes(r[c])); return q; },
      not: (c: string) => { rows = rows.filter((r) => r[c] != null); return q; },
      limit: () => q,
      order: () => q,
      insert: (row: Row) => { inserted.push({ table, row }); rows = []; return q; },
      upsert: (row: Row) => { inserted.push({ table, row }); rows = [{ id: 1 }]; return q; },
      then: (ok: (r: { data: Row[] | null; count: number; error: null }) => unknown) => Promise.resolve(ok({ data: head ? null : rows, count: rows.length, error: null })),
    };
    return q;
  };
  return { db: { from }, inserted };
}

describe("activación: cuentas", () => {
  it("cuenta el día de ejemplo", () => {
    const a = computeActivation({
      signups: 2,
      cohort: sample.profiles.slice(0, 3),
      cohortWorkouts: sample.workouts.filter((w) => [id(1), id(2), id(3)].includes(w.user_id)),
      events: sample.funnel_events.filter((e) => e.created_at >= RANGE.start && e.created_at < RANGE.end),
      finished: sample.workouts.filter((w) => w.finished_at && w.finished_at >= RANGE.start && w.finished_at < RANGE.end),
      cards: 1,
      trialPaid: sample.trial_charges.filter((c) => c.status === "succeeded"),
      subs: sample.subscriptions,
    }, RANGE, NOW);
    expect(a).toEqual(EXPECTED);
    expect(activationPct(a)).toBe(33);
  });

  it("un entreno que todavía no pasa (después de ahora) no cuenta", () => {
    const a = computeActivation({ signups: 0, cohort: [sample.profiles[0]], cohortWorkouts: [{ user_id: id(1), finished_at: "2026-11-02T03:00:00.000Z" }], events: [], finished: [], cards: 0, trialPaid: [], subs: [] }, RANGE, NOW);
    expect(a.cohorteActivada).toBe(0);
  });

  it("texto del resumen, con y sin cohorte", () => {
    expect(activationText(EXPECTED)).toBe("primer entreno en 72 h: 33 % (1 de 3, meta 30 %); entrenos: 3 abiertos, 2 abandonados, 2 terminados");
    expect(activationText({ ...EXPECTED, cohorte: 0, cohorteActivada: 0, abiertos: 1, abandonados: 1, terminados: 1 }))
      .toBe("primer entreno en 72 h: sin registros hace 3 días; entrenos: 1 abierto, 1 abandonado, 1 terminado");
  });

  it("sin activación el resumen sale como antes", () => {
    const s = summarize([{ kind: "registro", amount_minor: null, currency: null }], 0);
    expect(summaryText(s).body).toBe("1 usuario nuevo, 0 primeros entrenos, 0 pagos");
    expect(summaryText(s, "x").body).toBe("1 usuario nuevo, 0 primeros entrenos, 0 pagos, 0 tarjetas guardadas. Activación: x");
  });
});

describe("resumen diario del dueño con datos de ejemplo", () => {
  it("muestra registros, primer entreno en 72 h, entrenos abiertos, abandonados y terminados, tarjetas y pagos", async () => {
    const { sendDailySummary } = await import("./admin-avisos-server");
    const { db, inserted } = fakeDb({
      ...sample,
      profiles: [...sample.profiles, { id: id(9), role: "superadmin", created_at: "2026-01-01T00:00:00.000Z" }],
      admin_notify_prefs: [{ user_id: id(9), push: false, email: false, email_mode: "resumen", in_app: true, daily_summary: true, kinds: [] }],
      admin_events: [
        { kind: "registro", amount_minor: null, currency: null, created_at: "2026-11-01T15:00:01.000Z" },
        { kind: "registro", amount_minor: null, currency: null, created_at: "2026-11-02T01:00:01.000Z" },
        { kind: "tarjeta", amount_minor: 499, currency: "USD", created_at: "2026-11-01T15:30:01.000Z" },
        { kind: "pago", amount_minor: 499, currency: "USD", created_at: "2026-11-01T18:00:03.000Z" },
        { kind: "pago", amount_minor: 999, currency: "USD", created_at: "2026-11-01T19:00:01.000Z" },
      ],
    });
    const r = await sendDailySummary(NOW, db as never);
    expect(r).toEqual({ sent: 1 });
    const note = inserted.find((x) => x.table === "notifications")!.row;
    expect(note.title).toBe("Tu día en Banana Burn: $14.98");
    expect(note.body).toBe("2 usuarios nuevos, 2 primeros entrenos, 2 pagos, 1 tarjeta guardada. Activación: primer entreno en 72 h: 33 % (1 de 3, meta 30 %); entrenos: 3 abiertos, 2 abandonados, 2 terminados");
  });

  it("si la activación no se puede leer, el resumen sale igual sin esa línea", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { sendDailySummary } = await import("./admin-avisos-server");
    const { db, inserted } = fakeDb({
      profiles: [{ id: id(9), role: "superadmin", created_at: "2026-01-01T00:00:00.000Z" }],
      admin_notify_prefs: [{ user_id: id(9), push: false, email: false, in_app: true, daily_summary: true }],
    });
    const broken = { from: (t: string) => (t === "funnel_events" ? { select: () => { throw new Error("caída"); } } : db.from(t)) };
    await sendDailySummary(NOW, broken as never);
    expect(inserted.find((x) => x.table === "notifications")!.row.body).toBe("0 usuarios nuevos, 0 primeros entrenos, 0 pagos");
  });
});

describe("docs/metas/activacion.sql sobre el esquema de las migraciones", () => {
  const [daily, leaves] = readFileSync("docs/metas/activacion.sql", "utf8").split(/^(?=-- 2\))/m);
  const pg = new PGlite({ extensions: { pgcrypto } });
  const lit = (v: unknown) => (v == null ? "null" : typeof v === "object" ? `'${JSON.stringify(v)}'::jsonb` : `'${v}'`);

  beforeAll(async () => {
    await pg.exec(readFileSync("supabase/tests/stub.sql", "utf8"));
    for (const f of readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort()) {
      await pg.exec(readFileSync(`supabase/migrations/${f}`, "utf8"));
    }
    // Sin disparadores: solo interesan las filas, no los avisos, el XP ni los límites que arman.
    await pg.exec("set session_replication_role = replica");
    const ins: string[] = [];
    for (const p of sample.profiles) ins.push(`insert into auth.users (id) values ('${p.id}'); insert into public.profiles (id, created_at) values ('${p.id}', ${lit(p.created_at)});`);
    for (const w of sample.workouts) ins.push(`insert into public.workouts (user_id, day, template, finished_at) values ('${w.user_id}', '2026-11-01', 'casa', ${lit(w.finished_at)});`);
    for (const e of sample.funnel_events) ins.push(`insert into public.funnel_events (user_id, name, created_at, props) values ('${e.user_id}', '${e.name}', ${lit(e.created_at)}, ${lit(e.props)});`);
    for (const c of sample.trial_charges) {
      ins.push(`insert into public.trial_charges (user_id, idem_key, kind, plan, billing, amount_minor, trial_started_at, trial_ends_at, charge_at, next_attempt_at, status, created_at, last_attempt_at, updated_at)
        values ('${c.user_id}', 'trial:${c.user_id}', 'prueba', 'entreno', 'mes', 499, ${lit(c.created_at)}, ${lit(c.created_at)}::timestamptz + interval '7 days', ${lit(c.created_at)}::timestamptz + interval '7 days', ${lit(c.created_at)}::timestamptz + interval '7 days', '${c.status}', ${lit(c.created_at)}, ${lit(c.last_attempt_at)}, ${lit(c.updated_at)});`);
    }
    for (const s of sample.subscriptions) ins.push(`insert into public.subscriptions (user_id, provider, status, created_at, current_period_end) values ('${s.user_id}', '${s.provider}', '${s.status}', ${lit(s.created_at)}, '2026-12-01');`);
    await pg.exec(ins.join("\n"));
    await pg.exec("set session_replication_role = origin");
  }, 120000);
  afterAll(async () => { await pg.close(); });

  async function run<T>(sql: string): Promise<T[]> {
    await pg.exec("begin read only");
    try { return (await pg.query<T>(sql)).rows; } finally { await pg.exec("rollback"); }
  }

  it("da las mismas cifras que el resumen diario", async () => {
    const sql = daily.replace("(now() at time zone 'America/Costa_Rica')::date as hasta", "date '2026-11-01' as hasta")
      .replace("now() as observado_en", `timestamptz '${NOW.toISOString()}' as observado_en`);
    expect(sql).not.toBe(daily);
    const rows = await run<Record<string, unknown>>(sql);
    expect(rows).toHaveLength(14);
    const day = rows[0];
    expect((day.dia as Date).toISOString().slice(0, 10)).toBe("2026-11-01");
    const n = (k: string) => Number(day[k]);
    expect({
      registros: n("registros"), cohorte: n("cohorte_hace_3_dias"), cohorteActivada: n("primer_entreno_72h"),
      abiertos: n("entrenos_abiertos"), abandonados: n("entrenos_abandonados"), terminados: n("entrenos_terminados"),
      tarjetas: n("tarjetas_guardadas"), pagos: n("pagos"),
    }).toEqual(EXPECTED);
    expect(day.pct_72h).toBe("33.3");
    // u3 se registró a las 20:00 UTC del 29 oct: sus 72 h terminan después de las 02:00 UTC del 2 nov.
    expect(day.cohorte_cerrada).toBe(false);
  });

  it("desglosa en qué paso se van, con fase, series y segundos de workout_leave", async () => {
    const rows = await run<Record<string, unknown>>(leaves.replace("now() - interval '7 days'", "timestamptz '2026-10-26'"));
    expect(rows.map((r) => [r.paso, r.fase, r.series_hechas == null ? null : Number(r.series_hechas), Number(r.salidas), Number(r.personas), Number(r.despues_terminaron)])).toEqual([
      ["1. antes de la primera serie", "play", 0, 2, 2, 0],
      ["2. a la mitad", "play", 3, 1, 1, 0],
      ["4. en el resumen, sin guardar", "summary", 12, 1, 1, 1],
    ]);
    const first = rows[0];
    expect(Number(first.segundos_mediana)).toBe(65);
    expect(Number(first.pct_salidas)).toBe(50);
  });

  it("solo usa nombres de funnel_events que la app acepta en /api/track", () => {
    const used = [...(daily + leaves).matchAll(/e\.name = '([a-z_]+)'/g)].map((m) => m[1]);
    expect(new Set(used)).toEqual(new Set(["workout_open", "workout_leave"]));
    for (const name of used) expect(FUNNEL_EVENTS as readonly string[]).toContain(name);
  });
});
