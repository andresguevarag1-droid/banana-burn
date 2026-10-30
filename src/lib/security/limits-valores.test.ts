// QA del #52: las reglas que se movieron a limits.ts conservan los números que cada ruta tenía antes, y el webhook de
// pagos frena por IP antes de mirar el secreto (un script sin secreto no llega a la comparación de la firma).
import { describe, expect, it, vi } from "vitest";
import { RULES } from "./limits";

vi.mock("@/lib/billing", () => ({ processWebhook: async () => ({ status: "processed" }) }));

const MIN = 60, HOUR = 3600, DAY = 86400;
const windows = (name: keyof typeof RULES) => RULES[name].windows.map((w) => [w.sec, w.max]);

describe("reglas movidas: mismos números que antes", () => {
  it("entrar y registro: 10 por IP y 5 por correo cada 10 min; 20/h y 100/día por IP; 10/h por correo, en la base", () => {
    for (const kind of ["entrar", "registro"] as const) {
      expect(windows(`auth:${kind}:ip`)).toEqual([[10 * MIN, 10], [HOUR, 20], [DAY, 100]]);
      expect(windows(`auth:${kind}:correo`)).toEqual([[10 * MIN, 5], [HOUR, 10]]);
      expect(RULES[`auth:${kind}:ip`].db && RULES[`auth:${kind}:correo`].db).toBe(true);
    }
  });

  it("/auth/correo: 60 vistas y 20 entradas cada 10 min por IP", () => {
    expect(windows("auth:correo:ver")).toEqual([[10 * MIN, 60]]);
    expect(windows("auth:correo:entrar")).toEqual([[10 * MIN, 20]]);
  });

  it("/api/track 120 por minuto y /api/avisos/despachar 30 por minuto", () => {
    expect(windows("track")).toEqual([[MIN, 120]]);
    expect(windows("avisos:despachar")).toEqual([[MIN, 30]]);
  });

  it("webhook de pagos: solo memoria, holgado (no frena los reintentos de ONVO)", () => {
    expect(RULES["pagos:webhook"].db).toBe(false);
    expect(Math.min(...RULES["pagos:webhook"].windows.map((w) => w.max / (w.sec / MIN)))).toBeGreaterThanOrEqual(300);
  });
});

describe("webhook de pagos", () => {
  it("frena por IP antes de comprobar el secreto", async () => {
    process.env.ONVO_WEBHOOK_SECRET = "secreto-de-prueba";
    const { POST } = await import("@/app/api/pagos/webhook/route");
    const call = () => POST(new Request("http://localhost/api/pagos/webhook", { method: "POST", body: "{}", headers: { "x-real-ip": "10.99.0.7", "x-webhook-secret": "mal" } }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const max = RULES["pagos:webhook"].windows[0].max;
    for (let i = 0; i < max; i++) expect((await call()).status).toBe(401);
    const r = await call();
    expect(r.status).toBe(429);
    expect(r.headers.get("retry-after")).toBeTruthy();
    warn.mockRestore();
    delete process.env.ONVO_WEBHOOK_SECRET;
  });
});
