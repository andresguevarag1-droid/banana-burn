import { afterEach, describe, expect, it, vi } from "vitest";

const cronFailed = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("./server", () => ({ recordServerError: () => {} }));
vi.mock("./alerts", async (orig) => ({ ...(await orig<typeof import("./alerts")>()), cronFailed }));

import { reportRequestError } from "./node";

afterEach(() => { vi.restoreAllMocks(); cronFailed.mockClear(); });

describe("errores no atrapados", () => {
  it("si un cron se corta con un error, deja el aviso de sistema", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await reportRequestError(new TypeError("x"), { path: "/api/cron/cobros", method: "GET" }, { routerKind: "App Router", routePath: "/api/cron/cobros", routeType: "route" });
    expect(cronFailed).toHaveBeenCalledWith("cobros", { excepcion: true, tipo: "TypeError" });
  });
  it("otras rutas no avisan", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await reportRequestError(new Error("x"), { path: "/app/hoy", method: "GET" }, { routerKind: "App Router", routePath: "/app/hoy", routeType: "render" });
    expect(cronFailed).not.toHaveBeenCalled();
  });
});
