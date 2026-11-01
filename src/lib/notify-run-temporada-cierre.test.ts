// Correos del cierre de la Temporada 1 dentro de runReminders: a quién le llegan, que no se repitan, que respeten la baja
// de novedades y que nunca salgan dos correos el mismo día local.
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

// Recuperación forzada para una cuenta: la regla de un correo por día no debe depender de cuándo coincide en la base real.
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

const NOV16 = new Date("2026-11-16T13:00:00.000Z"); // lunes, 07:00 en Costa Rica
const NOV21 = new Date("2026-11-21T13:00:00.000Z"); // sábado, 07:00 en Costa Rica
const BETA = "2026-10-20T12:00:00.000Z"; // cuenta de la beta: sin plan, ya sin acceso el 16
const TRIAL = "2026-11-12T12:00:00.000Z"; // prueba de 7 días vigente el 16 (termina el 19)
const uid = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
const profile = (n: number, over: Row = {}): Row => ({ id: uid(n), onboarded: true, created_at: BETA, full_name: `Persona ${n}`, train_days: 6, equipment: "gym", timezone: "America/Costa_Rica", plan: "free", role: "free", ...over });
const sub = (n: number, over: Row = {}): Row => ({
  id: n, user_id: uid(n), status: "active", plan: "entreno", billing: "mes", cancel_at_period_end: false,
  current_period_start: "2026-11-08T15:00:00.000Z", current_period_end: "2026-12-08T15:00:00.000Z", created_at: "2026-10-25T14:58:00.000Z", ...over,
});
const promos = (...ns: number[]): Row[] => ns.map((n) => ({ user_id: uid(n), marketing: true }));
const seasonKinds = (n: number) => kinds(n).filter((k) => String(k).startsWith("temporada1_"));
const kinds = (n: number) => sent.filter((s) => s.to.startsWith(uid(n).slice(0, 8))).map((s) => s.kind);
const logOf = (n: number, kind: string) => (tables.notification_log ?? []).filter((r) => r.user_id === uid(n) && r.kind === kind);

beforeEach(() => {
  tables = {};
  failing = new Set();
  sent.length = 0;
  forcedRecovery = null;
});

describe("cierre de la Temporada 1 en runReminders", () => {
  it("16 de noviembre: llega a quien tiene plan o prueba activa, sin temporada y con novedades; reemplaza el resumen del lunes", async () => {
    tables.profiles = [profile(1, { plan: "entreno" }), profile(2, { created_at: TRIAL })];
    tables.subscriptions = [sub(1)];
    tables.notification_prefs = promos(1, 2);
    const stats = await runReminders(NOV16, "daily");
    expect(kinds(1)).toEqual(["temporada1_cierre_16"]);
    expect(kinds(2)).toEqual(["temporada1_cierre_16"]);
    expect(sent[0]).toMatchObject({ subject: "Elige tu Temporada 1", key: `temporada1_cierre_16/${uid(1)}` });
    expect(stats.sent).toMatchObject({ temporada1_cierre_16: 2 });
    expect(logOf(1, "temporada1_cierre_16")).toEqual([expect.objectContaining({ local_day: "2026-11-16", channels: ["email"] })]);
    // El resumen semanal y el recordatorio quedan sin correo ese día.
    expect((tables.notification_log ?? []).filter((r) => r.kind === "semanal" || r.kind === "recordatorio").every((r) => !(r.channels as string[]).includes("email"))).toBe(true);
  });

  it("no llega sin permiso de novedades, con baja, sin acceso, al staff ni a quien ya tiene una Temporada 1", async () => {
    tables.profiles = [
      profile(1, { plan: "entreno" }), profile(2, { plan: "entreno" }), profile(3), profile(4, { role: "admin" }),
      profile(5, { plan: "entreno" }), profile(6, { created_at: TRIAL }), profile(7, { plan: "completo" }), profile(8, { plan: "entreno" }),
      profile(9, { plan: "completo" }),
    ];
    tables.subscriptions = [sub(1), sub(2), sub(5), sub(7, { plan: "completo", billing: "anual", current_period_end: "2027-11-08T15:00:00.000Z" }), sub(8, { status: "canceled", current_period_end: "2026-11-10T15:00:00.000Z" }), sub(9, { plan: "completo" })];
    tables.notification_prefs = [
      { user_id: uid(1), marketing: false }, // baja de novedades
      ...promos(3, 4, 5, 6, 7, 8, 9),
    ]; // la cuenta 2 nunca activó novedades (apagadas por defecto)
    tables.challenge_entitlements = [
      { user_id: uid(5), challenge_slug: "temporada-running-1", source: "compra" },
      { user_id: uid(6), challenge_slug: "temporada-cross-1", source: "compra" },
      { user_id: uid(7), challenge_slug: "temporada-raquetas-1", source: "anual" },
      { user_id: uid(9), challenge_slug: "reto-30-dias", source: "compra" }, // otro reto: no cuenta como inscripción
    ];
    await runReminders(NOV16, "daily");
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) expect(kinds(n), `cuenta ${n}`).not.toContain("temporada1_cierre_16");
    expect(kinds(9)).toEqual(["temporada1_cierre_16"]);
  });

  it("21 de noviembre: no llega a quien se inscribió después del primer correo", async () => {
    tables.profiles = [profile(1, { plan: "entreno" }), profile(2, { plan: "entreno" })];
    tables.subscriptions = [sub(1), sub(2)];
    tables.notification_prefs = promos(1, 2);
    await runReminders(NOV16, "daily");
    tables.challenge_entitlements = [{ user_id: uid(1), challenge_slug: "temporada-running-1", source: "compra" }];
    await runReminders(NOV21, "daily");
    expect(seasonKinds(1)).toEqual(["temporada1_cierre_16"]);
    expect(seasonKinds(2)).toEqual(["temporada1_cierre_16", "temporada1_cierre_21"]);
    expect(sent.find((s) => s.kind === "temporada1_cierre_21")).toMatchObject({ subject: "La inscripción a Temporada 1 cierra mañana, 22 de noviembre", key: `temporada1_cierre_21/${uid(2)}` });
  });

  it("solo el 16 y el 21 en Costa Rica: nada antes, entre ellos ni el 22 (sin recuperar el del 21)", async () => {
    tables.profiles = [profile(1, { plan: "entreno" })];
    tables.subscriptions = [sub(1)];
    tables.notification_prefs = promos(1);
    for (const iso of ["2026-11-15T13:00:00.000Z", "2026-11-17T13:00:00.000Z", "2026-11-22T13:00:00.000Z", "2026-11-23T13:00:00.000Z"]) await runReminders(new Date(iso), "daily");
    expect(sent.filter((s) => String(s.kind).startsWith("temporada1_"))).toEqual([]);
  });

  it("una vez por cuenta y correo, aunque el cron corra otra vez ese día", async () => {
    tables.profiles = [profile(1, { plan: "entreno" })];
    tables.subscriptions = [sub(1)];
    tables.notification_prefs = promos(1);
    await runReminders(NOV16, "daily");
    await runReminders(new Date(NOV16.getTime() + 3600_000), "daily");
    await runReminders(new Date("2026-11-17T04:00:00.000Z"), "daily"); // 22:00 del 16 en Costa Rica
    expect(kinds(1)).toEqual(["temporada1_cierre_16"]);
    expect(logOf(1, "temporada1_cierre_16")).toHaveLength(1);
  });

  it("si hoy ya salió otro correo, se omite y queda anotada; si salió la pieza, ningún otro correo ese día", async () => {
    tables.profiles = [profile(1, { plan: "entreno" }), profile(2, { plan: "entreno" })];
    tables.subscriptions = [sub(1), sub(2)];
    tables.notification_prefs = promos(1, 2);
    tables.notification_log = [
      { user_id: uid(1), kind: "semanal", local_day: "2026-11-16", channels: ["inapp", "email"], pushes: 0 },
      { user_id: uid(2), kind: "temporada1_cierre_16", local_day: "2026-11-16", channels: ["email"], pushes: 0 },
    ];
    const stats = await runReminders(NOV16, "daily");
    expect(seasonKinds(1)).toEqual([]);
    expect(logOf(1, "temporada1_cierre_16")).toEqual([expect.objectContaining({ channels: [] })]);
    expect(stats.sent).toMatchObject({ temporada1_cierre_16_omitido: 1 });
    expect(kinds(2)).toEqual([]);
  });

  it("cede ante el aviso de cobro del mismo día local", async () => {
    tables.profiles = [profile(1, { created_at: TRIAL })];
    tables.notification_prefs = promos(1);
    tables.trial_charges = [{ user_id: uid(1), status: "scheduled", kind: "prueba", charge_at: "2026-11-19T12:00:00.000Z", reminder_sent_at: "2026-11-16T06:20:00.000Z" }];
    await runReminders(NOV16, "daily");
    expect(kinds(1)).not.toContain("temporada1_cierre_16");
    expect(logOf(1, "temporada1_cierre_16")).toEqual([expect.objectContaining({ channels: [] })]);
  });

  it("cede ante un correo de recuperación del mismo día local", async () => {
    tables.profiles = [profile(1, { plan: "entreno" })];
    tables.subscriptions = [sub(1)];
    tables.notification_prefs = promos(1);
    forcedRecovery = uid(1);
    await runReminders(NOV16, "daily");
    expect(kinds(1)).toEqual(["recuperacion_d8"]);
    expect(logOf(1, "temporada1_cierre_16")).toEqual([expect.objectContaining({ channels: [] })]);
  });

  it("si no se pueden leer las inscripciones, no se manda a nadie del lote", async () => {
    tables.profiles = [profile(1, { plan: "entreno" })];
    tables.subscriptions = [sub(1)];
    tables.notification_prefs = promos(1);
    failing.add("challenge_entitlements");
    await runReminders(NOV21, "daily");
    expect(kinds(1)).toEqual(["recordatorio"]);
  });

  it("en modo por hora, solo a la hora del recordatorio de la persona y con la fecha de Costa Rica", async () => {
    tables.profiles = [profile(1, { plan: "entreno" }), profile(2, { plan: "entreno", timezone: "Europe/Madrid" })];
    tables.subscriptions = [sub(1), sub(2)];
    tables.notification_prefs = [{ user_id: uid(1), marketing: true, reminder_time: "18:30" }, { user_id: uid(2), marketing: true, timezone: "Europe/Madrid" }];
    await runReminders(new Date("2026-11-21T13:00:00.000Z"), "hourly"); // 07:00 en Costa Rica, 14:00 en Madrid
    expect(kinds(1)).not.toContain("temporada1_cierre_21");
    await runReminders(new Date("2026-11-22T00:00:00.000Z"), "hourly"); // 18:00 del 21 en Costa Rica
    expect(kinds(1)).toEqual(["temporada1_cierre_21"]);
    // 07:00 del 21 en Madrid es la medianoche del 20 al 21 en Costa Rica: ya es 21 allá.
    await runReminders(new Date("2026-11-21T06:00:00.000Z"), "hourly");
    expect(kinds(2)).toEqual(["temporada1_cierre_21"]);
    // 07:00 del 22 en Madrid es todavía 21 en Costa Rica, pero ya salió: no se repite.
    await runReminders(new Date("2026-11-22T06:00:00.000Z"), "hourly");
    expect(kinds(2)).toEqual(["temporada1_cierre_21"]);
  });
});
