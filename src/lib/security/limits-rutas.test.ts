// Cada ruta crítica responde 429 al pasar su regla de src/lib/security/limits.ts (login, registro, /auth/correo,
// /api/track, coach, webhook de pagos, /api/avisos/despachar y exportaciones del panel).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { RULES } from "./limits";

const net = { ip: "10.0.0.1" };
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-real-ip": net.ip }), cookies: async () => ({ getAll: () => [], get: () => undefined, set: () => {} }) }));
// La base deja pasar siempre: lo que frena es la regla (el freno en memoria cuenta igual que la base).
vi.mock("@/lib/supabase/admin", () => ({
  adminClient: () => ({
    rpc: async () => ({ data: true, error: null }),
    auth: { admin: { createUser: async () => ({ data: { user: null }, error: { message: "User already registered" } }) } },
  }),
}));
const viewer = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock("@/lib/supabase/server", () => ({
  getViewer: async () => viewer.current,
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }), getClaims: async () => ({ data: null }) } }),
}));
vi.mock("@/lib/entitlements", () => ({ getEntitlements: async () => ({ app: true, nutrition: true }) }));
vi.mock("@/lib/athlete", () => ({ getAthlete: async () => ({ name: "Ana" }) }));
vi.mock("@/lib/admin-avisos-server", () => ({ dispatchAdminEvents: async () => ({ events: 0 }) }));
vi.mock("@/lib/billing", () => ({ processWebhook: async () => ({ status: "processed" }) }));
vi.mock("@/lib/attribution-server", () => ({ attributeNewAccount: async () => {} }));
vi.mock("@/lib/email", () => ({ sendWelcomeEmail: async () => {} }));
vi.mock("@/lib/admin-auth", () => ({ getAdminViewer: async () => ({ id: "staff-1", role: "superadmin", demo: false }) }));
vi.mock("@/lib/admin", () => ({ exportSubscriptions: async () => [] }));
vi.mock("@/lib/admin-csv", () => ({ subsCsv: () => "", subFiltersFrom: () => ({}) }));
vi.mock("@/lib/admin-affiliates", () => ({ loadAdminAffiliates: async () => ({}), payoutsCsv: () => "" }));

let n = 0;
beforeEach(() => { net.ip = `10.${++n}.0.${Math.floor(Math.random() * 250)}`; viewer.current = null; vi.spyOn(console, "warn").mockImplementation(() => {}); vi.spyOn(console, "info").mockImplementation(() => {}); });

/** Máximo de la ventana más corta: la cantidad de intentos que pasan antes del primer 429. */
const first = (name: keyof typeof RULES) => Math.min(...RULES[name].windows.map((w) => w.max));
const req = (url: string, init: RequestInit = {}) => new Request(`http://localhost${url}`, { ...init, headers: { "x-real-ip": net.ip, ...init.headers } });

/** Llama `max` veces (todas deben pasar el límite) y una más, que debe ser 429 con Retry-After. */
async function hitsLimit(max: number, call: () => Promise<Response>) {
  for (let i = 0; i < max; i++) expect((await call()).status, `intento ${i + 1}`).not.toBe(429);
  const r = await call();
  expect(r.status).toBe(429);
  expect(Number(r.headers.get("retry-after"))).toBeGreaterThan(0);
  expect(r.headers.get("cache-control")).toBe("no-store");
  return r;
}

describe("429 al pasar el límite de cada ruta crítica", () => {
  it("/api/track", async () => {
    const { POST } = await import("@/app/api/track/route");
    await hitsLimit(first("track"), () => POST(req("/api/track", { method: "POST", body: "" })));
  });

  it("/api/avisos/despachar (un contador para todas las llamadas)", async () => {
    const { POST } = await import("@/app/api/avisos/despachar/route");
    await hitsLimit(first("avisos:despachar"), () => POST());
  });

  it("/api/pagos/webhook: tope holgado por IP del procesador, que reintenta un 429", async () => {
    process.env.ONVO_WEBHOOK_SECRET = "secreto-de-prueba";
    const { POST } = await import("@/app/api/pagos/webhook/route");
    expect(first("pagos:webhook")).toBeGreaterThanOrEqual(300);
    const body = JSON.stringify({ type: "payment-intent.succeeded", data: { id: "pi_1" } });
    await hitsLimit(first("pagos:webhook"), () => POST(req("/api/pagos/webhook", { method: "POST", body, headers: { "x-webhook-secret": "secreto-de-prueba" } })));
    // Otra IP (u otro minuto) sigue entrando: el límite no apaga los webhooks.
    net.ip = "10.250.0.1";
    expect((await POST(req("/api/pagos/webhook", { method: "POST", body, headers: { "x-webhook-secret": "secreto-de-prueba" } }))).status).not.toBe(429);
    delete process.env.ONVO_WEBHOOK_SECRET;
  });

  it("/api/coach", async () => {
    viewer.current = { id: "demo", demo: true, country: "CR", role: "free" };
    const { POST } = await import("@/app/api/coach/route");
    const call = () => POST(req("/api/coach", { method: "POST", body: JSON.stringify({ messages: [{ role: "user", content: "hola" }] }), headers: { "content-type": "application/json" } }));
    await hitsLimit(first("coach:chat"), call);
  });

  it("/auth/correo (ver el botón y gastar el enlace)", async () => {
    const { GET, POST } = await import("@/app/auth/correo/route");
    await hitsLimit(first("auth:correo:ver"), () => GET(new NextRequest(req("/auth/correo?t=x"))));
    await hitsLimit(first("auth:correo:entrar"), () => POST(new NextRequest(req("/auth/correo", { method: "POST", body: new URLSearchParams({ t: "x" }) }))));
  });

  it("/admin/pagos/exportar y /admin/referidores/pagos.csv (acciones masivas del panel)", async () => {
    const pagos = await import("@/app/admin/pagos/exportar/route");
    const ref = await import("@/app/admin/referidores/pagos.csv/route");
    // Las dos cuentan en la misma regla de la persona del staff.
    const max = first("admin:masivo");
    for (let i = 0; i < max - 1; i++) expect((await pagos.GET(new NextRequest(req("/admin/pagos/exportar")))).status).not.toBe(429);
    await hitsLimit(1, () => ref.GET());
  });
});

describe("login y registro (server actions): el mismo límite, con el mensaje en vez del 429", () => {
  const TOO_MANY = "Demasiados intentos. Espera unos minutos e intenta de nuevo.";

  it("registro: por correo y por red", async () => {
    const { signUpConfirmed } = await import("@/app/(auth)/entrar/actions");
    for (let i = 0; i < first("auth:registro:correo"); i++) expect(await signUpConfirmed("ana@ejemplo.com", "Banana2026x")).not.toMatchObject({ error: TOO_MANY });
    expect(await signUpConfirmed("ana@ejemplo.com", "Banana2026x")).toEqual({ ok: false, error: TOO_MANY });
    net.ip = "10.251.0.1";
    for (let i = 0; i < first("auth:registro:ip"); i++) expect(await signUpConfirmed(`p${i}@ejemplo.com`, "Banana2026x")).not.toMatchObject({ error: TOO_MANY });
    expect(await signUpConfirmed("otra@ejemplo.com", "Banana2026x")).toEqual({ ok: false, error: TOO_MANY });
  });

  it("entrar: por correo y por red", async () => {
    const { confirmAndCheck } = await import("@/app/(auth)/entrar/actions");
    for (let i = 0; i < first("auth:entrar:correo"); i++) expect(await confirmAndCheck("bea@ejemplo.com", "clave")).not.toMatchObject({ error: TOO_MANY });
    expect(await confirmAndCheck("bea@ejemplo.com", "clave")).toEqual({ ok: false, error: TOO_MANY });
    net.ip = "10.252.0.1";
    for (let i = 0; i < first("auth:entrar:ip"); i++) expect(await confirmAndCheck(`q${i}@ejemplo.com`, "clave")).not.toMatchObject({ error: TOO_MANY });
    expect(await confirmAndCheck("otra@ejemplo.com", "clave")).toEqual({ ok: false, error: TOO_MANY });
  });
});
