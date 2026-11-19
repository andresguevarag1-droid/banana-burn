// Correo de checkout abandonado (#237) dentro de runReminders: sale solo si no hubo pago ni tarjeta guardada después del
// checkout, una vez, con el destino correcto; libera el turno si Resend lo rechaza; el cron lo cuenta en sent.checkout_abandonado.
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
let tables: Record<string, Row[]> = {};
let failing = new Set<string>();
const sent: { to: string; subject: string; html: string; text: string; key?: string; kind?: string }[] = [];
let resendFails = false;

/** Base en memoria: lo justo de PostgREST que usa notify-run (select, in, eq, gte, lt, order, range, upsert, insert, delete). */
function query(name: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let range: [number, number] | null = null;
  let upsert: Row | null = null;
  let remove = false;
  const q = {
    select: () => q, order: () => q, limit: () => q,
    in: (col: string, vals: unknown[]) => { filters.push((r) => vals.includes(r[col])); return q; },
    eq: (col: string, v: unknown) => { filters.push((r) => r[col] === v); return q; },
    gte: (col: string, v: string) => { filters.push((r) => r[col] != null && String(r[col]) >= v); return q; },
    lt: (col: string, v: string) => { filters.push((r) => String(r[col]) < v); return q; },
    gt: (col: string, v: number) => { filters.push((r) => Number(r[col]) > v); return q; },
    is: (col: string, v: unknown) => { filters.push((r) => (r[col] ?? null) === v); return q; },
    range: (a: number, b: number) => { range = [a, b]; return q; },
    upsert: (row: Row) => { upsert = row; return q; },
    delete: () => { remove = true; return q; },
    insert: (row: Row) => { (tables[name] ??= []).push(row); return Promise.resolve({ data: null, error: null }); },
    then: (ok: (v: { data: Row[] | null; error: { code: string } | null }) => unknown, ko?: (e: unknown) => unknown) => {
      if (failing.has(name)) return Promise.resolve(ok({ data: null, error: { code: "57014" } }));
      const rows = (tables[name] ??= []);
      if (remove) { tables[name] = rows.filter((r) => !filters.every((f) => f(r))); return Promise.resolve(ok({ data: null, error: null })).catch(ko); }
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
  sendEmail: async (to: string, msg: { subject: string; html: string; text: string }, o: { idempotencyKey?: string; tags?: { kind?: string } }) => {
    if (resendFails) return { ok: false, error: "422" };
    sent.push({ to, subject: msg.subject, html: msg.html, text: msg.text, key: o.idempotencyKey, kind: o.tags?.kind });
    return { ok: true };
  },
}));

const { sendCardRescueEmails } = await import("./notify-run");
const STEP = "2026-11-23T16:00:00.000Z";
const id = "00000001-0000-4000-8000-000000000000";
const at = (hours: number) => new Date(Date.parse(STEP) + hours * 36e5);
async function run(hours: number) {
  const stats = { ok: true, mode: "hourly" as const, scanned: 0, candidates: 0, sent: {}, push: 0, email: 0, errors: 0 };
  await sendCardRescueEmails(db as never, at(hours), stats);
  return stats;
}
beforeEach(() => {
  tables = {
    profiles: [{ id, created_at: STEP, role: "free", timezone: "America/Costa_Rica", train_days: 4, goal_type: "grasa", equipment: "gym" }],
    funnel_events: [{ id: 1, user_id: id, name: "card_ask_view", "props->>where": "bienvenida", created_at: STEP }],
  };
  failing = new Set(); sent.length = 0; resendFails = false;
});
describe("card rescue delivery integration (#325)", () => {
  it("sends T1 and T2 once with the chosen goal and days", async () => {
    expect((await run(0.5)).email).toBe(0);
    expect((await run(1)).email).toBe(1);
    expect(sent[0]).toMatchObject({ kind: "tarjeta_rescate_1", key: `tarjeta_rescate_1/${id}` });
    expect(sent[0].text).toContain("4 entrenos por semana");
    expect(sent[0].text).toContain("bajar grasa");
    await run(2);
    expect(sent).toHaveLength(1);
    expect((await run(45)).email).toBe(1);
    expect(sent[1].kind).toBe("tarjeta_rescate_2");
    await run(46);
    expect(sent).toHaveLength(2);
  });
  it("stops T2 after a card is saved", async () => {
    await run(1);
    tables.payment_methods = [{ user_id: id, status: "active" }];
    await run(45);
    expect(sent).toHaveLength(1);
  });
  it.each(["subscriptions", "payment_methods", "notification_prefs", "notification_log"])("fails closed if %s cannot be read", async (table) => {
    failing.add(table);
    const stats = await run(1);
    expect(stats.ok).toBe(false);
    expect(sent).toEqual([]);
  });
  it("releases a rejected delivery for retry", async () => {
    resendFails = true;
    await run(1);
    expect(tables.notification_log).toEqual([]);
    resendFails = false;
    expect((await run(2)).email).toBe(1);
  });
  it("excludes old accounts and unsubscribed accounts", async () => {
    tables.profiles[0].created_at = "2026-11-22T12:00:00Z";
    await run(1);
    expect(sent).toEqual([]);
    tables.profiles[0].created_at = STEP;
    tables.notification_prefs = [{ user_id: id, email_reminders: false }];
    await run(2);
    expect(sent).toEqual([]);
  });
});
