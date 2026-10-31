// Recuperación al terminar la prueba sin plan (días 8 y 14) dentro de runReminders: a quién le llega y a quién no, que no se
// repita y que ese día no salga ningún otro correo.
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
const DAY8 = new Date("2026-11-09T13:00:00.000Z"); // lunes (resumen semanal), 7 días y 1 hora después del registro
const DAY14 = new Date("2026-11-15T13:00:00.000Z"); // 13 días y 1 hora después
const DAY10 = new Date("2026-11-11T13:00:00.000Z");
const uid = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
const profile = (n: number, over: Row = {}): Row => ({ id: uid(n), onboarded: true, created_at: SIGNUP, full_name: `Persona ${n}`, train_days: 6, equipment: "gym", timezone: "America/Costa_Rica", plan: "free", role: "free", ...over });
const kinds = (n: number) => sent.filter((s) => s.to.startsWith(uid(n).slice(0, 8))).map((s) => s.kind);

beforeEach(() => {
  tables = {};
  failing = new Set();
  sent.length = 0;
});

describe("recuperación de la prueba en runReminders", () => {
  it("el día 8 llega a la prueba vencida sin plan y es el único correo del día (sin recordatorio ni resumen semanal)", async () => {
    tables.profiles = [profile(1)];
    const stats = await runReminders(DAY8, "daily");
    expect(kinds(1)).toEqual(["recuperacion_d8"]);
    expect(sent[0]).toMatchObject({ subject: "Tu plan sigue guardado", key: `recuperacion_d8/${uid(1)}` });
    expect(stats.sent).toMatchObject({ recuperacion_d8: 1, semanal: 1, recordatorio: 1 });
    // Los avisos del día siguen en la campanita, sin correo.
    expect(tables.notifications?.map((n) => n.kind).sort()).toEqual(["recordatorio", "semanal"]);
    expect(tables.notification_log.filter((r) => r.kind !== "recuperacion_d8").every((r) => !(r.channels as string[]).includes("email"))).toBe(true);
  });

  it("el día 14 llega el correo del anual; entre medio, nada de recuperación", async () => {
    tables.profiles = [profile(1)];
    await runReminders(DAY10, "daily");
    expect(kinds(1)).toEqual(["recordatorio"]);
    sent.length = 0;
    await runReminders(DAY14, "daily");
    expect(kinds(1)).toEqual(["recuperacion_d14"]);
    expect(sent[0]).toMatchObject({ subject: "Vuelve con un año de entreno", key: `recuperacion_d14/${uid(1)}` });
  });

  it("no se repite: una sola vez por cuenta y correo, aunque el cron corra otra vez", async () => {
    tables.profiles = [profile(1)];
    await runReminders(DAY8, "daily");
    await runReminders(new Date(DAY8.getTime() + 3600_000), "daily");
    expect(kinds(1)).toEqual(["recuperacion_d8"]);
    expect(tables.notification_log.filter((r) => r.kind === "recuperacion_d8")).toEqual([expect.objectContaining({ local_day: "1970-01-01" })]);
  });

  it("no llega a beta, baja, pagos previos, cortesías, condominios, testers, staff, plan asignado ni a quien tiene un cobro", async () => {
    tables.profiles = [
      profile(1, { created_at: "2026-10-26T12:00:00.000Z" }), // beta: tiene finBeta
      profile(2), profile(3), profile(4), profile(5), profile(6, { role: "admin" }), profile(7, { plan: "completo" }),
      profile(8), profile(9), profile(10), profile(11), profile(12),
    ];
    tables.notification_prefs = [{ user_id: uid(2), email_reminders: false }];
    tables.subscriptions = [{ user_id: uid(3), status: "canceled" }, { user_id: uid(12), status: "incomplete" }];
    tables.comp_grants = [{ user_id: uid(4), revoked_at: null }]; // cortesía, regalo o mes gratis de condominio
    tables.tester_grants = [{ user_id: uid(5), revoked_at: null }];
    tables.trial_charges = [
      { user_id: uid(8), status: "failed" }, { user_id: uid(9), status: "retry_scheduled" },
      { user_id: uid(10), status: "unknown" }, { user_id: uid(11), status: "canceled" },
    ];
    await runReminders(DAY8, "daily");
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) expect(kinds(n), `cuenta ${n}`).not.toContain("recuperacion_d8");
    // Una suscripción que quedó en 'incomplete' no es un pago.
    expect(kinds(12)).toEqual(["recuperacion_d8"]);
  });

  it("si no se pueden leer los cobros, no se manda a nadie del lote (y el recordatorio sale normal)", async () => {
    tables.profiles = [profile(1)];
    failing.add("trial_charges");
    await runReminders(DAY10, "daily");
    sent.length = 0;
    await runReminders(DAY8, "daily");
    expect(kinds(1)).not.toContain("recuperacion_d8");
    expect(kinds(1).length).toBeGreaterThan(0);
  });

  it("en modo por hora sale a la hora del recordatorio y ningún otro correo se cuela ese día", async () => {
    tables.profiles = [profile(1)];
    tables.notification_prefs = [{ user_id: uid(1), reminder_time: "09:00", email_reminders: true, weekly_summary: true }];
    // Lunes 07:00 en Costa Rica (13:00 UTC): toca el resumen semanal, pero en la ventana del día 8 no va por correo.
    await runReminders(DAY8, "hourly");
    expect(kinds(1)).toEqual([]);
    expect(tables.notification_log.find((r) => r.kind === "semanal")?.channels).not.toContain("email");
    // 09:00 en Costa Rica: sale el correo de recuperación, solo.
    await runReminders(new Date("2026-11-09T15:00:00.000Z"), "hourly");
    expect(kinds(1)).toEqual(["recuperacion_d8"]);
  });
});
