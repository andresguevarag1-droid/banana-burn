import { describe, expect, it, vi } from "vitest";
import { RULES, hitLimit, retryAfterFor, tooMany, tooManyText } from "./limits";
import { burstLimiter, clientIpFrom } from "./ip";

vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => null }));

const db = (allow: (key: string) => boolean) => {
  const rpc = vi.fn(async (_fn: string, a: { p_key: string }) => ({ data: allow(a.p_key), error: null }));
  return { rpc } as unknown as Db & { rpc: typeof rpc };
};
type Db = NonNullable<NonNullable<Parameters<typeof hitLimit>[2]>["db"]>;
let n = 0;
const fresh = () => `persona-${++n}-${Math.random()}`;

describe("límites con nombre (security/limits)", () => {
  it("todas las reglas tienen ventanas válidas para rate_hit y un mensaje en español sin emojis", () => {
    for (const [name, r] of Object.entries(RULES)) {
      expect(r.windows.length, name).toBeGreaterThan(0);
      for (const w of r.windows) {
        expect(w.sec, name).toBeGreaterThanOrEqual(1);
        expect(w.sec, name).toBeLessThanOrEqual(604800);
        expect(w.max, name).toBeGreaterThanOrEqual(1);
        expect(w.max, name).toBeLessThanOrEqual(100000);
      }
      expect(r.msg, name).toMatch(/^[A-ZÁÉÍÓÚÑ¿]/);
      expect(r.msg, name).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it("cuenta en la base con una clave por regla y ventana, sin el id legible", async () => {
    const d = db(() => true);
    const who = fresh();
    expect((await hitLimit("cuenta:exportar", who, { db: d })).ok).toBe(true);
    const keys = d.rpc.mock.calls.map((c) => c[1].p_key);
    expect(keys).toHaveLength(2);
    expect(keys.every((k) => k.startsWith("cuenta:exportar:"))).toBe(true);
    expect(keys.join()).not.toContain(who);
    expect(d.rpc.mock.calls.map((c) => c[1])).toEqual(expect.arrayContaining([expect.objectContaining({ p_window_seconds: 3600, p_max: 6 }), expect.objectContaining({ p_window_seconds: 86400, p_max: 20 })]));
  });

  it("frena cuando la base dice que se pasó, con el mensaje de la regla y Retry-After", async () => {
    const r = await hitLimit("pagos:prueba", fresh(), { db: db(() => false), now: Date.UTC(2026, 9, 31, 10, 59, 0) });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe(RULES["pagos:prueba"].msg);
    expect(r.retryAfter).toBe(60); // la ventana de una hora se abre a las 11:00
  });

  it("el freno en memoria corta antes de llegar a la base", async () => {
    const d = db(() => true);
    const who = fresh();
    for (let i = 0; i < 6; i++) expect((await hitLimit("coach:chat", who, { db: d })).ok).toBe(true);
    const calls = d.rpc.mock.calls.length;
    expect((await hitLimit("coach:chat", who, { db: d })).ok).toBe(false);
    expect(d.rpc.mock.calls.length).toBe(calls); // sin consulta extra
  });

  it("las reglas solo en memoria no tocan la base", async () => {
    const d = db(() => false);
    expect((await hitLimit("registro", fresh(), { db: d })).ok).toBe(true);
    expect(d.rpc).not.toHaveBeenCalled();
  });

  it("si la base falla, deja pasar (queda el freno en memoria)", async () => {
    const broken = { rpc: vi.fn(async () => ({ data: null, error: { code: "57014" } })) } as unknown as Db;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await hitLimit("comidas", fresh(), { db: broken })).ok).toBe(true);
    warn.mockRestore();
  });

  it("retryAfterFor usa la ventana fija más lejana", () => {
    const t = Date.UTC(2026, 9, 31, 10, 59, 30);
    expect(retryAfterFor([{ sec: 60, max: 1 }], t)).toBe(30);
    expect(retryAfterFor([{ sec: 60, max: 1 }, { sec: 3600, max: 1 }], t)).toBe(30);
    expect(retryAfterFor([{ sec: 86400, max: 1 }], Date.UTC(2026, 9, 31, 23, 59, 59))).toBe(1);
  });

  it("429 JSON y texto con Retry-After y sin caché", async () => {
    const r = { ok: false as const, error: "Vas muy rápido.", retryAfter: 42 };
    const j = tooMany(r);
    expect(j.status).toBe(429);
    expect(j.headers.get("retry-after")).toBe("42");
    expect(j.headers.get("cache-control")).toBe("no-store");
    expect(await j.json()).toMatchObject({ ok: false, error: "Vas muy rápido.", retryAfter: 42 });
    const t = tooManyText(r);
    expect(t.headers.get("content-type")).toMatch(/text\/plain/);
    expect(await t.text()).toBe("Vas muy rápido.");
  });
});

describe("IP del cliente y freno del middleware (security/ip)", () => {
  it("prefiere x-real-ip (la pone Vercel) y luego el primer x-forwarded-for", () => {
    expect(clientIpFrom(new Headers({ "x-real-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2, 3.3.3.3" }))).toBe("1.1.1.1");
    expect(clientIpFrom(new Headers({ "x-forwarded-for": " 2.2.2.2 , 3.3.3.3" }))).toBe("2.2.2.2");
    expect(clientIpFrom(new Headers())).toBe("local");
  });

  it("corta solo al pasar el máximo de la ventana y vuelve a abrir", () => {
    const hit = burstLimiter(3, 60_000);
    const t = 1_000_000;
    expect([1, 2, 3].map(() => hit("ip", t).ok)).toEqual([true, true, true]);
    const r = hit("ip", t + 30_000);
    expect(r.ok).toBe(false);
    expect(r.retryAfter).toBe(30);
    expect(hit("otra-ip", t).ok).toBe(true);
    expect(hit("ip", t + 60_001).ok).toBe(true);
  });

  it("no crece sin fin con muchas IPs", () => {
    const hit = burstLimiter(1, 1000, 100);
    for (let i = 0; i < 500; i++) hit(`ip-${i}`, i < 250 ? 0 : 5000);
    expect(hit("ip-499", 5000).ok).toBe(false); // la última sigue contada
  });
});

describe("inventario: cada entrada que se puede abusar tiene su freno", async () => {
  const { readFileSync, readdirSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");
  const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
  const files = walk(join(__dirname, "../../app"));
  // Por qué cada ruta sin límite propio está bien así (cambiar esta lista exige pensarlo).
  const EXEMPT: Record<string, string> = {
    "api/version/route.ts": "solo devuelve el id del despliegue, sin base ni costo (cubierto por el freno del middleware)",
    "auth/callback/route.ts": "verifyOtp: Supabase Auth limita los enlaces; un token sirve una vez",
    "auth/salir/route.ts": "cierra la sesión propia",
    "llms.txt/route.ts": "estático (ISR)",
    "og/route.tsx": "imagen en la CDN una semana; el middleware frena ráfagas",
    "r/[code]/route.ts": "solo pone una cookie y redirige, sin base",
    "api/pagos/webhook/route.ts": "firma de ONVO en tiempo constante antes de leer el cuerpo",
    "api/cron/recordatorios/route.ts": "Bearer CRON_SECRET en tiempo constante antes de cualquier trabajo",
    "api/cron/cobros/route.ts": "Bearer CRON_SECRET en tiempo constante antes de cualquier trabajo",
  };
  const FRENO = /hitLimit\(|memoryRateLimit\(|dbRateLimit(All)?\(|tooFast\(/;
  for (const f of files.filter((x) => /\/route\.tsx?$/.test(x))) {
    const rel = f.split("/src/app/")[1];
    it(`ruta ${rel}`, () => {
      if (EXEMPT[rel]) return;
      expect(readFileSync(f, "utf8"), `${rel}: agrega hitLimit (src/lib/security/limits.ts) o explica la excepción en EXEMPT`).toMatch(FRENO);
    });
  }
  it("las acciones del panel pasan por authorize (con el límite del staff)", () => {
    expect(readFileSync(join(__dirname, "../admin-auth.ts"), "utf8")).toMatch(/limitError\("admin", v\.id\)/);
  });
});
