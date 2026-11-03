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

const { runReminders } = await import("./notify-run");

// Registro el lunes 2 nov (prueba corriendo, tiene derecho al 50 %). Checkout el martes a las 09:00 en Costa Rica.
const SIGNUP = "2026-11-02T12:00:00.000Z";
const CHECKOUT = "2026-11-03T15:00:00.000Z";
const at = (min: number) => new Date(Date.parse(CHECKOUT) + min * 60_000);
const uid = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
const profile = (n: number, over: Row = {}): Row => ({ id: uid(n), onboarded: true, created_at: SIGNUP, full_name: `Persona ${n}`, train_days: 6, equipment: "gym", timezone: "America/Costa_Rica", plan: "free", role: "free", ...over });
const checkout = (n: number, plan = "completo", billing = "mes", received_at = CHECKOUT): Row => ({
  id: n, type: "app.checkout_started", user_id: uid(n), received_at, payload: { plan, billing, provider: "tilopay" },
});
const mails = (n: number) => sent.filter((s) => s.to.startsWith(uid(n).slice(0, 8)) && s.kind === "checkout_abandonado");
const logOf = (n: number) => (tables.notification_log ?? []).filter((r) => r.user_id === uid(n) && r.kind === "checkout_abandonado");

beforeEach(() => {
  tables = {};
  failing = new Set();
  sent.length = 0;
  resendFails = false;
});

describe("checkout abandonado en runReminders", () => {
  it("sale 1 hora después del checkout, una sola vez, al mismo plan y periodo, y el cron lo cuenta", async () => {
    tables.profiles = [profile(1)];
    tables.payment_events = [checkout(1, "entreno", "anual"), { id: 99, type: "app.cancel_requested", user_id: uid(1), received_at: CHECKOUT, payload: {} }];
    const s0 = await runReminders(at(30), "hourly");
    expect(mails(1)).toEqual([]);
    expect(s0.sent.checkout_abandonado).toBeUndefined();

    const s1 = await runReminders(at(60), "hourly");
    expect(s1.sent.checkout_abandonado).toBe(1);
    expect(mails(1)).toHaveLength(1);
    const m = mails(1)[0];
    expect(m).toMatchObject({ subject: "Tu plan quedó a medio camino", key: `checkout_abandonado/${uid(1)}/2026-11-03` });
    expect(m.text).toContain("Elegiste Entreno, anual.");
    // Destino: el mismo plan y periodo en Mi plan (con el enlace de un toque si hay secreto de inicio de sesión).
    expect(m.text).toMatch(/Terminar mi pago: \S*(\/app\/suscripcion\?plan=entreno&pago=anual|next=%2Fapp%2Fsuscripcion%3Fplan%3Dentreno%26pago%3Danual)/);
    expect(logOf(1)).toEqual([expect.objectContaining({ local_day: "2026-11-03", channels: ["email"] })]);

    await runReminders(at(120), "hourly");
    await runReminders(at(60 * 20), "hourly");
    expect(mails(1)).toHaveLength(1);
  });

  it("no sale si pagó, guardó la tarjeta, tiene un cobro de la prueba o se dio de baja; sí con la suscripción pendiente", async () => {
    tables.profiles = [1, 2, 3, 4, 5, 6].map((n) => profile(n));
    tables.payment_events = [1, 2, 3, 4, 5, 6].map((n) => checkout(n));
    tables.subscriptions = [
      { id: 1, user_id: uid(1), status: "active", current_period_start: at(10).toISOString() },
      { id: 6, user_id: uid(6), status: "incomplete", current_period_start: null },
    ];
    tables.payment_methods = [{ user_id: uid(2), status: "active" }];
    tables.trial_charges = [{ user_id: uid(3), status: "scheduled" }, { user_id: uid(4), status: "succeeded" }];
    tables.notification_prefs = [{ user_id: uid(5), email_reminders: false }];
    const stats = await runReminders(at(61), "hourly");
    for (const n of [1, 2, 3, 4, 5]) expect(mails(n), `cuenta ${n}`).toEqual([]);
    expect(mails(6)).toHaveLength(1);
    expect(stats.sent.checkout_abandonado).toBe(1);
  });

  it("en el mensual recuerda el 50 % a quien tiene derecho; a quien ya pagó un plan, no", async () => {
    tables.profiles = [profile(1), profile(2)];
    tables.payment_events = [checkout(1), checkout(2)];
    tables.subscriptions = [{ id: 2, user_id: uid(2), status: "canceled", current_period_start: "2026-09-01T00:00:00.000Z" }];
    await runReminders(at(61), "hourly");
    const nb = (s: string) => s.replace(/\u00a0/g, " ");
    expect(nb(mails(1)[0].text)).toContain("50 % menos");
    expect(nb(mails(2)[0].text)).not.toContain("50 %");
  });

  it("respeta las horas de silencio y una vez cada 7 días", async () => {
    tables.profiles = [profile(1), profile(2)];
    // Checkout a las 21:30 en Costa Rica: la hora se cumple en silencio (22 a 7) y sale a las 07:00.
    tables.payment_events = [checkout(1, "completo", "mes", "2026-11-04T03:30:00.000Z"), checkout(2)];
    tables.notification_log = [{ user_id: uid(2), kind: "checkout_abandonado", local_day: "2026-10-29", channels: ["email"] }];
    await runReminders(new Date("2026-11-04T05:00:00.000Z"), "hourly");
    expect(mails(1)).toEqual([]);
    await runReminders(new Date("2026-11-04T13:00:00.000Z"), "hourly");
    expect(mails(1)).toHaveLength(1);
    expect(mails(2)).toEqual([]);
  });

  it("si Resend lo rechaza, se libera el turno y la próxima corrida lo intenta de nuevo", async () => {
    tables.profiles = [profile(1)];
    tables.payment_events = [checkout(1)];
    resendFails = true;
    const s1 = await runReminders(at(61), "hourly");
    expect(logOf(1)).toEqual([]);
    expect(s1.sent.checkout_abandonado).toBeUndefined();
    resendFails = false;
    const s2 = await runReminders(at(121), "hourly");
    expect(mails(1)).toHaveLength(1);
    expect(s2.sent.checkout_abandonado).toBe(1);
  });

  it("si no se pueden leer los pagos, no se manda a nadie", async () => {
    tables.profiles = [profile(1)];
    tables.payment_events = [checkout(1)];
    failing.add("subscriptions");
    const stats = await runReminders(at(61), "hourly");
    expect(mails(1)).toEqual([]);
    expect(stats.ok).toBe(false);
  });
});
