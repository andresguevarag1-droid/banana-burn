// #296: cada pago que no se completa deja su motivo (payment_failed), la persona ve qué pasó en palabras simples y puede
// reintentar el mismo plan con un toque. Nunca se guardan datos de la tarjeta.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { renderToStaticMarkup } from "react-dom/server";
import { fakeDb } from "./fake-db";
import { FAIL_KINDS, FAIL_MESSAGE, PAYMENT_FAILED, canRetry, failKind, failNote, pendingReason, safeCode, tilopayReturnPath } from "./pago-fallo";

vi.mock("server-only", () => ({}));
const state: { db: SupabaseClient | null } = { db: null };
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => state.db }));
const tilo = vi.hoisted(() => ({ chargeSavedCard: vi.fn(), consultOrder: vi.fn(), createTokenizeUrl: vi.fn(), createPaymentUrl: vi.fn(), removeCardToken: vi.fn() }));
vi.mock("@/lib/tilopay", async (orig) => {
  const real = await orig<typeof import("./tilopay")>();
  return { ...real, ...tilo, isTilopayConfigured: () => true, tilopayOfferedTo: () => true };
});
vi.mock("@/lib/email", () => ({
  notifyInApp: vi.fn(async () => true), sendChargeCanceled: vi.fn(async () => ({ ok: true })), sendChargeReminder: vi.fn(async () => ({ ok: true })),
  sendPaymentFailed: vi.fn(async () => ({ ok: true })), sendTrialStarted: vi.fn(async () => ({ ok: true })), sendPaymentReceipt: vi.fn(async () => ({ ok: true })),
  sendSubscriptionCanceled: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/push", () => ({ pushToUser: vi.fn(async () => 1), sendPush: vi.fn(async () => 1) }));
vi.mock("@/lib/monitor/server", () => ({ recordServerError: vi.fn() }));
vi.mock("@/lib/meta-capi", () => ({ sendChargeSubscribe: vi.fn(async () => {}), sendCapi: vi.fn(async () => {}) }));

const { recordPaymentFailed } = await import("./pago-fallo-server");
const tlb = await import("./tilopay-billing");

const USER = "33333333-3333-4333-8333-333333333333";
const ORDER = "bbc-c5c579309c5bfc5b3b2832fd";
const SUB = `tlp:${ORDER}`;
const NOW = new Date("2026-11-07T20:00:00.000Z");
const viewer = { id: USER, email: "ana@prueba.test", name: "Ana Pérez", role: "user", demo: false, country: "MX" } as unknown as Parameters<typeof tlb.handleTilopayReturn>[0];
const st = { u: USER, p: "pago" as const, plan: "completo" as const, billing: "anual" as const, n: "n1", t: Math.floor(NOW.getTime() / 1000), o: ORDER };

function setup(createdAt = new Date(NOW.getTime() - 5 * 60_000).toISOString()) {
  const f = fakeDb({
    profiles: [{ id: USER, plan: "free", email: viewer.email }], users: [{ id: USER, email: viewer.email }],
    subscriptions: [{ id: 7, user_id: USER, provider: "tilopay", provider_customer_id: `tlp:${USER}`, provider_subscription_id: SUB, status: "incomplete", price_id: null, plan: "completo", billing: "anual", cancel_at_period_end: false, canceled_at: null, current_period_start: null, current_period_end: null, created_at: createdAt }],
    payment_events: [], payment_methods: [], trial_charges: [], charge_keys: [], billing_customers: [], comp_grants: [], tester_grants: [], notification_prefs: [], push_subscriptions: [],
  }, { payment_events: ["event_key"] });
  state.db = f.db;
  return f;
}
const failures = (f: ReturnType<typeof setup>) => f.tables.payment_events.filter((e) => e.type === PAYMENT_FAILED);

beforeEach(() => { for (const m of Object.values(tilo)) m.mockReset(); vi.spyOn(console, "warn").mockImplementation(() => {}); vi.spyOn(console, "info").mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

describe("mapeo de errores a mensajes", () => {
  it("rechazo del banco, 3D Secure, fondos, datos y conexión", () => {
    expect(failKind("issuer_declined")).toBe("rechazada");
    expect(failKind("gateway_declined")).toBe("rechazada");
    expect(failKind("2")).toBe("rechazada");
    expect(failKind("51")).toBe("rechazada");
    expect(failKind("insufficient_funds")).toBe("fondos");
    expect(failKind("2", "Fondos insuficientes")).toBe("fondos");
    expect(failKind("authentication_failed")).toBe("verificacion");
    expect(failKind("0", "3DS no completado")).toBe("verificacion");
    expect(failKind("abandono_3ds")).toBe("verificacion");
    expect(failKind("cards.invalid_card_info")).toBe("datos");
    expect(failKind("expired_card")).toBe("vencida");
    expect(failKind("processor_error")).toBe("conexion");
    expect(failKind("tilopay_502")).toBe("conexion");
    expect(failKind("abandono")).toBe("abandono");
    expect(failKind("sin_confirmar")).toBe("sin_confirmar");
    expect(failKind("algo_nuevo")).toBe("error");
    expect(failKind(null)).toBe("error");
  });

  it("los mensajes son simples, sin emojis ni guiones largos, y cubren cada clase", () => {
    expect(FAIL_MESSAGE.rechazada).toMatch(/^Tu banco no aprobó el cobro/);
    expect(FAIL_MESSAGE.verificacion).toMatch(/^No terminaste la verificación de tu banco/);
    for (const k of FAIL_KINDS) {
      expect(FAIL_MESSAGE[k].length).toBeGreaterThan(10);
      expect(FAIL_MESSAGE[k]).not.toMatch(/[—–!]|\p{Extended_Pictographic}/u);
    }
    // Sin confirmar no ofrece reintentar (podría cobrarse dos veces); lo demás sí.
    expect(canRetry("sin_confirmar")).toBe(false);
    expect(canRetry("rechazada")).toBe(true);
  });

  it("safeCode solo deja códigos cortos: nunca un número de tarjeta con espacios ni texto libre", () => {
    expect(safeCode(" Issuer_Declined ")).toBe("issuer_declined");
    expect(safeCode(51)).toBe("51");
    expect(safeCode("4111 1111 1111 1111")).toBeNull();
    expect(safeCode("Tu banco <b>dijo</b> que no")).toBeNull();
    expect(safeCode("x".repeat(41))).toBeNull();
    expect(safeCode({})).toBeNull();
  });

  it("nota y motivo para /admin/pagos", () => {
    expect(failNote("tilopay", "vuelta", "2")).toBe("Tilopay, al volver del banco: Banco rechazó (código 2)");
    expect(pendingReason({ status: "incomplete", created_at: NOW.toISOString() }, null, new Date(NOW.getTime() + 60_000))).toBe("Pago en curso");
    expect(pendingReason({ status: "incomplete", created_at: NOW.toISOString() }, null, new Date(NOW.getTime() + 3 * 3600_000))).toMatch(/no volvió del pago/);
    expect(pendingReason({ status: "incomplete", created_at: NOW.toISOString() }, "Tilopay, al confirmar: Banco rechazó (código 2)")).toMatch(/código 2/);
    expect(pendingReason({ status: "past_due" }, null)).toBeNull();
  });
});

describe("registro del fallo (payment_failed)", () => {
  it("guarda proveedor, etapa y código; una sola fila por suscripción y motivo", async () => {
    const f = setup();
    expect(await recordPaymentFailed(f.db, { userId: USER, provider: "tilopay", stage: "vuelta", code: "2", hint: "Denegada", subId: SUB, plan: "completo", billing: "anual" }, NOW)).toBe("rechazada");
    await recordPaymentFailed(f.db, { userId: USER, provider: "tilopay", stage: "vuelta", code: "2", subId: SUB }, NOW);
    const rows = failures(f);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ provider: "tilopay", user_id: USER, provider_subscription_id: SUB, status: "processed", payload: { provider: "tilopay", stage: "vuelta", code: "2", kind: "rechazada", plan: "completo", billing: "anual" } });
    // La descripción del procesador solo clasifica: nunca se guarda.
    expect(JSON.stringify(rows[0])).not.toContain("Denegada");
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/"code":"payment_failed".*"failCode":"2"/));
  });

  it("un código con datos raros queda como desconocido y sin base no lanza", async () => {
    const f = setup();
    await recordPaymentFailed(f.db, { userId: USER, provider: "onvo", stage: "tarjeta", code: "4111 1111 1111 1111" }, NOW);
    expect(JSON.stringify(f.tables.payment_events)).not.toContain("4111");
    expect(failures(f)[0].payload).toMatchObject({ code: "desconocido" });
    await expect(recordPaymentFailed(null, { userId: USER, provider: "onvo", stage: "checkout", code: "x" })).resolves.toBe("error");
    const broken = { from: () => { throw new Error("db caída"); } } as unknown as SupabaseClient;
    await expect(recordPaymentFailed(broken, { userId: USER, provider: "onvo", stage: "checkout", code: "x" })).resolves.toBe("error");
  });
});

describe("vuelta de Tilopay del plan anual (el caso del 7 nov)", () => {
  it("el banco dijo que no y la consulta no responde: rechazada con su motivo, no 'confirmando' para siempre", async () => {
    const f = setup();
    tilo.consultOrder.mockResolvedValue({ state: "unknown", why: "tilopay_400" });
    const r = await tlb.handleTilopayReturn(viewer, st, new URLSearchParams(`code=2&description=Transacci%C3%B3n%20denegada&order=${ORDER}`), NOW);
    expect(r).toEqual({ outcome: "rechazada", kind: "rechazada" });
    expect(failures(f)).toHaveLength(1);
    expect(failures(f)[0]).toMatchObject({ provider_subscription_id: SUB, payload: { stage: "vuelta", code: "2" } });
    // La fila sigue pendiente: si Tilopay luego la da por aprobada, el cron la activa.
    expect(f.tables.subscriptions[0].status).toBe("incomplete");
  });

  it("no terminó la verificación del banco: lo dice así", async () => {
    setup();
    tilo.consultOrder.mockResolvedValue({ state: "unknown", why: "sin_orden" });
    const r = await tlb.handleTilopayReturn(viewer, st, new URLSearchParams("code=0&description=Autenticacion%203DS%20fallida"), NOW);
    expect(r.kind).toBe("verificacion");
  });

  it("consulta rechazada: la suscripción vence y queda el código de Tilopay", async () => {
    const f = setup();
    tilo.consultOrder.mockResolvedValue({ state: "declined", code: "51" });
    const r = await tlb.handleTilopayReturn(viewer, st, new URLSearchParams(""), NOW);
    expect(r).toEqual({ outcome: "rechazada", kind: "rechazada" });
    expect(f.tables.subscriptions[0].status).toBe("expired");
    expect(failures(f)[0]).toMatchObject({ payload: { stage: "confirmacion", code: "51" } });
  });

  it("aprobada: activa el plan anual y no registra fallo", async () => {
    const f = setup();
    tilo.consultOrder.mockResolvedValue({ state: "approved", amountMinor: 8999, currency: "USD", token: null });
    const r = await tlb.handleTilopayReturn(viewer, st, new URLSearchParams("code=1"), NOW);
    expect(r.outcome).toBe("pago_ok");
    expect(f.tables.subscriptions[0].status).toBe("active");
    expect(failures(f)).toHaveLength(0);
  });

  it("sin respuesta y sin código: 'confirmando' con su motivo guardado, sin botón de reintentar", async () => {
    const f = setup();
    tilo.consultOrder.mockResolvedValue({ state: "unknown", why: "consult_failed" });
    const r = await tlb.handleTilopayReturn(viewer, st, new URLSearchParams(""), NOW);
    expect(r).toEqual({ outcome: "confirmando", kind: "sin_confirmar" });
    expect(failures(f)[0]).toMatchObject({ payload: { code: "sin_confirmar" } });
  });

  it("sin sesión al volver: la compra se confirma igual con el estado firmado", async () => {
    const f = setup();
    tilo.consultOrder.mockResolvedValue({ state: "approved", amountMinor: 8999, currency: "USD", token: null });
    expect(await tlb.handleTilopayReturnNoSession(st, new URLSearchParams("code=1"), NOW)).toMatchObject({ outcome: "pago_ok" });
    expect(f.tables.subscriptions[0].status).toBe("active");
    expect(await tlb.handleTilopayReturnNoSession({ ...st, p: "tarjeta" }, new URLSearchParams(""), NOW)).toBeNull();
  });

  it("cerró el navegador a mitad del pago: el cron consulta y, pasadas 2 horas, guarda 'abandono'", async () => {
    const f = setup(new Date(NOW.getTime() - 3 * 3600_000).toISOString());
    tilo.consultOrder.mockResolvedValue({ state: "unknown", why: "sin_orden" });
    const out = await tlb.sweepTilopayRenewals(NOW);
    expect(out?.checkouts).toBe(1);
    expect(failures(f)[0]).toMatchObject({ provider_subscription_id: SUB, payload: { stage: "confirmacion", code: "abandono", kind: "abandono" } });
    expect(f.tables.subscriptions[0].status).toBe("incomplete");
  });

  it("una compra de minutos antes del cron también se consulta en la corrida del día siguiente (ventana de 26 h)", async () => {
    setup(new Date(NOW.getTime() - 24.5 * 3600_000).toISOString());
    tilo.consultOrder.mockResolvedValue({ state: "unknown", why: "sin_orden" });
    expect((await tlb.sweepTilopayRenewals(NOW))?.checkouts).toBe(1);
  });
});

describe("reintento", () => {
  it("la vuelta lleva el motivo, si era pago o tarjeta, y el mismo plan y periodo", () => {
    const p = tilopayReturnPath("rechazada", st, "rechazada");
    const q = new URL(p, "https://x.test").searchParams;
    expect(Object.fromEntries(q)).toEqual({ tilopay: "rechazada", motivo: "rechazada", para: "pago", plan: "completo", pago: "anual" });
    expect(p.endsWith("#tarjeta")).toBe(true);
    // Al completarse, solo el resultado.
    expect(tilopayReturnPath("pago_ok", st)).toBe("/app/suscripcion?tilopay=pago_ok#tarjeta");
  });

  it("Mi plan: el motivo en palabras simples y el botón para reintentar; sin confirmar no ofrece reintentar", async () => {
    const { TilopayNotice } = await import("@/app/(app)/app/suscripcion/tilopay-notice");
    const bad = { ok: false, text: "genérico" };
    const html = renderToStaticMarkup(<TilopayNotice notice={bad} motivo="verificacion" para="pago" plan="completo" pago="anual" demo={false} />);
    expect(html).toContain("No terminaste la verificación de tu banco");
    expect(html).toContain("Intentar de nuevo");
    expect(html).not.toContain("genérico");
    const waiting = renderToStaticMarkup(<TilopayNotice notice={{ ok: true, text: "Estamos confirmando" }} motivo="sin_confirmar" para="pago" plan="completo" pago="anual" demo={false} />);
    expect(waiting).toContain("No vuelvas a pagar");
    expect(waiting).not.toContain("pago-reintentar");
    expect(waiting).toContain("Ver si ya se confirmó");
    // Motivo inventado en la URL: se ignora y queda el texto de siempre.
    expect(renderToStaticMarkup(<TilopayNotice notice={bad} motivo="<script>" para="tarjeta" demo={false} />)).toContain("genérico");
  });

  it("el botón Intentar de nuevo abre otra vez el pago del mismo plan con Tilopay", async () => {
    const { RetryPay } = await import("@/components/pagos/retry-pay");
    expect(renderToStaticMarkup(<RetryPay plan="completo" billing="anual" provider="tilopay" />)).toContain("Intentar de nuevo");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, url: "https://app.tilopay.com/pago" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });
    // El hook fuera de React: se prueba el pedido que hace al tocar (mismo plan, periodo y procesador).
    vi.resetModules();
    vi.doMock("react", async () => ({ ...(await vi.importActual<typeof import("react")>("react")), useState: (v: unknown) => [v, () => {}] }));
    const { useCheckout } = await import("@/components/pagos/use-checkout");
    vi.doUnmock("react");
    await useCheckout().start("completo", "anual", "tilopay");
    expect(JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toEqual({ plan: "completo", billing: "anual", provider: "tilopay" });
    expect(assign).toHaveBeenCalledWith("https://app.tilopay.com/pago");
    vi.unstubAllGlobals();
  });
});
