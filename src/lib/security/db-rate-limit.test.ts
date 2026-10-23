import { describe, expect, it, vi } from "vitest";
import { dbRateLimit, dbRateLimitAll, keyPart } from "./db-rate-limit";

const client = (impl: (args: Record<string, unknown>) => { data: unknown; error: { code?: string } | null }) => {
  const rpc = vi.fn(async (_fn: string, args: Record<string, unknown>) => impl(args));
  return { rpc } as unknown as Parameters<typeof dbRateLimit>[0] & { rpc: typeof rpc };
};

describe("dbRateLimit (límite compartido entre instancias)", () => {
  it("llama a rate_hit con la clave, la ventana y el máximo", async () => {
    const db = client(() => ({ data: true, error: null }));
    expect(await dbRateLimit(db, "signup:ip:abc", 3600, 20)).toBe(true);
    expect(db!.rpc).toHaveBeenCalledWith("rate_hit", { p_key: "signup:ip:abc", p_window_seconds: 3600, p_max: 20 });
  });
  it("frena cuando la base dice que se pasó", async () => {
    expect(await dbRateLimit(client(() => ({ data: false, error: null })), "k", 60, 1)).toBe(false);
  });
  it("si la migración falta o la base falla, deja pasar (queda el límite en memoria)", async () => {
    expect(await dbRateLimit(client(() => ({ data: null, error: { code: "PGRST202" } })), "k", 60, 1)).toBe(true);
    expect(await dbRateLimit(null, "k", 60, 1)).toBe(true);
  });
  it("con varias reglas basta una pasada para frenar", async () => {
    const db = client((a) => ({ data: a.p_key !== "mail", error: null }));
    expect(await dbRateLimitAll(db, [{ key: "ip", windowSec: 60, max: 5 }, { key: "mail", windowSec: 60, max: 5 }])).toBe(false);
    expect(await dbRateLimitAll(db, [{ key: "ip", windowSec: 60, max: 5 }])).toBe(true);
  });
  it("keyPart no deja el correo legible en la base", () => {
    const k = keyPart("ana@correo.com");
    expect(k).not.toMatch(/ana|correo/);
    expect(k).toBe(keyPart("ana@correo.com"));
    expect(k).toHaveLength(22);
  });
});
