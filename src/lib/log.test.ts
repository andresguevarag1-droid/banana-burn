import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonLog, logError, setErrorSink } from "./log";

describe("logs JSON sin datos personales", () => {
  afterEach(() => { setErrorSink(null); vi.restoreAllMocks(); });
  it("una línea JSON con nivel, área, código y extra acotado", () => {
    const o = JSON.parse(jsonLog("error", "pagos", "checkout_failed", { kind: "http_502", n: 3, skip: undefined, s: "a".repeat(500) }, new Date("2026-10-23T00:00:00Z")));
    expect(o).toMatchObject({ level: "error", area: "pagos", code: "checkout_failed", kind: "http_502", n: 3, at: "2026-10-23T00:00:00.000Z" });
    expect(o.s).toHaveLength(120);
    expect("skip" in o).toBe(false);
  });
  it("descarta llaves con nombre de dato personal y limpia área/código", () => {
    const o = JSON.parse(jsonLog("warn", "a b<script>", "c\nd", { email: "ana@a.co", ip: "1.2.3.4", body: "x", kind: "ok" }));
    expect(o.email).toBeUndefined(); expect(o.ip).toBeUndefined(); expect(o.body).toBeUndefined();
    expect(o.area).toBe("a_b_script_"); expect(o.code).toBe("c_d");
  });
  it("logError llama al destino extra y nunca lanza aunque el destino falle", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const seen: string[] = [];
    setErrorSink((area, code) => seen.push(`${area}:${code}`));
    logError("cron", "run_failed", { kind: "x" });
    expect(seen).toEqual(["cron:run_failed"]);
    setErrorSink(() => { throw new Error("db"); });
    expect(() => logError("cron", "run_failed")).not.toThrow();
  });
});
