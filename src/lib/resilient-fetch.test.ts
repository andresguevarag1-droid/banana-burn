import { describe, expect, it, vi } from "vitest";
import { isIdempotent, methodOf, resilientFetch } from "./resilient-fetch";
import { errCode, formatLog } from "./log";

const ok = () => new Response("ok", { status: 200 });

describe("resilientFetch", () => {
  it("reintenta una lectura cuando la red falla", async () => {
    const base = vi.fn().mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValueOnce(ok());
    const f = resilientFetch({ base, backoffMs: 1 });
    const res = await f("https://x.test/rest/v1/a", { method: "GET" });
    expect(res.status).toBe(200);
    expect(base).toHaveBeenCalledTimes(2);
  });

  it("reintenta una lectura con 503 y devuelve la última respuesta", async () => {
    const base = vi.fn().mockResolvedValue(new Response("no", { status: 503 }));
    const f = resilientFetch({ base, backoffMs: 1, retries: 1 });
    const res = await f("https://x.test/a");
    expect(res.status).toBe(503);
    expect(base).toHaveBeenCalledTimes(2);
  });

  it("nunca reintenta escrituras", async () => {
    const base = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const f = resilientFetch({ base, backoffMs: 1 });
    await expect(f("https://x.test/a", { method: "POST", body: "{}" })).rejects.toThrow("fetch failed");
    expect(base).toHaveBeenCalledTimes(1);
  });

  it("no reintenta si quien llama canceló", async () => {
    const ctl = new AbortController();
    ctl.abort();
    const base = vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError"));
    const f = resilientFetch({ base, backoffMs: 1 });
    await expect(f("https://x.test/a", { signal: ctl.signal })).rejects.toThrow();
    expect(base).toHaveBeenCalledTimes(1);
  });

  it("pasa siempre una señal con tiempo límite", async () => {
    const base = vi.fn().mockResolvedValue(ok());
    await resilientFetch({ base })("https://x.test/a");
    expect(base.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("corta por tiempo una lectura colgada", async () => {
    const base = vi.fn((_: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_, rej) => init?.signal?.addEventListener("abort", () => rej(init.signal!.reason))));
    const f = resilientFetch({ base, readTimeoutMs: 20, retries: 0 });
    await expect(f("https://x.test/a")).rejects.toBeDefined();
  });

  it("detecta el método", () => {
    expect(methodOf("https://x.test")).toBe("GET");
    expect(methodOf("https://x.test", { method: "patch" })).toBe("PATCH");
    expect(isIdempotent("HEAD")).toBe(true);
    expect(isIdempotent("DELETE")).toBe(false);
  });
});

describe("log", () => {
  it("nunca incluye el mensaje del error", () => {
    expect(errCode(new Error("correo ana@x.com no existe"))).toBe("Error");
    expect(errCode({ code: "23505", message: "duplicate key (email)=(ana@x.com)" })).toBe("23505");
    expect(errCode({ statusCode: 410 })).toBe("http_410");
    expect(errCode(null)).toBe("unknown");
  });
  it("da una línea filtrable y recorta valores largos", () => {
    expect(formatLog("cron", "user_failed", { n: 3, skip: undefined })).toBe('[cron] user_failed {"n":3}');
    expect(formatLog("x", "y", { s: "a".repeat(500) }).length).toBeLessThan(160);
  });
});
