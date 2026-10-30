import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const viewer = vi.hoisted(() => ({ current: null as null | { id: string; demo: boolean; role: string } }));
const db = vi.hoisted(() => ({ ok: true }));
vi.mock("@/lib/supabase/server", () => ({ getViewer: async () => viewer.current, STAFF: ["coach", "support", "admin", "superadmin"] }));
vi.mock("@/lib/health-ping", () => ({ pingSupabase: async () => (db.ok ? { ok: true, ms: 12, via: "db" } : { ok: false, ms: null, via: null }) }));
vi.mock("@/lib/env", async (orig) => ({ ...(await orig<typeof import("@/lib/env")>()), isDemoMode: false }));

type Dep = "resend" | "onvo" | "tilopay";
/** Cómo responde cada proveedor en la prueba: "up", "down" (500), "llave" (401) o "red" (sin respuesta). */
let mode: Record<Dep, "up" | "down" | "llave" | "red">;
const calls: string[] = [];

function fakeFetch(input: RequestInfo | URL): Promise<Response> {
  const url = String(input);
  calls.push(url);
  const dep: Dep = url.startsWith("https://api.resend.com") ? "resend" : url.startsWith("https://api.onvopay.com") ? "onvo" : "tilopay";
  const m = mode[dep];
  if (m === "red") return Promise.reject(Object.assign(new Error("fetch failed"), { name: "TypeError" }));
  if (m === "down") return Promise.resolve(new Response("caído", { status: 500 }));
  if (m === "llave") return Promise.resolve(Response.json({ name: "validation_error", message: "API key is invalid" }, { status: 401 }));
  if (dep === "resend") return Promise.resolve(Response.json({ data: [] }));
  if (dep === "onvo") return Promise.resolve(Response.json({ message: "Not found" }, { status: 404 }));
  return Promise.resolve(Response.json({ access_token: "tok", expires_in: 86400 }));
}

/** Ruta nueva en cada prueba: así no se arrastra la respuesta guardada para el público. */
async function load() {
  vi.resetModules();
  return (await import("./route")).GET;
}
let ip = 0;
const req = (auth?: string) => new Request("https://www.bananaburn.app/api/salud", { headers: { "x-forwarded-for": `10.1.0.${++ip}`, ...(auth ? { authorization: auth } : {}) } });
const MONITOR = "Bearer cron-secreto-de-prueba-123";

beforeEach(() => {
  mode = { resend: "up", onvo: "up", tilopay: "up" };
  db.ok = true;
  viewer.current = null;
  calls.length = 0;
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
  vi.stubEnv("CRON_SECRET", "cron-secreto-de-prueba-123");
  vi.stubEnv("RESEND_API_KEY", "re_prueba_resend_123");
  vi.stubEnv("ONVO_SECRET_KEY", "onvo_test_secret_key_prueba");
  vi.stubEnv("TILOPAY_API_USER", "usuario");
  vi.stubEnv("TILOPAY_API_PASSWORD", "clave-tilopay");
  vi.stubEnv("TILOPAY_KEY", "llave-tilopay");
  vi.stubEnv("TILOPAY_ENABLED", "1");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("GET /api/salud", () => {
  it("todo arriba: 200 y el detalle de cada dependencia para el monitor", async () => {
    const r = await (await load())(req(MONITOR));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.ok).toBe(true);
    expect(j.checks.db.state).toBe("up");
    expect(j.checks.resend.state).toBe("up");
    expect(j.checks.onvo.state).toBe("up");
    expect(j.checks.tilopay.state).toBe("up");
    expect(r.headers.get("cache-control")).toBe("no-store");
  });

  it("base de datos abajo: 503", async () => {
    db.ok = false;
    const r = await (await load())(req(MONITOR));
    expect(r.status).toBe(503);
    const j = await r.json();
    expect(j.checks.db.state).toBe("down");
    expect(j.ok).toBe(false);
  });

  for (const dep of ["resend", "onvo", "tilopay"] as const) {
    it(`${dep} abajo (500 o sin red): 503 y solo un código corto`, async () => {
      for (const m of ["down", "red"] as const) {
        mode[dep] = m;
        const r = await (await load())(req(MONITOR));
        expect(r.status).toBe(503);
        const j = await r.json();
        expect(j.checks[dep].state).toBe("down");
        expect(j.checks[dep].code).toBe(m === "down" ? "http_500" : "TypeError");
        for (const other of ["resend", "onvo", "tilopay"].filter((x) => x !== dep)) expect(j.checks[other].state).toBe("up");
      }
    });
    it(`${dep} con la llave rechazada cuenta como abajo`, async () => {
      mode[dep] = "llave";
      const j = await (await (await load())(req(MONITOR))).json();
      expect(j.checks[dep]).toMatchObject({ state: "down", code: "http_401" });
    });
  }

  it("Resend con llave solo para enviar (restricted_api_key) está arriba", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u: RequestInfo | URL) => String(u).startsWith("https://api.resend.com") ? Response.json({ name: "restricted_api_key" }, { status: 401 }) : fakeFetch(u)));
    const j = await (await (await load())(req(MONITOR))).json();
    expect(j.checks.resend.state).toBe("up");
  });

  it("lo que no está configurado queda en off y no tumba la salud", async () => {
    vi.stubEnv("TILOPAY_ENABLED", "");
    vi.stubEnv("RESEND_API_KEY", "");
    const r = await (await load())(req(MONITOR));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.checks.tilopay.state).toBe("off");
    expect(j.checks.resend.state).toBe("off");
    expect(calls.some((u) => u.includes("tilopay") || u.includes("resend"))).toBe(false);
  });

  it("público: solo { ok }, sin detalles, versiones ni códigos", async () => {
    mode.onvo = "down";
    const r = await (await load())(req());
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ ok: false });
  });

  it("público: un token que no es el del cron no ve detalles", async () => {
    const r = await (await load())(req("Bearer otro-token"));
    expect(await r.json()).toEqual({ ok: true });
  });

  it("público: las dependencias se revisan una vez por minuto, no en cada visita", async () => {
    const GET = await load();
    await GET(req()); await GET(req()); await GET(req());
    expect(calls.filter((u) => u.includes("onvopay")).length).toBe(1);
  });

  it("staff con sesión ve el detalle; una persona normal no", async () => {
    viewer.current = { id: "u1", demo: false, role: "admin" };
    expect((await (await (await load())(req())).json()).checks).toBeDefined();
    viewer.current = { id: "u2", demo: false, role: "user" };
    expect(await (await (await load())(req())).json()).toEqual({ ok: true });
  });

  it("?probar=error lanza un error solo para staff (prueba de Sentry); el público recibe la salud normal", async () => {
    const GET = await load();
    await expect(GET(new Request("https://www.bananaburn.app/api/salud?probar=error", { headers: { authorization: MONITOR } }))).rejects.toThrow("Prueba de Sentry en el servidor");
    const r = await GET(new Request("https://www.bananaburn.app/api/salud?probar=error", { headers: { "x-forwarded-for": "10.2.0.1" } }));
    expect(await r.json()).toEqual({ ok: true });
  });

  it("la respuesta nunca trae valores de llaves", async () => {
    const text = await (await (await load())(req(MONITOR))).text();
    for (const secret of ["re_prueba_resend_123", "onvo_test_secret_key_prueba", "clave-tilopay", "llave-tilopay", "cron-secreto", "tok"]) expect(text).not.toContain(secret);
  });
});
