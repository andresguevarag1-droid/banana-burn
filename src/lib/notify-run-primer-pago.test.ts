// Correos después del primer pago dentro de runReminders: a quién le llegan, que no se repitan y que nunca salgan dos
// correos el mismo día local (incluido el resumen semanal del lunes).
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
    lt: (col: string, v: string) => { filters.push((r) => String(r[col]) < v); return q; },
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

// Recuperación forzada para una cuenta: en la base real no coincide con el primer pago (exige no haber pagado nunca), pero
// la regla de un correo por día no debe depender de eso.
let forcedRecovery: string | null = null;
vi.mock("@/lib/recuperacion", async (orig) => {
  const real = await orig<typeof import("@/lib/recuperacion")>();
  return {
    ...real,
    recoveryStepAt: (...a: Parameters<typeof real.recoveryStepAt>) => (forcedRecovery ? "recuperacion_d8" : real.recoveryStepAt(...a)),
    recoveryStep: (a: Parameters<typeof real.recoveryStep>[0]) => (forcedRecovery ? "recuperacion_d8" : real.recoveryStep(a)),
  };
});

const { runReminders } = await import("./notify-run");

const SIGNUP = "2026-11-02T12:00:00.000Z";
const PAID = "2026-11-10T15:00:00.000Z"; // martes, 09:00 en Costa Rica
const DAY1 = new Date("2026-11-11T16:00:00.000Z"); // miércoles, 25 h después del pago
const DAY21 = new Date("2026-12-01T16:00:00.000Z"); // martes, 21 días y 1 h después
const uid = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
const profile = (n: number, over: Row = {}): Row => ({ id: uid(n), onboarded: true, created_at: SIGNUP, full_name: `Persona ${n}`, train_days: 6, equipment: "gym", timezone: "America/Costa_Rica", plan: "entreno", role: "free", ...over });
const sub = (n: number, over: Row = {}): Row => ({
  id: n, user_id: uid(n), status: "active", plan: "entreno", billing: "mes", cancel_at_period_end: false,
  current_period_start: PAID, current_period_end: "2026-12-10T15:00:00.000Z", created_at: "2026-11-10T14:58:00.000Z", ...over,
});
const kinds = (n: number) => sent.filter((s) => s.to.startsWith(uid(n).slice(0, 8))).map((s) => s.kind);
const logOf = (n: number, kind: string) => (tables.notification_log ?? []).filter((r) => r.user_id === uid(n) && r.kind === kind);

beforeEach(() => {
  tables = {};
  failing = new Set();
  sent.length = 0;
  forcedRecovery = null;
});

describe("correos después del primer pago en runReminders", () => {
  it("día 1: llega a quien hizo su primer pago mensual y reemplaza el correo del recordatorio", async () => {
    tables.profiles = [profile(1)];
    tables.subscriptions = [sub(1)];
    const stats = await runReminders(DAY1, "daily");
    expect(kinds(1)).toEqual(["primer_pago_d1"]);
    expect(sent[0]).toMatchObject({ subject: "Tu primera semana: entrena y registra", key: `primer_pago_d1/${uid(1)}` });
    expect(stats.sent).toMatchObject({ primer_pago_d1: 1, recordatorio: 1 });
    // El recordatorio sigue en la campanita, sin correo.
    expect(tables.notifications?.map((n) => n.kind)).toEqual(["recordatorio"]);
    expect(logOf(1, "primer_pago_d1")).toEqual([expect.objectContaining({ local_day: "2026-11-11", channels: ["email"] })]);
  });

  it("día 21: llega también con Entreno + Nutrición", async () => {
    tables.profiles = [profile(1, { plan: "completo" })];
    tables.subscriptions = [sub(1, { plan: "completo" })];
    await runReminders(DAY21, "daily");
    expect(kinds(1)).toEqual(["primer_pago_d21"]);
    expect(sent[0]).toMatchObject({ subject: "Mira lo que llevas este mes", key: `primer_pago_d21/${uid(1)}` });
  });

  it("no se repite: una vez por cuenta y pieza, aunque el cron corra otra vez ese día o al siguiente dentro de la ventana", async () => {
    tables.profiles = [profile(1)];
    tables.subscriptions = [sub(1)];
    await runReminders(DAY1, "daily");
    await runReminders(new Date(DAY1.getTime() + 3600_000), "daily");
    await runReminders(new Date("2026-11-12T14:00:00.000Z"), "daily"); // 47 h después del pago, otro día local
    expect(kinds(1).filter((k) => k === "primer_pago_d1")).toEqual(["primer_pago_d1"]);
    expect(logOf(1, "primer_pago_d1")).toHaveLength(1);
  });

  it("no llega a renovaciones, anuales, pagos sin confirmar, cancelados, bajas, cortesías, condominios ni a la beta sin pago", async () => {
    tables.profiles = [
      profile(1), profile(2), profile(3), profile(4), profile(5),
      profile(6, { plan: "completo" }), profile(7, { plan: "completo" }),
      profile(8, { created_at: "2026-10-20T12:00:00.000Z", plan: "pro" }),
      profile(9, { created_at: "2026-10-20T12:00:00.000Z" }),
    ];
    tables.subscriptions = [
      sub(1, { created_at: "2026-10-10T14:58:00.000Z" }), // renovación del mes 2
      sub(2, { billing: "anual", current_period_end: "2027-11-10T15:00:00.000Z" }),
      sub(3, { status: "incomplete", current_period_start: null, current_period_end: null }),
      sub(4, { cancel_at_period_end: true }),
      sub(5),
      sub(9), // beta con su primer pago mensual: sí le llega
    ];
    tables.notification_prefs = [{ user_id: uid(5), email_reminders: false }];
    tables.comp_grants = [
      { user_id: uid(6), source: "cortesia", revoked_at: null }, // cortesía del panel
      { user_id: uid(7), source: "condominio", revoked_at: null }, // mes gratis de condominio
    ];
    tables.challenge_purchases = [{ user_id: uid(8), status: "paid" }]; // compra de una temporada: no es un plan
    await runReminders(DAY1, "daily");
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) expect(kinds(n), `cuenta ${n}`).not.toContain("primer_pago_d1");
    expect(kinds(9)).toEqual(["primer_pago_d1"]);
  });

  it("el lunes con resumen semanal sale solo el resumen: la pieza se omite, queda anotada y no se manda después", async () => {
    tables.profiles = [profile(1), profile(2)];
    tables.subscriptions = [sub(1, { current_period_start: "2026-11-15T15:00:00.000Z", created_at: "2026-11-15T14:58:00.000Z" }), sub(2, { current_period_start: "2026-11-15T15:00:00.000Z", created_at: "2026-11-15T14:58:00.000Z" })];
    tables.notification_prefs = [{ user_id: uid(2), weekly_summary: false }];
    const monday = new Date("2026-11-16T16:00:00.000Z");
    const stats = await runReminders(monday, "daily");
    expect(kinds(1)).toEqual(["semanal"]);
    expect(logOf(1, "primer_pago_d1")).toEqual([expect.objectContaining({ local_day: "2026-11-16", channels: [] })]);
    expect(stats.sent).toMatchObject({ primer_pago_d1_omitido: 1, primer_pago_d1: 1 });
    // Sin resumen semanal, el lunes sí le llega.
    expect(kinds(2)).toEqual(["primer_pago_d1"]);
    await runReminders(new Date("2026-11-17T14:00:00.000Z"), "daily");
    expect(kinds(1)).not.toContain("primer_pago_d1");
  });

  it("si hoy ya salió otro correo, la pieza se omite; si salió la pieza, ningún otro correo ese día", async () => {
    tables.profiles = [profile(1), profile(2)];
    tables.subscriptions = [sub(1), sub(2)];
    tables.notification_log = [
      { user_id: uid(1), kind: "recordatorio", local_day: "2026-11-11", channels: ["inapp", "email"], pushes: 0 },
      { user_id: uid(2), kind: "primer_pago_d1", local_day: "2026-11-11", channels: ["email"], pushes: 0 },
    ];
    await runReminders(DAY1, "daily");
    expect(kinds(1)).toEqual([]);
    expect(logOf(1, "primer_pago_d1")).toEqual([expect.objectContaining({ channels: [] })]);
    // La cuenta 2 ya recibió la pieza hoy: el recordatorio va a la campanita, sin correo.
    expect(kinds(2)).toEqual([]);
    expect(tables.notifications?.filter((n) => n.user_id === uid(2)).map((n) => n.kind)).toEqual(["recordatorio"]);
  });

  it("si el mismo día local toca un correo de recuperación, sale solo uno: la pieza se omite y queda anotada", async () => {
    tables.profiles = [profile(1)];
    tables.subscriptions = [sub(1)];
    forcedRecovery = uid(1);
    const stats = await runReminders(DAY1, "daily");
    expect(sent).toHaveLength(1);
    expect(kinds(1)).toEqual(["recuperacion_d8"]);
    expect(logOf(1, "primer_pago_d1")).toEqual([expect.objectContaining({ local_day: "2026-11-11", channels: [] })]);
    expect(stats.sent).toMatchObject({ primer_pago_d1_omitido: 1 });
  });

  it("si no se pueden leer las suscripciones, no se manda a nadie del lote (y el recordatorio sale normal)", async () => {
    tables.profiles = [profile(1)];
    tables.subscriptions = [sub(1)];
    failing.add("subscriptions");
    await runReminders(DAY1, "daily");
    expect(kinds(1)).toEqual(["recordatorio"]);
  });

  it("en modo por hora, solo a la hora del recordatorio de la persona", async () => {
    tables.profiles = [profile(1)];
    tables.subscriptions = [sub(1)];
    // Pagó a las 09:00 en Costa Rica: su recordatorio de las 07:00 (13:00 UTC) dentro de la ventana es el del jueves.
    await runReminders(new Date("2026-11-11T13:00:00.000Z"), "hourly"); // 22 h: todavía no
    await runReminders(new Date("2026-11-12T12:00:00.000Z"), "hourly"); // no es su hora
    expect(kinds(1)).not.toContain("primer_pago_d1");
    await runReminders(new Date("2026-11-12T13:00:00.000Z"), "hourly");
    expect(kinds(1).at(-1)).toBe("primer_pago_d1");
    expect(kinds(1).filter((k) => k === "primer_pago_d1")).toHaveLength(1);
  });

  it("respeta una hora personalizada, aunque no sea la hora predeterminada", async () => {
    tables.profiles = [profile(1)];
    tables.subscriptions = [sub(1)];
    tables.notification_prefs = [{ user_id: uid(1), reminder_time: "18:30" }];
    await runReminders(new Date("2026-11-11T13:00:00.000Z"), "hourly");
    expect(kinds(1)).not.toContain("primer_pago_d1");
    await runReminders(new Date("2026-11-12T00:00:00.000Z"), "hourly");
    expect(kinds(1)).toEqual(["primer_pago_d1"]);
    expect(logOf(1, "primer_pago_d1")[0].local_day).toBe("2026-11-11");
  });

  it("durante la campaña de fin de beta una cuenta pagada recibe solo la pieza de primer pago", async () => {
    tables.profiles = [profile(1, { created_at: "2026-10-20T12:00:00.000Z" })];
    tables.subscriptions = [sub(1, {
      created_at: "2026-11-02T14:58:00.000Z",
      current_period_start: "2026-11-02T15:00:00.000Z",
      current_period_end: "2026-12-02T15:00:00.000Z",
    })];
    const stats = await runReminders(new Date("2026-11-03T16:00:00.000Z"), "daily");
    expect(stats.errors).toBe(0);
    expect(kinds(1)).toEqual(["primer_pago_d1"]);
    expect(tables.notification_log?.some((r) => String(r.kind).startsWith("beta_fin_"))).toBe(false);
  });

  it("un correo de hoy local bloquea la pieza aunque haya salido en otra fecha UTC", async () => {
    tables.profiles = [profile(1)];
    tables.subscriptions = [sub(1)];
    tables.notification_log = [{ user_id: uid(1), kind: "recordatorio", local_day: "2026-11-11", channels: ["email"], pushes: 0 }];
    // Es 12 de noviembre UTC y todavía 11 de noviembre en Costa Rica; sigue dentro de las 48 horas del pago.
    await runReminders(new Date("2026-11-12T00:00:00.000Z"), "daily");
    expect(sent).toHaveLength(0);
    expect(logOf(1, "primer_pago_d1")).toEqual([expect.objectContaining({ local_day: "2026-11-11", channels: [] })]);
  });
});
