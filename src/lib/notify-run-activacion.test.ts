// Correos de activación A0, A1 y A2 (#225) dentro de runReminders: quién recibe cada uno (con y sin entreno, con y sin
// email_reminders, ya recibió otro correo hoy), el destino del botón, que nunca se repitan y las estadísticas del cron.
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

// Registro el lunes 2 nov a las 06:00 en Costa Rica (después de la beta). El cron diario corre a las 13:00 UTC (07:00 CR).
const SIGNUP = "2026-11-02T12:00:00.000Z";
const at = (h: number) => new Date(Date.parse(SIGNUP) + h * 3600_000);
const DAY0 = at(1); // 1 h: A0
const DAY1 = at(25); // A1
const DAY2 = at(49); // entre piezas
const DAY3 = at(73); // A2
const uid = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
const profile = (n: number, over: Row = {}): Row => ({ id: uid(n), onboarded: true, created_at: SIGNUP, full_name: `Persona ${n}`, train_days: 6, equipment: "gym", timezone: "America/Costa_Rica", plan: "free", role: "free", ...over });
const mails = (n: number) => sent.filter((s) => s.to.startsWith(uid(n).slice(0, 8)));
const kinds = (n: number) => mails(n).map((s) => s.kind);
const logOf = (n: number, kind: string) => (tables.notification_log ?? []).filter((r) => r.user_id === uid(n) && r.kind === kind);

beforeEach(() => {
  tables = {};
  sent.length = 0;
  resendFails = false;
});

describe("correos de activación en runReminders (diario)", () => {
  it("QA #225: el modo diario respeta las horas de silencio", async () => {
    tables.profiles = [profile(1)];
    tables.notification_prefs = [{
      user_id: uid(1), email_reminders: true, timezone: "America/Costa_Rica",
      quiet_start: "06:00", quiet_end: "08:00",
    }];
    await runReminders(DAY0, "daily"); // 07:00 CR, dentro del silencio configurado
    expect(kinds(1).filter((kind) => kind?.startsWith("activacion_"))).toEqual([]);
    expect(logOf(1, "activacion_0")).toEqual([]);
  });

  it("QA #225: A0 sale en la corrida diaria siguiente si el registro fue menos de una hora antes del cron", async () => {
    tables.profiles = [profile(1, { created_at: "2026-11-02T12:30:00.000Z" })];
    await runReminders(DAY0, "daily"); // registro + 30 min: todavía no corresponde A0
    expect(kinds(1).filter((kind) => kind?.startsWith("activacion_"))).toEqual([]);
    await runReminders(DAY1, "daily"); // corrida siguiente: registro + 24 h 30 min
    expect(kinds(1).filter((kind) => kind?.startsWith("activacion_"))).toEqual(["activacion_0"]);
  });

  it("A0, A1 y A2 a quien no tiene entrenos, uno por corrida y en su día; las estadísticas los cuentan", async () => {
    tables.profiles = [profile(1)];
    const s0 = await runReminders(DAY0, "daily");
    expect(kinds(1)).toEqual(["activacion_0"]);
    expect(s0.sent.activacion_0).toBe(1);
    expect(mails(1)[0]).toMatchObject({ subject: "Tu primer entreno: 12 minutos en casa", key: `activacion_0/${uid(1)}` });

    const s1 = await runReminders(DAY1, "daily");
    expect(s1.sent.activacion_1).toBe(1);
    const s2 = await runReminders(DAY2, "daily");
    expect(Object.keys(s2.sent).filter((k) => k.startsWith("activacion"))).toEqual([]);
    const s3 = await runReminders(DAY3, "daily");
    expect(s3.sent.activacion_2).toBe(1);
    expect(kinds(1).filter((k) => k?.startsWith("activacion"))).toEqual(["activacion_0", "activacion_1", "activacion_2"]);
    expect(mails(1).find((m) => m.kind === "activacion_2")?.subject).toBe("Hoy también puedes empezar");
    await runReminders(at(97), "daily");
    expect(kinds(1).filter((k) => k?.startsWith("activacion"))).toHaveLength(3);
  });

  it("nunca dos veces: el cron corre otra vez el mismo día o al siguiente dentro de la ventana", async () => {
    tables.profiles = [profile(1)];
    await runReminders(DAY1, "daily");
    await runReminders(at(26), "daily");
    await runReminders(at(47), "daily");
    expect(kinds(1).filter((k) => k === "activacion_1")).toHaveLength(1);
    expect(logOf(1, "activacion_1")).toEqual([expect.objectContaining({ local_day: "2026-11-03", channels: ["email"] })]);
  });

  it("no llega a quien ya guardó un entreno, se dio de baja de los recordatorios, no terminó el registro o es más vieja", async () => {
    tables.profiles = [profile(1), profile(2), profile(3, { onboarded: false }), profile(4, { created_at: "2026-10-20T12:00:00.000Z" }), profile(5)];
    tables.workouts = [{ id: 1, user_id: uid(1), day: "2026-11-02" }];
    tables.notification_prefs = [{ user_id: uid(2), email_reminders: false }];
    await runReminders(DAY1, "daily");
    for (const n of [1, 2, 3, 4]) expect(kinds(n).filter((k) => k?.startsWith("activacion")), `cuenta ${n}`).toEqual([]);
    expect(kinds(5)).toEqual(["activacion_1"]);
  });

  it("no sale si hoy ya recibió otro correo (fin de la beta, una pieza de la prueba); sí con solo la bienvenida", async () => {
    tables.profiles = [profile(1), profile(2), profile(3)];
    tables.notification_log = [
      { user_id: uid(1), kind: "beta_fin_2", local_day: "2026-11-03", channels: ["email"] },
      { user_id: uid(2), kind: "prueba_d2", local_day: "1970-01-01", channels: ["email"], created_at: "2026-11-03T12:30:00.000Z" },
      { user_id: uid(3), kind: "bienvenida", local_day: "1970-01-01", channels: ["email"], created_at: "2026-11-03T12:30:00.000Z" },
    ];
    const stats = await runReminders(DAY1, "daily");
    expect(kinds(1).filter((k) => k?.startsWith("activacion"))).toEqual([]);
    expect(kinds(2).filter((k) => k?.startsWith("activacion"))).toEqual([]);
    expect(logOf(1, "activacion_1")).toEqual([]);
    expect(stats.sent.activacion_1_omitido).toBe(2);
    expect(kinds(3)).toEqual(["activacion_1"]);
  });

  it("reemplaza el correo del recordatorio del día y la pieza de la prueba cede (siguen en la campanita)", async () => {
    tables.profiles = [profile(1)];
    const stats = await runReminders(DAY1, "daily");
    expect(kinds(1)).toEqual(["activacion_1"]);
    expect(stats.sent).toMatchObject({ activacion_1: 1, recordatorio: 1 });
    expect(stats.sent.prueba_d2).toBeUndefined();
    expect(tables.notifications?.map((n) => n.kind)).toEqual(["recordatorio"]);
  });

  it("el botón abre el primer entreno en casa con gym o mixto, y el entreno del día si entrena en casa", async () => {
    tables.profiles = [profile(1, { equipment: "gym" }), profile(2, { equipment: "mixto" }), profile(3, { equipment: "casa" })];
    await runReminders(DAY0, "daily");
    for (const n of [1, 2]) {
      expect(mails(n)[0].html).toContain("/app/entreno?casa=1\"");
      expect(mails(n)[0].text).toMatch(/Empezar mi entreno: https?:\/\/\S+\/app\/entreno\?casa=1\n/);
    }
    expect(mails(3)[0].html).not.toContain("casa=1");
    expect(mails(3)[0].text).toMatch(/Empezar mi entreno: https?:\/\/\S+\/app\/entreno\n/);
  });

  it("si Resend la rechaza, se libera el turno y la próxima corrida lo intenta de nuevo", async () => {
    tables.profiles = [profile(1)];
    resendFails = true;
    const s1 = await runReminders(DAY1, "daily");
    expect(logOf(1, "activacion_1")).toEqual([]);
    expect(s1.sent.activacion_1).toBeUndefined();
    resendFails = false;
    await runReminders(at(26), "daily");
    expect(kinds(1)).toEqual(["activacion_1"]);
  });
});

describe("correos de activación en runReminders (cada hora)", () => {
  it("A0 sale en la corrida siguiente a la primera hora, a cualquier hora fuera del silencio", async () => {
    tables.profiles = [profile(1, { created_at: "2026-11-02T16:00:00.000Z" })]; // 10:00 en Costa Rica
    await runReminders(new Date("2026-11-02T16:30:00.000Z"), "hourly");
    expect(kinds(1)).toEqual([]);
    const stats = await runReminders(new Date("2026-11-02T17:00:00.000Z"), "hourly"); // 11:00 CR
    expect(kinds(1)).toEqual(["activacion_0"]);
    expect(stats.sent.activacion_0).toBe(1);
  });

  it("respeta las horas de silencio: A0 espera a que terminen", async () => {
    tables.profiles = [profile(1, { created_at: "2026-11-03T03:30:00.000Z" })]; // 21:30 en Costa Rica
    await runReminders(new Date("2026-11-03T05:00:00.000Z"), "hourly"); // 23:00 CR, silencio de 22 a 7
    expect(kinds(1)).toEqual([]);
    await runReminders(new Date("2026-11-03T13:00:00.000Z"), "hourly"); // 07:00 CR
    expect(kinds(1)).toEqual(["activacion_0"]);
  });

  it("A1 sale a la hora del recordatorio, antes que el recordatorio del primer entreno, y lo reemplaza", async () => {
    tables.profiles = [profile(1, { created_at: "2026-11-02T12:00:00.000Z" })]; // 06:00 CR; A0 ya salió
    tables.notification_log = [{ user_id: uid(1), kind: "activacion_0", local_day: "2026-11-02", channels: ["email"] }];
    await runReminders(new Date("2026-11-03T12:00:00.000Z"), "hourly"); // 06:00 CR: no es la hora del recordatorio
    expect(kinds(1)).toEqual([]);
    const stats = await runReminders(new Date("2026-11-03T13:00:00.000Z"), "hourly"); // 07:00 CR, 25 h
    expect(kinds(1)).toEqual(["activacion_1"]);
    expect(stats.sent).toMatchObject({ activacion_1: 1, recordatorio: 1 });
  });
});
