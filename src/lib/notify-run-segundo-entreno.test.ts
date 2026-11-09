// Correo del segundo entreno (#286) dentro de runReminders: sale una vez a las 48 h del primer entreno, solo si no hizo
// otro, con las exclusiones de la prueba y email_reminders, cede si hoy ya salió otro correo y reemplaza al recordatorio.
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
let tables: Record<string, Row[]> = {};
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


// Registro el lunes 2 nov a las 06:00 en Costa Rica (después de la beta); primer entreno terminado a las 14:00 CR.
// El cron diario corre a las 13:00 UTC (07:00 CR): el miércoles 4 nov van 41 h (todavía no), el jueves 5 nov 65 h.
const SIGNUP = "2026-11-02T12:00:00.000Z";
const FIRST = "2026-11-02T20:00:00.000Z";
const WED = new Date("2026-11-04T13:00:00.000Z");
const THU = new Date("2026-11-05T13:00:00.000Z");
const FRI = new Date("2026-11-06T13:00:00.000Z");
const uid = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
const profile = (n: number, over: Row = {}): Row => ({ id: uid(n), onboarded: true, created_at: SIGNUP, full_name: `Persona ${n}`, train_days: 6, equipment: "gym", timezone: "America/Costa_Rica", plan: "free", role: "free", ...over });
const workout = (n: number, finished_at = FIRST): Row => ({ id: `${n}-${finished_at}`, user_id: uid(n), day: finished_at.slice(0, 10), finished_at });
const mails = (n: number) => sent.filter((s) => s.to.startsWith(uid(n).slice(0, 8)));
const seconds = (n: number) => mails(n).filter((s) => s.kind === "segundo_entreno");

beforeEach(() => {
  tables = {};
  sent.length = 0;
  resendFails = false;
});

describe("correo del segundo entreno en runReminders", () => {
  it("sale una sola vez, a partir de las 48 h, con el botón al entreno; ese día no sale otro correo", async () => {
    tables.profiles = [profile(1)];
    tables.workouts = [workout(1)];
    await runReminders(WED, "daily");
    expect(seconds(1)).toEqual([]);
    sent.length = 0;
    const stats = await runReminders(THU, "daily");
    expect(seconds(1).map((s) => [s.subject, s.key])).toEqual([["Tu segundo entreno está listo", `segundo_entreno/${uid(1)}`]]);
    expect(seconds(1)[0].html).toContain("/app/entreno");
    expect(mails(1).length).toBe(1);
    expect(stats.sent.segundo_entreno).toBe(1);
    expect(stats.errors).toBe(0);
    await runReminders(THU, "daily");
    await runReminders(FRI, "daily");
    expect(seconds(1).length).toBe(1);
  });

  it("no sale si ya hizo el segundo entreno o si no tiene ninguno terminado", async () => {
    tables.profiles = [profile(1), profile(2)];
    tables.workouts = [workout(1), workout(1, "2026-11-04T01:00:00.000Z"), { id: "x", user_id: uid(2), day: "2026-11-02", finished_at: null }];
    await runReminders(THU, "daily");
    expect(seconds(1)).toEqual([]);
    expect(seconds(2)).toEqual([]);
  });

  it("respeta email_reminders y las exclusiones de la prueba", async () => {
    tables.profiles = [profile(1), profile(2), profile(3), profile(4, { role: "admin" }), profile(5, { created_at: "2026-10-30T12:00:00.000Z" }), profile(6)];
    tables.workouts = [1, 2, 3, 4, 5, 6].map((n) => workout(n));
    tables.notification_prefs = [{ user_id: uid(1), email_reminders: false, timezone: "America/Costa_Rica" }];
    tables.subscriptions = [{ user_id: uid(2), status: "active" }];
    tables.tester_grants = [{ user_id: uid(3), revoked_at: null }];
    await runReminders(THU, "daily");
    for (const n of [1, 2, 3, 4, 5]) expect(seconds(n), `cuenta ${n}`).toEqual([]);
    expect(seconds(6).length).toBe(1);
  });

  it("si hoy ya recibió otro correo, se omite sin reclamar", async () => {
    tables.profiles = [profile(1)];
    tables.workouts = [workout(1)];
    tables.notification_log = [{ user_id: uid(1), kind: "prueba_d4", local_day: "1970-01-01", channels: ["email"], created_at: "2026-11-05T12:30:00.000Z" }];
    const stats = await runReminders(THU, "daily");
    expect(seconds(1)).toEqual([]);
    expect(stats.sent.segundo_entreno_omitido).toBe(1);
    expect(tables.notification_log.some((r) => r.kind === "segundo_entreno")).toBe(false);
  });

  it("si Resend lo rechaza, libera el turno para la próxima corrida", async () => {
    tables.profiles = [profile(1)];
    tables.workouts = [workout(1)];
    resendFails = true;
    await runReminders(THU, "daily");
    expect((tables.notification_log ?? []).some((r) => r.kind === "segundo_entreno")).toBe(false);
    resendFails = false;
    await runReminders(new Date("2026-11-05T14:00:00.000Z"), "daily");
    expect(seconds(1).length).toBe(1);
  });
});

describe("idioma de la cuenta (#301)", () => {
  it("sale en el idioma de profiles.locale", async () => {
    tables.profiles = [profile(1, { locale: "en-US" }), profile(2)];
    tables.workouts = [workout(1), workout(2)];
    await runReminders(THU, "daily");
    expect(seconds(1).map((s) => s.subject)).toEqual(["Your second workout is ready"]);
    expect(seconds(2).map((s) => s.subject)).toEqual(["Tu segundo entreno está listo"]);
  });
});
