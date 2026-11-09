// Meta semanal (#288) dentro de runReminders: el recordatorio sale el día en que va atrás y todavía llega (correo y push),
// una sola vez por semana, respetando email_reminders y push_reminders, y ese día reemplaza al recordatorio de rutina.
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
let tables: Record<string, Row[]> = {};
const sent: { to: string; subject: string; html: string; text: string; key?: string; kind?: string }[] = [];

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
const pushes: { title: string; body: string; tag?: string }[] = [];

vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => db }));
vi.mock("@/lib/supabase/server", () => ({ STAFF: ["coach", "support", "admin", "superadmin"] }));
vi.mock("@/lib/push", () => ({ sendPush: async (_a: unknown, _d: unknown, p: { title: string; body: string; tag?: string }) => { pushes.push(p); return 1; } }));
vi.mock("@/lib/email/send", () => ({
  unsubscribeUrl: (u: string, s: string) => `https://bananaburn.app/api/email/baja?u=${u}&s=${s}`,
  sendEmail: async (to: string, msg: { subject: string; html: string; text: string }, o: { idempotencyKey?: string; tags?: { kind?: string } }) => {
    sent.push({ to, subject: msg.subject, html: msg.html, text: msg.text, key: o.idempotencyKey, kind: o.tags?.kind });
    return { ok: true };
  },
}));

const { runReminders } = await import("./notify-run");
const T = await import("@/lib/email/templates");
const { weeklyNudgeCopy } = await import("./meta-semanal");

// Cuenta de octubre (fuera de la prueba y de la beta), 3 días por semana (lunes, miércoles y viernes). El cron diario corre
// a las 13:00 UTC (07:00 en Costa Rica). Noviembre de 2026: jueves 12, viernes 13.
const uid = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
const profile = (n: number, over: Row = {}): Row => ({ id: uid(n), onboarded: true, created_at: "2026-10-01T12:00:00.000Z", full_name: `Persona ${n}`, train_days: 3, equipment: "gym", timezone: "America/Costa_Rica", plan: "entreno", role: "free", ...over });
const day = (iso: string) => new Date(`${iso}T13:00:00.000Z`);
const kinds = (n: number) => sent.filter((s) => s.to.startsWith(uid(n).slice(0, 8))).map((s) => s.kind);
const setup = (prefs: Row = {}, workouts = ["2026-11-04"]) => {
  tables.profiles = [profile(1)];
  tables.notification_prefs = [{ user_id: uid(1), quiet_start: null, quiet_end: null, ...prefs }];
  tables.workouts = workouts.map((d, i) => ({ id: i + 1, user_id: uid(1), day: d, finished_at: `${d}T20:00:00.000Z` }));
  tables.push_subscriptions = [{ user_id: uid(1), endpoint: "https://push.example/1", p256dh: "k", auth: "a" }];
};

beforeEach(() => {
  tables = {};
  sent.length = 0;
  pushes.length = 0;
});

describe("meta semanal en runReminders", () => {
  it("el jueves con 0 de 3: un correo y un push, y no se repite el viernes", async () => {
    setup();
    const s = await runReminders(day("2026-11-12"), "daily");
    expect(kinds(1)).toEqual(["meta_semanal"]);
    const mail = sent[0];
    expect(mail.subject).toBe("Todavía llegas a tu meta de la semana");
    expect(mail.text).toContain("Esta semana llevas 0 de 3 entrenos.");
    expect(mail.key).toBe(`meta_semanal/${uid(1)}/2026-11-09`);
    expect(pushes.map((p) => p.tag)).toEqual(["meta_semanal"]);
    expect(pushes[0].title).toBe("Todavía llegas a tu meta");
    expect(pushes[0].body).toMatch(/^Llevas 0 de 3 entrenos esta semana\./);
    expect(s.sent.meta_semanal).toBe(1);

    sent.length = 0; pushes.length = 0;
    await runReminders(day("2026-11-13"), "daily");
    // El viernes es día de entreno: sale el recordatorio de rutina, no otra vez la meta.
    expect(kinds(1)).toEqual(["recordatorio"]);
    expect(pushes.map((p) => p.tag)).toEqual(["recordatorio"]);
  });

  it("el día que sale reemplaza al recordatorio de rutina", async () => {
    setup({}, ["2026-11-04", "2026-11-09"]);
    await runReminders(day("2026-11-13"), "daily"); // viernes 1 de 3, día de entreno
    expect(kinds(1)).toEqual(["meta_semanal"]);
    expect(pushes.map((p) => p.tag)).toEqual(["meta_semanal"]);
  });

  it("respeta email_reminders y push_reminders", async () => {
    setup({ email_reminders: false });
    await runReminders(day("2026-11-12"), "daily");
    expect(kinds(1)).toEqual([]);
    expect(pushes.map((p) => p.tag)).toEqual(["meta_semanal"]);

    tables = {}; pushes.length = 0;
    setup({ push_reminders: false });
    await runReminders(day("2026-11-12"), "daily");
    expect(kinds(1)).toEqual(["meta_semanal"]);
    expect(pushes).toEqual([]);

    tables = {}; sent.length = 0;
    setup({ push_reminders: false, email_reminders: false });
    await runReminders(day("2026-11-12"), "daily");
    expect(kinds(1)).toEqual([]);
    expect((tables.notification_log ?? []).filter((r) => r.kind === "meta_semanal")).toEqual([]);
  });

  it("si no va atrasado o hoy ya entrenó, no sale", async () => {
    setup();
    await runReminders(day("2026-11-11"), "daily"); // miércoles 0 de 3: todavía no va atrás
    expect(kinds(1)).not.toContain("meta_semanal");
    tables = {}; sent.length = 0;
    setup({}, ["2026-11-04", "2026-11-12"]);
    await runReminders(day("2026-11-12"), "daily");
    expect(kinds(1)).not.toContain("meta_semanal");
  });
});

describe("copy del recordatorio", () => {
  it("coincide con docs/emails/meta-semanal.md", () => {
    const doc = readFileSync("docs/emails/meta-semanal.md", "utf8");
    const c = T.WEEKLY_GOAL_MAIL, x = c.text(0, 3, 12);
    for (const line of [c.subject, x.preheader, ...x.paragraphs, c.cta, c.path]) expect(doc, line).toContain(line);
    const push = weeklyNudgeCopy(0, 3, 12);
    expect(doc).toContain(push.title);
    expect(doc).toContain(push.body);
    const mail = T.metaSemanal({ count: 0, goal: 3, mins: 12, unsubscribe: "https://bananaburn.app/baja" });
    expect(mail.text).toContain("https://bananaburn.app/baja");
    expect(`${mail.subject} ${x.paragraphs.join(" ")}`).not.toMatch(/!|—/);
  });
});
