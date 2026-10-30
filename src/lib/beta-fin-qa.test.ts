// QA de #109: casos del envío del fin de la beta que beta-fin.test.ts no cubre (lecturas fallidas, Resend caído,
// páginas de más de 200 cuentas, staff y cortesía vencida, la llamada desde runReminders y la unicidad en la base).
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/email/send", () => ({
  sendEmail: vi.fn(async () => ({ ok: true })),
  unsubscribeUrl: (id: string, scope: string) => `https://www.bananaburn.app/api/email/baja?u=${id}&s=${scope}`,
}));
const admin = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => admin.client }));

import { sendEmail } from "@/lib/email/send";
import { runReminders, sendBetaEndEmails, type RunStats } from "./notify-run";

type Row = Record<string, unknown>;
/** Base falsa como la de beta-fin.test.ts, con errores por tabla y registro de reclamos. */
function fakeAdmin(db: Record<string, Row[]>, fail: Record<string, boolean> = {}) {
  const log = (db.notification_log ??= []);
  return {
    from(table: string) {
      const filters: ((r: Row) => boolean)[] = [];
      const q = {
        select: () => q,
        eq: (c: string, v: unknown) => { filters.push((r) => r[c] === v); return q; },
        lt: (c: string, v: string) => { filters.push((r) => String(r[c]) < v); return q; },
        in: (c: string, vs: unknown[]) => { filters.push((r) => vs.includes(r[c])); return q; },
        order: () => q,
        range: async (a: number, b: number) =>
          fail[table] ? { data: null, error: { code: "57014" } } : { data: (db[table] ?? []).filter((r) => filters.every((f) => f(r))).slice(a, b + 1), error: null },
        upsert: (row: Row) => ({
          select: async () => {
            if (log.some((l) => l.user_id === row.user_id && l.kind === row.kind && l.local_day === row.local_day)) return { data: [], error: null };
            log.push(row);
            return { data: [{ id: log.length }], error: null };
          },
        }),
      };
      return q;
    },
    auth: { admin: { getUserById: async (id: string) => ({ data: { user: { email: `${id}@correo.com` } } }) } },
  } as unknown as SupabaseClient;
}

const profile = (id: string, extra: Row = {}) => ({ id, created_at: "2026-10-15T12:00:00Z", full_name: `Persona ${id}`, plan: "free", role: "free", timezone: "America/Costa_Rica", onboarded: true, ...extra });
const stats = (): RunStats => ({ ok: true, mode: "daily", scanned: 0, candidates: 0, sent: {}, push: 0, email: 0, errors: 0 });
const sentTo = () => vi.mocked(sendEmail).mock.calls.map((c) => c[0]);
const nov1 = new Date("2026-11-01T13:00:00Z");

describe("QA #109: envío del fin de la beta", () => {
  beforeEach(() => { vi.mocked(sendEmail).mockClear(); vi.mocked(sendEmail).mockImplementation(async () => ({ ok: true })); });

  for (const table of ["payment_methods", "trial_charges", "subscriptions", "comp_grants", "notification_prefs"]) {
    it(`si falla la lectura de ${table}, no escribe a nadie de esa página (quizá ya tiene tarjeta o plan)`, async () => {
      const st = stats();
      await sendBetaEndEmails(fakeAdmin({ profiles: [profile("a"), profile("b")] }, { [table]: true }), nov1, "daily", st);
      expect(sendEmail).not.toHaveBeenCalled();
      expect(st.ok).toBe(false);
      expect(st.errors).toBe(1);
    });
  }

  it("si falla la lectura de perfiles, no envía nada y lo cuenta como error", async () => {
    const st = stats();
    await sendBetaEndEmails(fakeAdmin({ profiles: [profile("a")] }, { profiles: true }), nov1, "daily", st);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(st).toMatchObject({ ok: false, errors: 1 });
  });

  it("recorre más de una página de 200 cuentas", async () => {
    const profiles = Array.from({ length: 450 }, (_, i) => profile(`u${String(i).padStart(3, "0")}`));
    const st = stats();
    await sendBetaEndEmails(fakeAdmin({ profiles }), nov1, "daily", st);
    expect(new Set(sentTo()).size).toBe(450);
    expect(st.email).toBe(450);
  });

  it("staff no recibe; una cortesía ya vencida sí (hoy no tiene plan)", async () => {
    const db = {
      profiles: [profile("staff", { role: "admin" }), profile("cortesia-vencida")],
      comp_grants: [{ user_id: "cortesia-vencida", plan: "completo", previous_plan: "free", starts_at: "2026-09-01T00:00:00Z", expires_at: "2026-10-01T00:00:00Z", revoked_at: null, created_at: "2026-09-01T00:00:00Z" }],
    };
    await sendBetaEndEmails(fakeAdmin(db), nov1, "daily", stats());
    expect(sentTo()).toEqual(["cortesia-vencida@correo.com"]);
  });

  it("si Resend falla, el reclamo queda y no se reintenta (riesgo conocido, igual que los recordatorios)", async () => {
    vi.mocked(sendEmail).mockImplementation(async () => ({ ok: false }));
    const db: Record<string, Row[]> = { profiles: [profile("a")] };
    const st = stats();
    await sendBetaEndEmails(fakeAdmin(db), nov1, "daily", st);
    expect(st.email).toBe(0);
    expect(db.notification_log).toHaveLength(1);
    await sendBetaEndEmails(fakeAdmin(db), new Date("2026-11-02T13:00:00Z"), "daily", stats());
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("el enlace de baja del correo es el de recordatorios, el mismo campo que filtra el envío", async () => {
    await sendBetaEndEmails(fakeAdmin({ profiles: [profile("a")] }), nov1, "daily", stats());
    const [, msg, opts] = vi.mocked(sendEmail).mock.calls[0];
    expect(opts?.unsubscribe).toContain("s=recordatorios");
    expect(msg.html).toContain("s=recordatorios");
  });

  it("la base garantiza la unicidad del reclamo (user_id, kind, local_day) que usa el upsert", () => {
    const sql = readFileSync("supabase/migrations/0006_notifications.sql", "utf8");
    expect(sql).toMatch(/create table if not exists public\.notification_log[\s\S]*?unique \(user_id, kind, local_day\)/);
  });
});

// La base falsa no tiene todo lo que pide el resto de runReminders (registra "chunk_failed"): aquí solo importa el fin de la beta.
describe("QA #109: dentro de runReminders", () => {
  beforeEach(() => vi.mocked(sendEmail).mockClear());

  it("el cron de recordatorios envía el correo del 1 de noviembre", async () => {
    admin.client = fakeAdmin({ profiles: [profile("a", { onboarded: true })] });
    const st = await runReminders(nov1, "daily");
    expect(vi.mocked(sendEmail).mock.calls.some((c) => c[2]?.idempotencyKey === "beta_fin_1/a")).toBe(true);
    expect(st.sent.beta_fin_1).toBe(1);
  });

  it("antes del 1 de noviembre el cron no envía nada del fin de la beta", async () => {
    admin.client = fakeAdmin({ profiles: [profile("a")] });
    const st = await runReminders(new Date("2026-10-31T13:00:00Z"), "daily");
    expect(vi.mocked(sendEmail).mock.calls.some((c) => String(c[2]?.idempotencyKey).startsWith("beta_fin"))).toBe(false);
    expect(st.sent.beta_fin_1).toBeUndefined();
  });

  it("si el fin de la beta revienta, el resto de los recordatorios sigue", async () => {
    const base = fakeAdmin({ profiles: [] });
    let calls = 0;
    admin.client = { ...base, from: (t: string) => { if (t === "profiles" && calls++ === 0) throw new Error("boom"); return base.from(t); } };
    const st = await runReminders(nov1, "daily");
    expect(st.errors).toBe(1);
    expect(calls).toBeGreaterThan(1);
  });
});
