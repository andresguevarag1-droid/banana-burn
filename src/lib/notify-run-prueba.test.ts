// Secuencia de la prueba dentro de runReminders: a quién le llega, que no se repita y que reemplace al recordatorio del día.
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
let tables: Record<string, Row[]> = {};
let failing = new Set<string>();
const sent: { to: string; subject: string; key?: string; kind?: string }[] = [];

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
  sendEmail: async (to: string, msg: { subject: string }, o: { idempotencyKey?: string; tags?: { kind?: string } }) => {
    sent.push({ to, subject: msg.subject, key: o.idempotencyKey, kind: o.tags?.kind });
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

describe("secuencia de la prueba en runReminders", () => {
  it("llega a la prueba normal y reemplaza el correo del recordatorio de ese día", async () => {
    tables.profiles = [profile(1)];
    const stats = await runReminders(DAY2, "daily");
    expect(kinds(1)).toEqual(["prueba_d2"]);
    expect(sent[0]).toMatchObject({ subject: "Tu primer resultado empieza por registrar", key: `prueba_d2/${uid(1)}` });
    expect(stats.sent).toMatchObject({ prueba_d2: 1, recordatorio: 1 });
    // El recordatorio sigue en la campanita, sin correo.
    expect(tables.notifications?.map((n) => n.kind)).toEqual(["recordatorio"]);
  });

  it("no se repite: una sola vez por cuenta y pieza, aunque el cron corra otra vez", async () => {
    tables.profiles = [profile(1)];
    await runReminders(DAY2, "daily");
    await runReminders(new Date(DAY2.getTime() + 3600_000), "daily");
    expect(kinds(1)).toEqual(["prueba_d2"]);
    expect(tables.notification_log.filter((r) => r.kind === "prueba_d2")).toEqual([expect.objectContaining({ local_day: "1970-01-01" })]);
  });

  it("no llega a beta, baja de recordatorios, pagos, cortesías, condominios, testers, staff ni cobros cancelados", async () => {
    tables.profiles = [
      profile(1, { created_at: "2026-10-30T12:00:00.000Z" }), // beta
      profile(2), profile(3), profile(4), profile(5), profile(6),
      profile(7, { role: "admin" }), profile(8, { plan: "completo" }), profile(9),
    ];
    tables.notification_prefs = [{ user_id: uid(2), email_reminders: false }];
    tables.subscriptions = [{ user_id: uid(3), status: "active" }];
    tables.comp_grants = [{ user_id: uid(4), revoked_at: null }]; // cortesía, regalo o mes gratis de condominio
    tables.tester_grants = [{ user_id: uid(5), revoked_at: null }];
    tables.trial_charges = [
      { user_id: uid(6), status: "canceled", kind: "prueba", charge_at: "2026-11-09T12:00:00.000Z", reminder_sent_at: null },
      { user_id: uid(9), status: "scheduled", kind: "prueba", charge_at: "2026-11-09T12:00:00.000Z", reminder_sent_at: null },
    ];
    await runReminders(DAY2, "daily");
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) expect(kinds(n), `cuenta ${n}`).not.toContain("prueba_d2");
    // Cobro programado sin aviso hoy: el día 2 sí le llega.
    expect(kinds(9)).toEqual(["prueba_d2"]);
  });

  it("el día del aviso del cobro va solo recordatorioCobro: no sale el día 6", async () => {
    tables.profiles = [profile(1), profile(2)];
    tables.trial_charges = [{ user_id: uid(1), status: "scheduled", kind: "prueba", charge_at: "2026-11-09T12:00:00.000Z", reminder_sent_at: "2026-11-07T06:20:00.000Z" }];
    await runReminders(DAY6, "daily");
    expect(kinds(1)).not.toContain("prueba_d6");
    expect(kinds(2)).toEqual(["prueba_d6"]);
  });

  it("si no se pueden leer los pagos, no se manda a nadie del lote (y el recordatorio sale normal)", async () => {
    tables.profiles = [profile(1)];
    failing.add("subscriptions");
    await runReminders(DAY2, "daily");
    expect(kinds(1)).toEqual(["recordatorio"]);
  });

  it("en modo por hora, solo a la hora del recordatorio de la persona", async () => {
    tables.profiles = [profile(1)];
    // 07:00 en Costa Rica = 13:00 UTC; a las 12:00 UTC no toca.
    await runReminders(new Date("2026-11-03T12:00:00.000Z"), "hourly");
    expect(kinds(1)).toEqual([]);
    await runReminders(DAY2, "hourly");
    expect(kinds(1)).toEqual(["prueba_d2"]);
  });
});
