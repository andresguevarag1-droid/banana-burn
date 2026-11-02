// #196: el registro (onboarding_done y CompleteRegistration del píxel) se contaba dos veces. Debe quedar una sola vez por cuenta:
// en el navegador (sessionStorage, aunque se recargue la pantalla final) y en el servidor (/api/track rechaza el segundo).
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Base en memoria: lo que /api/track guarda en funnel_events y lo que consulta antes de aceptar onboarding_done.
const db = vi.hoisted(() => ({ rows: [] as { user_id: string | null; name: string }[], uid: "u-1" as string | null }));
vi.mock("@/lib/env", async (orig) => ({ ...(await orig<typeof import("@/lib/env")>()), isSupabaseConfigured: true }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ getAll: () => [], get: () => undefined, set: () => {} }) }));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: async (fn: () => unknown) => { await fn(); } }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: async () => ({ data: db.uid ? { claims: { sub: db.uid } } : null }) } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  adminClient: () => ({
    rpc: async () => ({ data: true, error: null }),
    from: () => {
      const f: Record<string, unknown> = {};
      const q = {
        select: () => q,
        eq: (k: string, v: unknown) => { f[k] = v; return q; },
        limit: async () => ({ data: db.rows.filter((r) => r.user_id === f.user_id && r.name === f.name), error: null }),
        insert: async (row: { user_id: string | null; name: string }) => { db.rows.push(row); return { error: null }; },
      };
      return q;
    },
  }),
}));
const capi = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock("@/lib/meta-capi", () => ({ sendCapi: async (evt: { name: string }) => { capi.calls.push(evt.name); } }));

let n = 0;
const post = async (name: string, eid = "abcdef12-3456") => {
  const { POST } = await import("./route");
  return POST(new Request("http://localhost/api/track", {
    method: "POST",
    headers: { "x-real-ip": `10.196.0.${++n}`, origin: "http://localhost", "sec-fetch-site": "same-origin" },
    body: JSON.stringify({ name, props: { path: "/bienvenida", goal: "grasa", trial: true, event_id: eid } }),
  }));
};

beforeEach(() => { db.rows = []; db.uid = "u-1"; capi.calls = []; vi.spyOn(console, "info").mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("/api/track: onboarding_done una sola vez por cuenta", () => {
  it("acepta el primero y rechaza el segundo de la misma persona (no se guarda ni va a la API de Conversiones)", async () => {
    expect((await post("onboarding_done")).status).toBe(204);
    expect((await post("onboarding_done", "otro-id-1234")).status).toBe(409);
    expect(db.rows.filter((r) => r.name === "onboarding_done")).toHaveLength(1);
    expect(capi.calls).toEqual(["onboarding_done"]);
  });

  it("otra persona sí registra el suyo, y los demás eventos se siguen contando cada vez", async () => {
    expect((await post("onboarding_done")).status).toBe(204);
    db.uid = "u-2";
    expect((await post("onboarding_done")).status).toBe(204);
    expect((await post("hoy_view")).status).toBe(204);
    expect((await post("hoy_view")).status).toBe(204);
    expect(db.rows.map((r) => r.name)).toEqual(["onboarding_done", "onboarding_done", "hoy_view", "hoy_view"]);
  });
});

describe("Navegador: completar el onboarding da 1 onboarding_done y 1 CompleteRegistration", () => {
  it("aunque se recargue la pantalla final, con el mismo event_id en el píxel y en el beacon", async () => {
    const store = new Map<string, string>();
    const fbq = vi.fn();
    const beacons: { name: string; props: Record<string, unknown> }[] = [];
    vi.stubGlobal("sessionStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    vi.stubGlobal("window", { fbq });
    vi.stubGlobal("location", { pathname: "/bienvenida" });
    vi.stubGlobal("navigator", { sendBeacon: (_u: string, b: Blob) => { void b.text().then((t) => beacons.push(JSON.parse(t))); return true; } });
    const { trackOnce } = await import("@/components/analytics");
    // Guardar el plan y luego recargar (misma pestaña: el módulo se carga de nuevo, sessionStorage sigue).
    trackOnce("onboarding_done", { goal: "grasa", trial: true });
    vi.resetModules();
    const again = await import("@/components/analytics");
    again.trackOnce("onboarding_done", { goal: "grasa", trial: true });
    await new Promise((r) => setTimeout(r, 0));
    expect(fbq).toHaveBeenCalledTimes(1);
    expect(fbq.mock.calls[0].slice(0, 2)).toEqual(["track", "CompleteRegistration"]);
    expect(beacons).toHaveLength(1);
    expect(beacons[0].name).toBe("onboarding_done");
    expect(beacons[0].props.event_id).toBe(fbq.mock.calls[0][3].eventID);
  });

  it("el wizard lo envía en un solo lugar (al guardar), no también al mostrar la pantalla final", () => {
    const src = readFileSync("src/app/bienvenida/wizard.tsx", "utf8");
    expect(src.match(/onboarding_done/g)).toHaveLength(1);
    expect(src).toContain('trackOnce("onboarding_done"');
    expect(src).not.toMatch(/\btrack\("onboarding_done"/);
  });
});
