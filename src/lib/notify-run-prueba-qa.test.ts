// QA (#110): casos de la secuencia de la prueba en runReminders que notify-run-prueba.test.ts no cubre.
// Misma base en memoria que ese archivo; aquí además se guarda el enlace de baja de cada correo.
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
let tables: Record<string, Row[]> = {};
let failing = new Set<string>();
const sent: { to: string; subject: string; html: string; key?: string; kind?: string; unsubscribe?: string }[] = [];

/** Base en memoria: lo justo de PostgREST que usa notify-run (select, in, eq, gte, is, order, range, upsert, insert). */
function query(name: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let range: [number, number] | null = null;
  let upsert: Row | null = null;
  const q = {
    select: () => q, order: () => q, limit: () => q,
    in: (col: string, vals: unknown[]) => { filters.push((r) => vals.includes(r[col])); return q; },
    eq: (col: string, v: unknown) => { filters.push((r) => r[col] === v); return q; },
    gte: (col: string, v: string) => { filters.push((r) => String(r[col]) >= v); return q; },
    gt: (col: string, v: number) => { filters.push((r) => Number(r[col]) > v); return q; },
    is: (col: string, v: unknown) => { filters.push((r) => (r[col] ?? null) === v); return q; },
    range: (a: number, b: number) => { range = [a, b]; return q; },
    upsert: (row: Row) => { upsert = row; return q; },
    insert: (row: Row) => { (tables[name] ??= []).push(row); return Promise.resolve({ data: null, error: null }); },
    then: (ok: (v: { data: Row[] | null; error: { code: string } | null }) => unknown) => {
      if (failing.has(name)) return Promise.resolve(ok({ data: null, error: { code: "57014" } }));
      const rows = (tables[name] ??= []);
      if (upsert) {
        const u = upsert;
        if (rows.some((r) => r.user_id === u.user_id && r.kind === u.kind && r.local_day === u.local_day)) return Promise.resolve(ok({ data: [], error: null }));
        rows.push(u);
        return Promise.resolve(ok({ data: [{ id: rows.length }], error: null }));
      }
      const out = rows.filter((r) => filters.every((f) => f(r)));
      return Promise.resolve(ok({ data: range ? out.slice(range[0], range[1] + 1) : out, error: null }));
    },
  };
  return q;
}
const db = { from: query, auth: { admin: { getUserById: async (id: string) => ({ data: { user: { email: `${id.slice(0, 8)}@correo.com` } } }) } } };

vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => db }));
vi.mock("@/lib/supabase/server", () => ({ STAFF: ["coach", "support", "admin", "superadmin"] }));
vi.mock("@/lib/push", () => ({ sendPush: async () => 0 }));
vi.mock("@/lib/email/send", () => ({
  unsubscribeUrl: (u: string, s: string) => `https://bananaburn.app/api/email/baja?u=${u}&s=${s}`,
  sendEmail: async (to: string, msg: { subject: string; html: string }, o: { idempotencyKey?: string; unsubscribe?: string; tags?: { kind?: string } }) => {
    sent.push({ to, subject: msg.subject, html: msg.html, key: o.idempotencyKey, kind: o.tags?.kind, unsubscribe: o.unsubscribe });
    return { ok: true };
  },
}));

const { runReminders } = await import("./notify-run");

const SIGNUP = "2026-11-02T12:00:00.000Z";
const DAY2 = new Date("2026-11-03T13:00:00.000Z"); // martes, 25 h después del registro
const DAY6 = new Date("2026-11-07T13:00:00.000Z"); // sábado, 121 h después
const uid = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
const profile = (n: number, over: Row = {}): Row => ({ id: uid(n), onboarded: true, created_at: SIGNUP, full_name: `Persona ${n}`, train_days: 6, equipment: "gym", timezone: "America/Costa_Rica", plan: "free", role: "free", ...over });
const kinds = (n: number) => sent.filter((s) => s.to.startsWith(uid(n).slice(0, 8))).map((s) => s.kind);

beforeEach(() => {
  tables = {};
  failing = new Set();
  sent.length = 0;
});

describe("secuencia de la prueba en runReminders (QA)", () => {
  it("el enlace de baja es el de los recordatorios, el mismo interruptor que exige la secuencia", async () => {
    tables.profiles = [profile(1)];
    await runReminders(DAY2, "daily");
    const e = sent.find((s) => s.kind === "prueba_d2")!;
    expect(e.unsubscribe).toBe(`https://bananaburn.app/api/email/baja?u=${uid(1)}&s=recordatorios`);
    expect(e.html).toContain(e.unsubscribe!.replace(/&/g, "&amp;"));
  });

  it("sale aunque ese día no toque recordatorio (ya entrenó hoy)", async () => {
    tables.profiles = [profile(1)];
    tables.workouts = [{ user_id: uid(1), day: "2026-11-03" }];
    const stats = await runReminders(DAY2, "daily");
    expect(kinds(1)).toEqual(["prueba_d2"]);
    expect(stats.sent.recordatorio).toBeUndefined();
  });

  it("no reemplaza el resumen semanal del lunes: llegan los dos", async () => {
    // Registro el domingo 1 de noviembre (después de la beta); día 2 = lunes 07:00 en Costa Rica.
    tables.profiles = [profile(1, { created_at: "2026-11-01T12:00:00.000Z" })];
    await runReminders(new Date("2026-11-02T13:00:00.000Z"), "daily");
    expect(kinds(1)).toContain("prueba_d2");
    expect(kinds(1)).toContain("semanal");
    expect(kinds(1)).not.toContain("recordatorio");
  });

  it("día 4 a las 73 horas, y nada después del día 6 ni entre piezas", async () => {
    tables.profiles = [profile(1)];
    await runReminders(new Date("2026-11-05T13:00:00.000Z"), "daily"); // 73 h
    expect(kinds(1)).toEqual(["prueba_d4"]);
    sent.length = 0;
    for (const at of ["2026-11-04T13:00:00.000Z", "2026-11-06T13:00:00.000Z", "2026-11-08T13:00:00.000Z", "2026-11-09T13:00:00.000Z"]) {
      await runReminders(new Date(at), "daily");
    }
    expect(kinds(1).filter((k) => k?.startsWith("prueba_"))).toEqual([]);
  });

  it("las tres piezas, una por día, a lo largo de la prueba", async () => {
    tables.profiles = [profile(1)];
    for (let h = 0; h < 8 * 24; h++) await runReminders(new Date(Date.parse(SIGNUP) + h * 3600_000), "hourly");
    expect(kinds(1).filter((k) => k?.startsWith("prueba_"))).toEqual(["prueba_d2", "prueba_d4", "prueba_d6"]);
  });

  it("en modo por hora no sale a las 20:00 (hora de la racha), solo a la del recordatorio", async () => {
    tables.profiles = [profile(1)];
    tables.notification_prefs = [{ user_id: uid(1), reminder_time: "18:30" }];
    // 20:00 en Costa Rica = 02:00 UTC del día siguiente (sigue dentro de la ventana del día 2).
    await runReminders(new Date("2026-11-04T02:00:00.000Z"), "hourly");
    expect(kinds(1)).not.toContain("prueba_d2");
    // 18:00 en Costa Rica = 00:00 UTC.
    await runReminders(new Date("2026-11-04T00:00:00.000Z"), "hourly");
    expect(kinds(1)).toEqual(["prueba_d2"]);
  });

  it("con email_reminders apagado pero el resumen semanal activo, no hay secuencia", async () => {
    tables.profiles = [profile(1)];
    tables.notification_prefs = [{ user_id: uid(1), email_reminders: false, weekly_summary: true }];
    await runReminders(DAY6, "daily");
    expect(kinds(1)).toEqual([]);
  });
});
