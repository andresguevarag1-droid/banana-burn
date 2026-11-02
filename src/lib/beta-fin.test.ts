import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/email/send", () => ({
  sendEmail: vi.fn(async () => ({ ok: true })),
  unsubscribeUrl: (id: string, scope: string) => `https://www.bananaburn.app/api/email/baja?u=${id}&s=${scope}`,
}));

import { sendEmail } from "@/lib/email/send";
import { BETA_END_PUSH, finBeta } from "@/lib/email/templates";
import { withLoginLinks } from "@/lib/email/login-link";
import { sendBetaEndEmails, type RunStats } from "./notify-run";
import { betaEndDay, betaEndEligible, betaEndIdemKey, betaEndStep } from "./beta-fin";
import { BETA_ENDS_AT, BETA_GRACE_UNTIL, PLANS } from "./plans";
import { SITE_URL } from "./env";

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

  it("el paso 1 (ya enviado el 1 nov) no cambia", () => {
    expect(all[0].subject).toBe("Terminó la beta: sigues con todo incluido hasta el 7 de noviembre");
  });
  it("paso 1: botón a /app/suscripcion, anual antes que mensual, precios de plans.ts y enlace de baja", () => {
    for (const e of all.slice(0, 1)) {
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

describe("pasos 2 y 3: primero el entreno (docs/emails/activacion.md, B2 y B3)", () => {
  const base = { name: "Ana López", promo: true, unsubscribe: "https://www.bananaburn.app/api/email/baja?token=x" };
  const b2 = finBeta({ ...base, step: 2 }), b3 = finBeta({ ...base, step: 3 });

  it("asunto y preheader del documento", () => {
    expect(b2.subject).toBe("Antes de elegir plan, prueba tu entreno");
    expect(b2.preheader).toBe("Empieza con 12 minutos en casa. Después decides cómo seguir.");
    expect(b3.subject).toBe("Hoy empieza por tu primer entreno");
    expect(b3.preheader).toBe("Haz tus 12 minutos antes de decidir cómo seguir.");
  });
  it("un solo botón, al entreno, y sin enlace a pagar", () => {
    for (const e of [b2, b3]) {
      expect(e.html).toContain("Hacer mi primer entreno");
      expect(e.html).toContain(`href="${SITE_URL}/app/entreno"`);
      expect(e.text).toContain(`Hacer mi primer entreno: ${SITE_URL}/app/entreno\n`);
      expect(e.html + e.text).not.toContain("/app/suscripcion");
      expect(e.html).not.toContain("Elegir mi plan");
      expect(e.html).toContain(base.unsubscribe);
    }
  });
  it("sin entrenos y con gym o mixto, el botón abre el primer entreno en casa", () => {
    for (const step of [2, 3] as const) {
      const e = finBeta({ ...base, step, home: true });
      expect(e.html).toContain(`href="${SITE_URL}/app/entreno?casa=1"`);
      expect(e.text).toContain(`Hacer mi primer entreno: ${SITE_URL}/app/entreno?casa=1`);
    }
  });
  it("el enlace de un toque conserva ?casa=1 como destino", () => {
    const e = withLoginLinks(finBeta({ ...base, step: 2, home: true }), "11111111-1111-4111-8111-111111111111", { secret: "s", now: Date.parse("2026-11-05T13:00:00Z") });
    expect(e.html).toContain(`next=${encodeURIComponent("/app/entreno?casa=1")}`);
    expect(e.text).toContain(`next=${encodeURIComponent("/app/entreno?casa=1")}`);
  });
  it("las fechas salen de BETA_GRACE_UNTIL", () => {
    expect(b2.text).toContain("sigue hasta el final del 7 de noviembre, hora de Costa Rica");
    expect(b2.text).toContain("el primer cobro será el 8 de noviembre");
    expect(b3.text).toContain("termina hoy, 7 de noviembre, a la medianoche de Costa Rica");
    expect(b3.text).toContain("el primer cobro será mañana, 8 de noviembre");
    const otra = finBeta({ ...base, step: 2, graceUntil: "2026-11-15T06:00:00.000Z" });
    expect(otra.text).toContain("hasta el final del 14 de noviembre");
    expect(otra.text).toContain("el primer cobro será el 15 de noviembre");
  });
  it("el 50 % solo con promo", () => {
    for (const step of [2, 3] as const) {
      expect(nb(finBeta({ ...base, step }).text)).toContain("recibes 50 % de descuento solo en el primer mes del plan mensual");
      const sin = finBeta({ ...base, step, promo: false });
      expect(nb(sin.text + sin.html)).not.toMatch(/50 %|descuento/);
      expect(sin.text).toContain("puedes guardar tu tarjeta en Mi plan");
    }
  });
  it("push de una línea, 40 caracteres o menos", () => {
    expect(BETA_END_PUSH).toEqual({ 2: "Prueba tu entreno de 12 minutos", 3: "Hoy, tu primer entreno de 12 min" });
    for (const t of Object.values(BETA_END_PUSH)) expect(t.length).toBeLessThanOrEqual(40);
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

  it("pasos 2 y 3: ?casa=1 solo sin entrenos guardados y con gym o mixto", async () => {
    const db = world();
    db.profiles = [
      profile("gym-nuevo", { equipment: "gym" }),
      profile("mixto-nuevo", { equipment: "mixto" }),
      profile("casa-nuevo", { equipment: "casa" }),
      profile("gym-entreno", { equipment: "gym" }),
    ];
    db.workouts = [{ id: 1, user_id: "gym-entreno" }];
    await sendBetaEndEmails(fakeAdmin(db), at("2026-11-05T13:00:00Z"), "daily", stats());
    const html = (to: string) => vi.mocked(sendEmail).mock.calls.find((c) => c[0] === `${to}@correo.com`)![1].html;
    expect(html("gym-nuevo")).toContain("/app/entreno?casa=1");
    expect(html("mixto-nuevo")).toContain("/app/entreno?casa=1");
    for (const id of ["casa-nuevo", "gym-entreno"]) {
      expect(html(id)).toContain('/app/entreno"');
      expect(html(id)).not.toContain("casa=1");
    }
    expect(vi.mocked(sendEmail).mock.calls[0][1].subject).toBe("Antes de elegir plan, prueba tu entreno");
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
