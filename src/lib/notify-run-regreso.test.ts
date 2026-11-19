// Correos de regreso (#320) dentro de runReminders (cada hora): R1 a las 7:00 del día siguiente al primer entreno, R2 de 48 a
// 72 h, R3 de Andrés el día 4, R4 al día siguiente del segundo; uno por día, reemplazan al recordatorio y a la pieza de la
// prueba, se cortan al entrenar, respetan la baja y las exclusiones, y salen en el idioma de la cuenta.
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
let tables: Record<string, Row[]> = {};
const sent: { to: string; subject: string; html: string; text: string; key?: string; kind?: string; from?: string; replyTo?: string }[] = [];
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
        rows.push({ ...u, created_at: now.toISOString() });
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
  sendEmail: async (to: string, msg: { subject: string; html: string; text: string }, o: { idempotencyKey?: string; tags?: { kind?: string }; from?: string; replyTo?: string }) => {
    if (resendFails) return { ok: false, error: "422" };
    sent.push({ to, subject: msg.subject, html: msg.html, text: msg.text, key: o.idempotencyKey, kind: o.tags?.kind, from: o.from, replyTo: o.replyTo });
    return { ok: true };
  },
}));

const { runReminders } = await import("./notify-run");

// Registro el lunes 2 nov a las 06:00 en Costa Rica (UTC-6); primer entreno terminado a las 14:00 CR.
const SIGNUP = "2026-11-02T12:00:00.000Z";
const FIRST = "2026-11-02T20:00:00.000Z";
/** Instante en hora de Costa Rica. */
const cr = (day: string, hour: number) => new Date(Date.parse(`${day}T00:00:00.000Z`) + (hour + 6) * 3600_000);
let now = new Date(0);
const run = (day: string, hour: number) => { now = cr(day, hour); return runReminders(now, "hourly"); };
const uid = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
const profile = (n: number, over: Row = {}): Row => ({ id: uid(n), onboarded: true, created_at: SIGNUP, full_name: `Ana ${n}`, train_days: 6, equipment: "gym", timezone: "America/Costa_Rica", plan: "free", role: "free", ...over });
const workout = (n: number, finished_at = FIRST): Row => ({ id: `${n}-${finished_at}`, user_id: uid(n), day: finished_at.slice(0, 10), finished_at });
const mails = (n: number) => sent.filter((s) => s.to.startsWith(uid(n).slice(0, 8)));
const comebacks = (n: number) => mails(n).filter((s) => s.kind?.startsWith("regreso_")).map((s) => s.kind);

beforeEach(() => {
  tables = {};
  sent.length = 0;
  resendFails = false;
});

describe("secuencia de regreso en runReminders", () => {
  it("R1 a las 7:00 del día siguiente, R2 a las 48 h, R3 de Andrés el día 4; uno por día y cada uno una vez", async () => {
    tables.profiles = [profile(1)];
    tables.workouts = [workout(1)];
    await run("2026-11-03", 6);
    expect(comebacks(1)).toEqual([]);
    const stats = await run("2026-11-03", 7);
    expect(comebacks(1)).toEqual(["regreso_r1"]);
    const r1 = mails(1)[0];
    expect(r1.subject).toMatch(/^Tu entreno 2 está listo: unos \d+ min$/);
    expect(r1.key).toBe(`regreso_r1/${uid(1)}`);
    expect(r1.html).toContain("e=regreso_r1");
    // Ese día no sale otro correo: ni el recordatorio ni la pieza del día 2 de la prueba (si choca, gana el de regreso).
    expect(mails(1).length).toBe(1);
    expect(stats.sent.regreso_r1).toBe(1);
    expect(stats.errors).toBe(0);
    for (const h of [8, 12, 18]) await run("2026-11-03", h);
    expect(mails(1).length).toBe(1);

    await run("2026-11-04", 14);
    expect(comebacks(1)).toEqual(["regreso_r1", "regreso_r2"]);
    expect(mails(1).at(-1)!.subject).toMatch(/^Ayer no pudiste\. Hoy son \d+ minutos$/);

    await run("2026-11-06", 7);
    expect(comebacks(1)).toEqual(["regreso_r1", "regreso_r2", "regreso_r3"]);
    const r3 = mails(1).at(-1)!;
    expect(r3.subject).toBe("¿Qué te frenó para volver?");
    expect(r3.html).toBe("");
    expect(r3.text.startsWith("Hola, Ana:")).toBe(true);
    expect(r3.from).toBe("Andrés de Banana Burn <hola@bananaburn.app>");
    expect(r3.replyTo).toBe("hola@bananaburn.app");
    await run("2026-11-07", 7);
    expect(comebacks(1).length).toBe(3);
  });

  it("nombra un dato real del primer entreno", async () => {
    tables.profiles = [profile(1)];
    tables.workouts = [workout(1)];
    tables.workout_sets = [1, 2, 3].map((set_no) => ({ workout_id: `1-${FIRST}`, user_id: uid(1), exercise: "squat", set_no, kg: 20, reps: 8, rir: 2 }));
    await run("2026-11-03", 7);
    expect(mails(1)[0].text).toContain("La vez pasada hiciste sentadilla trasera con 20 kg");
  });

  it("se corta al entrenar: con el segundo entreno ya no sale R2, sino R4 al día siguiente", async () => {
    tables.profiles = [profile(1)];
    tables.workouts = [workout(1), workout(1, "2026-11-03T23:00:00.000Z")]; // martes 3 nov, 17:00 CR
    await run("2026-11-03", 18);
    expect(comebacks(1)).toEqual([]);
    await run("2026-11-04", 7);
    expect(comebacks(1)).toEqual(["regreso_r4"]);
    expect(mails(1)[0].subject).toBe("Vas 2. El 3.º es el que hace el hábito");
  });

  it("quien ya recibió segundo_entreno (#286) no recibe R2", async () => {
    tables.profiles = [profile(1)];
    tables.workouts = [workout(1)];
    tables.notification_log = [{ user_id: uid(1), kind: "segundo_entreno", local_day: "2026-11-01", channels: ["email"] }];
    await run("2026-11-04", 14);
    expect(comebacks(1)).toEqual([]);
  });

  it("respeta email_reminders y las exclusiones de la prueba", async () => {
    tables.profiles = [profile(1), profile(2), profile(3), profile(4, { role: "admin" }), profile(5, { created_at: "2026-10-30T12:00:00.000Z" }), profile(6)];
    tables.workouts = [1, 2, 3, 4, 5, 6].map((n) => workout(n));
    tables.notification_prefs = [{ user_id: uid(1), email_reminders: false, timezone: "America/Costa_Rica" }];
    tables.subscriptions = [{ user_id: uid(2), status: "active" }];
    tables.tester_grants = [{ user_id: uid(3), revoked_at: null }];
    await run("2026-11-03", 7);
    for (const n of [1, 2, 3, 4, 5]) expect(comebacks(n), `cuenta ${n}`).toEqual([]);
    expect(comebacks(6)).toEqual(["regreso_r1"]);
  });

  it("si hoy ya recibió otro correo, se omite sin reclamar", async () => {
    tables.profiles = [profile(1)];
    tables.workouts = [workout(1)];
    tables.notification_log = [{ user_id: uid(1), kind: "prueba_d2", local_day: "1970-01-01", channels: ["email"], created_at: "2026-11-03T12:30:00.000Z" }];
    const stats = await run("2026-11-03", 7);
    expect(comebacks(1)).toEqual([]);
    expect(stats.sent.regreso_r1_omitido).toBe(1);
    expect(tables.notification_log.some((r) => r.kind === "regreso_r1")).toBe(false);
  });

  it("si Resend lo rechaza, libera el turno para la próxima corrida", async () => {
    tables.profiles = [profile(1)];
    tables.workouts = [workout(1)];
    resendFails = true;
    await run("2026-11-04", 14);
    expect((tables.notification_log ?? []).some((r) => r.kind === "regreso_r2")).toBe(false);
    resendFails = false;
    await run("2026-11-04", 15);
    expect(comebacks(1)).toEqual(["regreso_r2"]);
  });

  it("sale en el idioma de profiles.locale", async () => {
    tables.profiles = [profile(1, { locale: "en-US" }), profile(2)];
    tables.workouts = [workout(1), workout(2)];
    await run("2026-11-03", 7);
    expect(mails(1)[0].subject).toMatch(/^Your workout 2 is ready: about \d+ min$/);
    expect(mails(2)[0].subject).toMatch(/^Tu entreno 2 está listo/);
  });
});
