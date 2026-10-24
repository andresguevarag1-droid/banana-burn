import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const req = (body: string, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/errores", { method: "POST", body, headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}`, ...headers } });

describe("POST /api/errores", () => {
  afterEach(() => vi.restoreAllMocks());
  it("204 con un reporte válido (sin service_role: solo log)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await POST(req(JSON.stringify({ source: "boundary", kind: "TypeError", message: "x de ana@a.co", route: "/app/hoy?x=1" })));
    expect(r.status).toBe(204);
    const line = String(warn.mock.calls[0]?.[0]);
    expect(line).toContain('"route":"/app/hoy"');
    expect(line).not.toContain("ana@a.co");
  });
  it("403 desde otro origen", async () => {
    const r = await POST(req("{}", { origin: "https://malo.example", host: "localhost" }));
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ ok: false, error: "Origen no permitido." });
  });
  it("400 con JSON inválido o reporte inválido, 413 si es grande", async () => {
    expect((await POST(req("no-json"))).status).toBe(400);
    expect((await POST(req(JSON.stringify({ source: "server", message: "x" })))).status).toBe(400);
    expect((await POST(req("x".repeat(5000)))).status).toBe(413);
  });
  it("429 al pasar el tope por IP", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = { "x-forwarded-for": "10.9.9.9" };
    const codes: number[] = [];
    for (let i = 0; i < 22; i++) codes.push((await POST(req(JSON.stringify({ source: "client", message: `m${i}` }), h))).status);
    expect(codes.filter((c) => c === 429).length).toBe(2);
  });
});
