import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ summaryFails: false }));
const cronFailed = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/lib/admin-avisos-server", () => ({
  dispatchAdminEvents: async () => ({ events: 0, push: 0, inApp: 0, email: 0 }),
  sendDailySummary: async () => { if (state.summaryFails) throw new Error("caída"); return { sent: 1 }; },
}));
vi.mock("@/lib/monitor/server", () => ({ checkErrorRate: async () => ({ errors24h: 0, over: false }) }));
vi.mock("@/lib/monitor/alerts", () => ({ cronFailed }));

import { GET } from "./route";

const req = () => new Request("https://www.bananaburn.app/api/cron/avisos", { headers: { authorization: "Bearer secreto-del-cron-123" } });

beforeEach(() => { vi.stubEnv("CRON_SECRET", "secreto-del-cron-123"); cronFailed.mockClear(); state.summaryFails = false; });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("cron de avisos: aviso si falla", () => {
  it("si el resumen falla, 500 y aviso de sistema", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.summaryFails = true;
    const r = await GET(req());
    expect(r.status).toBe(500);
    expect(cronFailed).toHaveBeenCalledWith("avisos", { pendientes: true, resumen: false });
  });
  it("si sale bien, 200 y sin aviso", async () => {
    const r = await GET(req());
    expect(r.status).toBe(200);
    expect(cronFailed).not.toHaveBeenCalled();
  });
});
