// #326: "Cancelas en 2 toques desde Mi plan. Si cancelas antes del día 8, no pagas nada." Esa promesa (anuncios, redes,
// marketing/plan-cobro-23-nov.md y /terminos) tiene que ser verdad exacta. Aquí se recorre con ONVO y Tilopay simulados,
// como el simulacro de #313: una cuenta en prueba con tarjeta (creada después de CARD_REQUIRED_FROM) cancela desde Mi plan,
// el cobro del día 8 deja de estar programado y el cron no cobra; un plan pagado cancela y no se renueva; los dos reciben
// su correo (es y en) con la fecha hasta la que tienen acceso y cómo volver.
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "./fake-db";
import type { CardRow, TrialChargeRow } from "./trial";

vi.mock("server-only", () => ({}));
type V = { demo: boolean; id: string; email: string; name: string; role: "free"; plan: string; onboarded: boolean; tz: string; country: string | null };
const state = vi.hoisted(() => ({ db: null as unknown, viewer: null as V | null }));
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => state.db }));
vi.mock("@/lib/supabase/server", () => ({ STAFF: ["admin", "superadmin"], createClient: async () => ({}), getViewer: async () => state.viewer }));
vi.mock("@/lib/security/db-rate-limit", async (orig) => ({ ...(await orig<object>()), dbRateLimit: async () => true, dbRateLimitAll: async () => true }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => {} }), headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {}, unstable_cache: (f: unknown) => f }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }), usePathname: () => "/app/suscripcion", useSearchParams: () => new URLSearchParams(), redirect: () => {} }));
vi.mock("@/components/analytics", () => ({ FunnelTracker: () => null, track: () => {} }));
const onvo = vi.hoisted(() => ({
  createChargedSubscription: vi.fn(), getPaymentMethod: vi.fn(), detachPaymentMethod: vi.fn(), cancelSubscription: vi.fn(),
  listCustomerSubscriptions: vi.fn(), getSubscription: vi.fn(), createCustomer: vi.fn(),
  createPaymentIntent: vi.fn(), confirmPaymentIntent: vi.fn(), getPaymentIntent: vi.fn(),
}));
vi.mock("@/lib/onvo", async (orig) => {
  const real = await orig<typeof import("./onvo")>();
  return { ...real, ...onvo, isOnvoConfigured: () => true, priceIdFor: (p: string, b: string) => `price_${p}_${b}` };
});
const tlp = vi.hoisted(() => ({ chargeSavedCard: vi.fn(), consultOrder: vi.fn(), removeCardToken: vi.fn(), createTokenizeUrl: vi.fn(), createPaymentUrl: vi.fn() }));
vi.mock("@/lib/tilopay", async (orig) => {
  const real = await orig<typeof import("./tilopay")>();
  return { ...real, ...tlp, isTilopayConfigured: () => true, tilopayOfferedTo: () => true };
});
const mail = vi.hoisted(() => ({
  notifyInApp: vi.fn(async () => true), sendChargeCanceled: vi.fn(async () => ({ ok: true })), sendChargeReminder: vi.fn(async () => ({ ok: true })),
  sendPaymentFailed: vi.fn(async () => ({ ok: true })), sendTrialStarted: vi.fn(async () => ({ ok: true })), sendPaymentReceipt: vi.fn(async () => ({ ok: true })),
  sendSubscriptionCanceled: vi.fn(async () => ({ ok: true })), sendCondoEndingEmail: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/email", () => mail);
vi.mock("@/lib/push", () => ({ sendPush: vi.fn(async () => 1), pushToUser: vi.fn(async () => 1) }));
vi.mock("@/lib/monitor/server", () => ({ recordServerError: vi.fn() }));

const { cardRequiredFor } = await import("./card-required");
const { entitlementsFrom } = await import("./entitlements");
const { DAY_MS } = await import("./trial");
const tb = await import("./trial-billing");
const T = await import("./email/templates");
const tarjetaRoute = await import("@/app/api/pagos/tarjeta/route");
const pruebaRoute = await import("@/app/api/pagos/prueba/route");
const cancelarRoute = await import("@/app/api/pagos/cancelar/route");
const { CardPanel } = await import("@/app/(app)/app/suscripcion/card-panel");
const { SubscriptionManager } = await import("@/app/(app)/app/suscripcion/manager");

const USER = "55555555-5555-4555-8555-555555555555";
/** 23 de noviembre de 2026 a las 00:01 de Costa Rica: ya con tarjeta obligatoria. */
const CREATED = "2026-11-23T06:01:00.000Z";
/** Día 8: el cron de cobros de las 00:20 de Costa Rica. */
const DAY8 = "2026-11-30T06:20:00.000Z";
const plus = (iso: string, days: number) => new Date(Date.parse(iso) + days * DAY_MS);
const ORIGIN = "https://bananaburn.app";
const headers = { "content-type": "application/json", origin: ORIGIN, host: "bananaburn.app" };
const post = (path: string, body: unknown) => new Request(`${ORIGIN}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
const clock = (iso: string | Date) => vi.setSystemTime(new Date(iso));

function setup(country: string | null = "CR") {
  const f = fakeDb({
    profiles: [{ id: USER, created_at: CREATED, plan: "free" }], users: [{ id: USER, email: "ana@prueba.test" }],
    billing_customers: [], subscriptions: [], trial_charges: [], payment_methods: [], payment_events: [], charge_keys: [],
    comp_grants: [], tester_grants: [], card_fingerprints: [], notification_prefs: [], push_subscriptions: [], condos: [], condo_members: [],
  }, { trial_charges: ["user_id", "idem_key"], payment_methods: ["provider_payment_method_id"], payment_events: ["event_key"], charge_keys: [{ cols: ["user_id", "periodo", "procesador"], where: (r) => r.estado === "reservado" }] });
  state.db = f.db;
  state.viewer = { demo: false, id: USER, email: "ana@prueba.test", name: "Ana", role: "free", plan: "free", onboarded: true, tz: "America/Costa_Rica", country };
  return f;
}
type F = ReturnType<typeof setup>;
const access = (f: F, now: Date) => entitlementsFrom({
  profilePlan: String(f.tables.profiles[0].plan), role: "free", createdAt: CREATED, now,
  subs: f.tables.subscriptions as never,
  trialCharge: (f.tables.trial_charges[0] as unknown as TrialChargeRow | undefined) ?? null,
  card: (f.tables.payment_methods[0] as unknown as CardRow | undefined) ?? null,
});
/** Mi plan con el cobro programado: lo que se ve antes del primer toque. */
const miPlan = (f: F) => {
  const ent = access(f, new Date());
  return renderToStaticMarkup(createElement(CardPanel, { step: ent.cardStep ?? "none", charge: ent.charge ?? null, card: ent.card ?? null, demo: false, payments: true, tz: "America/Costa_Rica", betaFirstPaid: "8 de noviembre", initial: { plan: "entreno", billing: "mes" } }));
};
const noCharges = () => {
  expect(onvo.createPaymentIntent).not.toHaveBeenCalled();
  expect(onvo.createChargedSubscription).not.toHaveBeenCalled();
  expect(tlp.chargeSavedCard).not.toHaveBeenCalled();
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  for (const m of [...Object.values(onvo), ...Object.values(mail), ...Object.values(tlp)]) m.mockReset();
  for (const m of Object.values(mail)) m.mockResolvedValue({ ok: true } as never);
  onvo.cancelSubscription.mockResolvedValue(null);
  onvo.detachPaymentMethod.mockResolvedValue(null);
  tlp.removeCardToken.mockResolvedValue(true);
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
  vi.stubEnv("TILOPAY_STATE_SECRET", "secreto-de-prueba");
  vi.stubEnv("NEXT_PUBLIC_ONVO_PUBLISHABLE_KEY", "onvo_test_publishable");
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("los toques desde Mi plan", () => {
  it("en la prueba con tarjeta: Cancelar mi plan abre la confirmación, sin pasos en medio", () => {
    const src = readFileSync("src/app/(app)/app/suscripcion/card-panel.tsx", "utf8");
    expect(src).toMatch(/onClick=\{\(\) => setView\("cancelar"\)\}[^>]*>Cancelar mi plan</);
    // La confirmación es la última pantalla: su botón cancela de una vez.
    expect(src).toMatch(/act\(\{ action: "cancelar", keepCard: !removeCard \}, "cancelado"\)/);
    expect(src).toContain("Si cancelas hoy no se te cobra nada.");
  });

  it("en un plan pagado: Cancelar mi plan va directo a la confirmación, sin ofertas que frenen ni un segundo ¿estás seguro?", () => {
    const src = readFileSync("src/app/(app)/app/suscripcion/manager.tsx", "utf8");
    expect(src).toMatch(/onClick=\{\(\) => setStep\("confirm"\)\}[^>]*>Cancelar mi plan</);
    expect(src).not.toMatch(/"offer"|Antes de irte|No, quiero cancelar/);
    expect(src).toMatch(/onClick=\{confirm\}/);

    const html = (status: "active" | "trialing") => renderToStaticMarkup(createElement(SubscriptionManager, {
      current: { plan: "completo", billing: "mes", status, endsAt: "2026-12-30T06:00:00.000Z", renewsAt: "2026-12-30T06:00:00.000Z", fromSubscription: true, cancellable: true },
      intent: null, payments: true, demo: false,
    }));
    const paid = html("active");
    expect(paid.match(/>Cancelar mi plan<\/button>/g)).toHaveLength(1);
    // Visible antes de la lista de planes, no al final de la página.
    expect(paid.indexOf("Cancelar mi plan")).toBeLessThan(paid.indexOf("Cambiar de plan"));
    expect(paid).toContain("Mantienes el acceso hasta el final del periodo que ya pagaste.");
    expect(html("trialing")).toContain("Si cancelas antes del cobro, no pagas nada.");
  });
});

describe("1. ONVO: prueba con tarjeta, cancelar antes del día 8", () => {
  it("borra el cobro programado, conserva el acceso hasta el fin de la prueba, manda el correo y el cron no cobra", async () => {
    const f = setup("CR");
    clock(plus(CREATED, 0.001));
    expect(cardRequiredFor(CREATED)).toBe(true);
    onvo.createCustomer.mockResolvedValue({ id: "cus_cr" });
    await tarjetaRoute.POST(post("/api/pagos/tarjeta", { action: "preparar" }));
    onvo.getPaymentMethod.mockResolvedValue({ id: "pm_cr", customerId: "cus_cr", status: "active", type: "card", card: { brand: "visa", last4: "4242", expMonth: 12, expYear: 2030 } });
    expect(await (await tarjetaRoute.POST(post("/api/pagos/tarjeta", { action: "guardar", paymentMethodId: "pm_cr", plan: "entreno", billing: "mes" }))).json()).toMatchObject({ ok: true, outcome: "programado" });
    const trialEnd = plus(CREATED, 7).toISOString();

    // Día 3, Mi plan: el cobro programado y el botón visible.
    clock(plus(CREATED, 3));
    const html = miPlan(f);
    expect(html).toContain("Se cobra el");
    expect(html.match(/>Cancelar mi plan<\/button>/g)).toHaveLength(1);

    // Toque 1 (Cancelar mi plan) abre la confirmación; la confirmación llama a esta ruta.
    const res = await pruebaRoute.POST(post("/api/pagos/prueba", { action: "cancelar", keepCard: false }));
    expect(await res.json()).toEqual({ ok: true, accessUntil: trialEnd, cardKept: false });
    expect(f.tables.trial_charges[0]).toMatchObject({ status: "canceled", next_attempt_at: null });
    expect(onvo.detachPaymentMethod).toHaveBeenCalledWith("pm_cr");
    expect(mail.sendChargeCanceled).toHaveBeenCalledOnce();
    expect((mail.sendChargeCanceled.mock.calls as unknown as [Record<string, unknown>][])[0][0]).toMatchObject({ userId: USER, accessUntil: trialEnd, cardKept: false });

    // Sigue con acceso hasta el fin de la prueba; Mi plan ya no muestra un cobro.
    expect(access(f, new Date())).toMatchObject({ access: "trial", locked: false });
    expect(access(f, new Date()).charge).toMatchObject({ phase: "cancelado" });
    expect(miPlan(f)).toContain("Cancelaste tu plan: no se te cobrará");

    // Día 8: el cron no cobra nada (ni dos corridas).
    clock(DAY8);
    await tb.sweepTrialCharges(new Date(), { skipReminders: true });
    await tb.sweepTrialCharges(new Date(), { skipReminders: true });
    noCharges();
    expect(f.tables.trial_charges[0]).toMatchObject({ status: "canceled", attempts: 0 });
    expect(f.tables.subscriptions).toEqual([]);
    expect(f.tables.profiles[0].plan).toBe("free");
  });
});

describe("2. Tilopay: prueba con tarjeta extranjera, cancelar y conservar la tarjeta", () => {
  it("con la tarjeta guardada el día 8 tampoco se cobra", async () => {
    const f = setup("CO");
    clock(plus(CREATED, 0.002));
    f.tables.payment_methods.push({ user_id: USER, provider: "tilopay", provider_payment_method_id: "tok_co", status: "active", brand: "visa", last4: "1111", exp_month: 12, exp_year: 2030 } as never);
    f.tables.trial_charges.push({ id: 7, user_id: USER, idem_key: `prueba:${USER}`, kind: "prueba", plan: "completo", billing: "mes", amount_minor: 749, promo: "primer_mes_50", trial_started_at: CREATED, trial_ends_at: plus(CREATED, 7).toISOString(), charge_at: plus(CREATED, 7).toISOString(), next_attempt_at: plus(CREATED, 7).toISOString(), status: "scheduled", attempts: 0, last_attempt_at: null, provider_subscription_id: null, last_error: null, reminder_sent_at: null, failure_notified_attempt: null, canceled_at: null, created_at: CREATED, updated_at: CREATED } as never);
    expect(access(f, new Date())).toMatchObject({ access: "trial", cardStep: "none" });
    expect(access(f, new Date()).charge).toMatchObject({ phase: "programado", amount: 7.49 });

    clock(plus(CREATED, 6.5));
    const res = await pruebaRoute.POST(post("/api/pagos/prueba", { action: "cancelar", keepCard: true }));
    expect(await res.json()).toMatchObject({ ok: true, cardKept: true });
    expect(tlp.removeCardToken).not.toHaveBeenCalled();
    expect(f.tables.payment_methods[0]).toMatchObject({ status: "active" });
    expect(f.tables.trial_charges[0]).toMatchObject({ status: "canceled", next_attempt_at: null });

    tlp.chargeSavedCard.mockResolvedValue({ state: "approved", auth: "a1", transactionId: "t1", description: null });
    clock(DAY8);
    await tb.sweepTrialCharges(new Date(), { skipReminders: true });
    noCharges();
    expect(access(f, new Date())).toMatchObject({ locked: true });
  });
});

describe("3. Plan pagado: cancelar no renueva y manda la confirmación", () => {
  it("ONVO y Tilopay: cancel_at_period_end, la fecha del fin del periodo y el correo con esa fecha", async () => {
    const f = setup("CR");
    clock(plus(CREATED, 10));
    const end = plus(CREATED, 37).toISOString();
    f.tables.subscriptions.push(
      { id: "s1", user_id: USER, provider: "onvo", provider_subscription_id: "sub_onvo_1", plan: "entreno", billing: "mes", status: "active", cancel_at_period_end: false, canceled_at: null, current_period_start: plus(CREATED, 7).toISOString(), current_period_end: end, created_at: plus(CREATED, 7).toISOString() } as never,
      { id: "s2", user_id: USER, provider: "tilopay", provider_subscription_id: "tlp:sub_2", plan: "entreno", billing: "mes", status: "active", cancel_at_period_end: false, canceled_at: null, current_period_start: plus(CREATED, 7).toISOString(), current_period_end: end, created_at: plus(CREATED, 7).toISOString() } as never,
    );
    const res = await cancelarRoute.POST(post("/api/pagos/cancelar", { reason: "No lo estoy usando" }));
    expect(await res.json()).toEqual({ ok: true, endsAt: end });
    expect(onvo.cancelSubscription).toHaveBeenCalledWith("sub_onvo_1");
    expect(f.tables.subscriptions.every((s) => s.cancel_at_period_end === true)).toBe(true);
    expect(mail.sendSubscriptionCanceled).toHaveBeenCalledTimes(2);
    for (const [arg] of mail.sendSubscriptionCanceled.mock.calls as unknown as [Record<string, unknown>][]) expect(arg).toMatchObject({ userId: USER, accessUntil: end });
    expect(access(f, new Date())).toMatchObject({ status: "canceling", endsAt: end, locked: false });
  });
});

describe("4. Correos de confirmación en es y en", () => {
  const SPANISH = /\b(tu|tus|de|del|que|para|con|los|las|el|prueba|correo|Recibes|plan de|Sigues|cobro)\b/i;
  const visible = (e: { subject: string; preheader: string; text: string; html: string }) => [e.subject, e.preheader, e.text.replace(/https?:\S+/g, ""), e.html.replace(/<[^>]+>/g, " ").replace(/https?:\S+/g, "")].join("\n");
  const until = "2026-11-30T06:01:00.000Z";

  it("en la prueba: no se cobra, hasta qué día tiene acceso y cómo volver", () => {
    const es = T.cobroCancelado({ name: "Ana", plan: "Entreno", accessUntil: until, cardKept: false });
    expect(es.text).toContain("No se hará ningún cargo.");
    expect(es.text).toContain("Sigues con acceso hasta el 30 de noviembre de 2026.");
    expect(es.text).toContain("Para volver, abre Mi plan y elige tu plan.");
    expect(es.text).toContain("/app/suscripcion");
    const en = T.cobroCancelado({ name: "Ana", plan: "Entreno", accessUntil: until, cardKept: true, locale: "en-US" });
    expect(en.html).toContain('<html lang="en">');
    expect(en.text).toContain("You keep access until November 30, 2026.");
    expect(en.text).toContain("Training");
    expect(en.text).toContain("To come back, open My plan");
    expect(visible(en)).not.toMatch(SPANISH);
  });

  it("en un plan pagado: hasta qué día tiene acceso, que no se renueva y cómo volver", () => {
    const es = T.suscripcionCancelada({ name: "Ana", plan: "Entreno + Nutrición", accessUntil: until });
    expect(es.text).toContain("Sigues con acceso hasta el 30 de noviembre de 2026. No se renueva.");
    expect(es.text).toContain("Para volver, abre Mi plan y elige tu plan.");
    const en = T.suscripcionCancelada({ name: "Ana", plan: "Entreno + Nutrición", accessUntil: until, locale: "en-US" });
    expect(en.text).toContain("You keep access until November 30, 2026. It won't renew.");
    expect(en.text).toContain("Training + Nutrition");
    expect(visible(en)).not.toMatch(SPANISH);
  });
});

describe("5. /terminos dice lo mismo que la app", () => {
  it("2 toques, Cancelar mi plan, sin cobro en la prueba y sin renovación en un plan pagado", () => {
    const src = readFileSync("src/app/(marketing)/terminos/page.tsx", "utf8");
    expect(src).toContain("Cancelas en 2 toques desde Mi plan: tocas Cancelar mi plan y confirmas. Si cancelas antes del cobro no se te cobra nada y sigues con acceso hasta el final de tu prueba.");
    expect(src).toContain("Sigues con acceso hasta el final del periodo ya pagado y no se renueva.");
  });
});
