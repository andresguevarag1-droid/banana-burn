import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const run = vi.hoisted(() => ({ result: null as unknown }));
const cronFailed = vi.hoisted(() => vi.fn(async () => {}));
const checkErrorRate = vi.hoisted(() => vi.fn(async () => ({ errors24h: 0, over: false })));
vi.mock("@/lib/cobros-cron", () => ({ runCobros: async () => run.result, plannedOf: () => ({ planned: [], errors: 0 }) }));
vi.mock("@/lib/cobros-simulacro", () => ({ summarize: () => ({}) }));
vi.mock("@/lib/monitor/server", () => ({ beat: async () => {}, checkErrorRate }));
vi.mock("@/lib/monitor/alerts", () => ({ cronFailed }));

import { GET } from "./route";

const req = (q = "") => new Request(`https://www.bananaburn.app/api/cron/cobros${q}`, { headers: { authorization: "Bearer secreto-del-cron-123" } });

beforeEach(() => { vi.stubEnv("CRON_SECRET", "secreto-del-cron-123"); cronFailed.mockClear(); checkErrorRate.mockClear(); });
afterEach(() => vi.unstubAllEnvs());

describe("cron de cobros: aviso si falla", () => {
  it("si la corrida falla responde 500 y deja el aviso de sistema", async () => {
    run.result = { cobros: null, primerMes: null, renovaciones: { attempted: 0 } };
    const r = await GET(req());
    expect(r.status).toBe(500);
    expect(cronFailed).toHaveBeenCalledTimes(1);
    expect(cronFailed).toHaveBeenCalledWith("cobros", { renovaciones: true, primerMes: false });
  });
  it("si sale bien no avisa, pero revisa la tasa de errores", async () => {
    run.result = { cobros: { attempted: 2, sent: 2, errors: 0 }, primerMes: null, renovaciones: null };
    const r = await GET(req());
    expect(r.status).toBe(200);
    expect(cronFailed).not.toHaveBeenCalled();
    expect(checkErrorRate).toHaveBeenCalledTimes(1);
  });
  it("el simulacro (dryRun) nunca avisa", async () => {
    run.result = { cobros: null, primerMes: null, renovaciones: null };
    await GET(req("?dryRun=1"));
    expect(cronFailed).not.toHaveBeenCalled();
  });
  it("sin el secreto no corre ni avisa", async () => {
    const r = await GET(new Request("https://www.bananaburn.app/api/cron/cobros"));
    expect(r.status).toBe(401);
    expect(cronFailed).not.toHaveBeenCalled();
  });
});
