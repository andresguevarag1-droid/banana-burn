import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/email/send", () => ({
  sendEmail: vi.fn(async () => ({ ok: true })),
  unsubscribeUrl: (id: string, scope: string) => `https://www.bananaburn.app/api/email/baja?u=${id}&s=${scope}`,
}));

import { sendEmail } from "@/lib/email/send";
import { finBeta } from "@/lib/email/templates";
import { sendBetaEndEmails, type RunStats } from "./notify-run";
import { betaEndDay, betaEndEligible, betaEndIdemKey, betaEndStep } from "./beta-fin";
import { BETA_ENDS_AT, BETA_GRACE_UNTIL, PLANS } from "./plans";

const at = (iso: string) => new Date(iso);
const nb = (s: string) => s.replace(/\u00a0/g, " ");

describe("qué correo toca (hora de Costa Rica)", () => {
  it("las fechas de plans.ts son las del issue", () => {
    expect(BETA_ENDS_AT).toBe("2026-11-01T06:00:00.000Z");
    expect(BETA_GRACE_UNTIL).toBe("2026-11-08T06:00:00.000Z");
  });
  it("nada antes del fin de la beta ni después del 7 de noviembre", () => {
    expect(betaEndStep(at("2026-10-31T13:00:00Z"))).toBeNull();
    expect(betaEndStep(at("2026-11-01T05:59:59Z"))).toBeNull();
    expect(betaEndStep(at("2026-11-08T06:00:00Z"))).toBeNull();
    expect(betaEndStep(at("2026-11-20T13:00:00Z"))).toBeNull();
  });
  it("1 de noviembre (y hasta el 4 si el cron se atrasa), 5 y 6, y 7", () => {
    expect(betaEndStep(at("2026-11-01T13:00:00Z"))).toBe(1);
    expect(betaEndStep(at("2026-11-04T13:00:00Z"))).toBe(1);
    expect(betaEndStep(at("2026-11-05T13:00:00Z"))).toBe(2);
    expect(betaEndStep(at("2026-11-06T13:00:00Z"))).toBe(2);
    expect(betaEndStep(at("2026-11-07T13:00:00Z"))).toBe(3);
    expect(betaEndStep(at("2026-11-08T05:59:59Z"))).toBe(3);
  });
  it("cada correo se reclama con el día de Costa Rica que le toca", () => {
    expect([betaEndDay(1), betaEndDay(2), betaEndDay(3)]).toEqual(["2026-11-01", "2026-11-05", "2026-11-07"]);
    expect(betaEndIdemKey(2, "u1")).toBe("beta_fin_2/u1");
  });
});

describe("a quién le llega", () => {
  const ok = { createdAt: "2026-10-20T12:00:00Z", emailReminders: true, hasCard: false, hasCharge: false, paidAccess: false };
  it("cuenta de la beta sin tarjeta ni plan: sí", () => expect(betaEndEligible(ok)).toBe(true));
  it("con tarjeta, con cobro programado, con plan pago o dada de baja: no", () => {
    expect(betaEndEligible({ ...ok, hasCard: true })).toBe(false);
    expect(betaEndEligible({ ...ok, hasCharge: true })).toBe(false);
    expect(betaEndEligible({ ...ok, paidAccess: true })).toBe(false);
    expect(betaEndEligible({ ...ok, emailReminders: false })).toBe(false);
  });
  it("cuenta nueva (desde el lanzamiento) o sin fecha de alta: no", () => {
    expect(betaEndEligible({ ...ok, createdAt: BETA_ENDS_AT })).toBe(false);
    expect(betaEndEligible({ ...ok, createdAt: "2026-11-02T12:00:00Z" })).toBe(false);
    expect(betaEndEligible({ ...ok, createdAt: null })).toBe(false);
  });
});

describe("plantillas", () => {
  const base = { name: "Ana López", promo: true, unsubscribe: "https://www.bananaburn.app/api/email/baja?token=x" };
  const all = ([1, 2, 3] as const).map((step) => finBeta({ ...base, step }));

  it("cada una dice lo suyo con la fecha real", () => {
    expect(all[0].subject).toBe("Terminó la beta: sigues con todo incluido hasta el 7 de noviembre");
    expect(all[1].subject).toBe("Ana, lo que conservas si eliges tu plan");
    expect(all[1].text).toMatch(/Tu progreso/);
    expect(all[1].text).toMatch(/Tu plan/);
    expect(all[1].text).toMatch(/Tu racha/);
    expect(all[2].subject).toBe("Hoy es tu último día con todo incluido");
    expect(all[2].text).toContain("termina hoy, 7 de noviembre");
  });
  it("botón a /app/suscripcion, anual antes que mensual, precios de plans.ts y enlace de baja", () => {
    for (const e of all) {
      expect(e.html).toContain("/app/suscripcion");
      expect(e.html).toContain("Elegir mi plan");
      expect(e.html.indexOf("Plan anual")).toBeLessThan(e.html.indexOf("Plan mensual"));
      expect(e.text.indexOf("Plan anual")).toBeLessThan(e.text.indexOf("Plan mensual"));
      for (const pl of PLANS) expect(e.text).toContain(`$${pl.price.anual}`);
      expect(e.text).toContain("$59.89 o $89.89 al año");
      expect(e.html).toContain(base.unsubscribe);
      expect(e.text).toContain("el primer cobro es el 8 de noviembre");
    }
  });
  it("el 50 % del primer mes solo si se le ofrece", () => {
    expect(nb(all[0].text)).toContain("tu primer mes cuesta 50 % menos");
    expect(all[0].text).toContain("primer mes $4.99");
    expect(all[0].text).toContain("primer mes $7.49");
    const sin = finBeta({ ...base, promo: false, step: 1 });
    expect(nb(sin.text + sin.html)).not.toMatch(/50 %|primer mes \$/);
  });
  it("marca: sin emojis, sin IA, sin urgencias inventadas", () => {
    for (const e of all) {
      expect(e.text + e.html).not.toMatch(/\bIA\b|inteligencia artificial|[\u{1F300}-\u{1FAFF}]|últimos cupos|quedan pocos|!!/u);
      expect(e.html).toContain("#FFF8E3");
      expect(e.html).toContain("Plus Jakarta Sans");
    }
  });
});

// ───────────── Envío dentro del cron (base de datos falsa) ─────────────

type Row = Record<string, unknown>;
function fakeAdmin(db: Record<string, Row[]>) {
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
        range: async (a: number, b: number) => ({ data: (db[table] ?? []).filter((r) => filters.every((f) => f(r))).slice(a, b + 1), error: null }),
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

const beta = "2026-10-15T12:00:00Z";
const profile = (id: string, extra: Row = {}) => ({ id, created_at: beta, full_name: `Persona ${id}`, plan: "free", role: "free", timezone: "America/Costa_Rica", onboarded: true, ...extra });
const stats = (): RunStats => ({ ok: true, mode: "daily", scanned: 0, candidates: 0, sent: {}, push: 0, email: 0, errors: 0 });
const sentTo = () => vi.mocked(sendEmail).mock.calls.map((c) => c[0]);

function world(): Record<string, Row[]> {
  return {
    profiles: [
      profile("sin-tarjeta"),
      profile("pago-antes"),
      profile("con-tarjeta"),
      profile("con-cobro"),
      profile("plan-pago"),
      profile("cortesia"),
      profile("baja"),
      profile("nueva", { created_at: "2026-11-02T12:00:00Z" }),
      profile("sin-onboarding", { onboarded: false }),
    ],
    notification_prefs: [{ user_id: "baja", email_reminders: false }],
    payment_methods: [{ user_id: "con-tarjeta" }],
    trial_charges: [{ user_id: "con-cobro" }],
    subscriptions: [
      { id: 1, user_id: "plan-pago", status: "active", plan: "entreno", billing: "mes", cancel_at_period_end: false, canceled_at: null, current_period_start: "2026-10-01T00:00:00Z", current_period_end: "2026-12-01T00:00:00Z", created_at: "2026-10-01T00:00:00Z" },
      { id: 2, user_id: "pago-antes", status: "canceled", plan: "entreno", billing: "mes", cancel_at_period_end: false, canceled_at: "2026-09-01T00:00:00Z", current_period_start: "2026-08-01T00:00:00Z", current_period_end: "2026-09-01T00:00:00Z", created_at: "2026-08-01T00:00:00Z" },
    ],
    comp_grants: [{ user_id: "cortesia", plan: "completo", previous_plan: "free", starts_at: "2026-10-01T00:00:00Z", expires_at: "2026-12-01T00:00:00Z", revoked_at: null, created_at: "2026-10-01T00:00:00Z" }],
  };
}

describe("envío en runReminders", () => {
  beforeEach(() => vi.mocked(sendEmail).mockClear());

  it("solo a cuentas de la beta sin tarjeta, sin cobro, sin plan y sin baja", async () => {
    const st = stats();
    await sendBetaEndEmails(fakeAdmin(world()), at("2026-11-01T13:00:00Z"), "daily", st);
    expect(sentTo().sort()).toEqual(["pago-antes@correo.com", "sin-tarjeta@correo.com"]);
    expect(st.sent).toEqual({ beta_fin_1: 2 });
    expect(st.email).toBe(2);
    const [, msg, opts] = vi.mocked(sendEmail).mock.calls.find((c) => c[0] === "sin-tarjeta@correo.com")!;
    expect(opts).toMatchObject({ idempotencyKey: "beta_fin_1/sin-tarjeta", tags: { kind: "beta_fin_1" } });
    expect(opts?.unsubscribe).toContain("s=recordatorios");
    expect(msg.subject).toContain("Terminó la beta");
  });

  it("el 50 % solo a quien nunca pagó un plan (como promoFor al guardar la tarjeta)", async () => {
    await sendBetaEndEmails(fakeAdmin(world()), at("2026-11-01T13:00:00Z"), "daily", stats());
    const text = (to: string) => nb(vi.mocked(sendEmail).mock.calls.find((c) => c[0] === to)![1].text);
    expect(text("sin-tarjeta@correo.com")).toContain("50 % menos");
    expect(text("pago-antes@correo.com")).not.toContain("50 %");
  });

  it("nunca dos veces: otra corrida el mismo día o días después no repite el correo", async () => {
    const db = world();
    const admin = fakeAdmin(db);
    await sendBetaEndEmails(admin, at("2026-11-01T13:00:00Z"), "daily", stats());
    await sendBetaEndEmails(admin, at("2026-11-01T14:00:00Z"), "daily", stats());
    await sendBetaEndEmails(admin, at("2026-11-03T13:00:00Z"), "daily", stats());
    expect(sentTo().filter((t) => t === "sin-tarjeta@correo.com")).toHaveLength(1);
    // El siguiente correo sí sale, una vez.
    await sendBetaEndEmails(admin, at("2026-11-05T13:00:00Z"), "daily", stats());
    await sendBetaEndEmails(admin, at("2026-11-06T13:00:00Z"), "daily", stats());
    await sendBetaEndEmails(admin, at("2026-11-07T13:00:00Z"), "daily", stats());
    await sendBetaEndEmails(admin, at("2026-11-07T20:00:00Z"), "daily", stats());
    const keys = vi.mocked(sendEmail).mock.calls.filter((c) => c[0] === "sin-tarjeta@correo.com").map((c) => c[2]?.idempotencyKey);
    expect(keys).toEqual(["beta_fin_1/sin-tarjeta", "beta_fin_2/sin-tarjeta", "beta_fin_3/sin-tarjeta"]);
    expect(db.notification_log.filter((l) => l.user_id === "sin-tarjeta").map((l) => [l.kind, l.local_day])).toEqual([
      ["beta_fin_1", "2026-11-01"], ["beta_fin_2", "2026-11-05"], ["beta_fin_3", "2026-11-07"],
    ]);
  });

  it("fuera de la semana del 1 al 7 de noviembre no hace nada", async () => {
    await sendBetaEndEmails(fakeAdmin(world()), at("2026-10-31T13:00:00Z"), "daily", stats());
    await sendBetaEndEmails(fakeAdmin(world()), at("2026-11-08T13:00:00Z"), "daily", stats());
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("cada hora: respeta las horas de silencio y sale en la corrida siguiente", async () => {
    const admin = fakeAdmin(world());
    await sendBetaEndEmails(admin, at("2026-11-01T07:00:00Z"), "hourly", stats()); // 1:00 a. m. en Costa Rica
    expect(sendEmail).not.toHaveBeenCalled();
    await sendBetaEndEmails(admin, at("2026-11-01T14:00:00Z"), "hourly", stats()); // 8:00 a. m.
    expect(sentTo()).toContain("sin-tarjeta@correo.com");
  });
});
