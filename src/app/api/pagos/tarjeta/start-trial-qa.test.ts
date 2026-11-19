import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ save: vi.fn(), send: vi.fn(), after: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/server", async (original) => ({ ...await original<typeof import("next/server")>(), after: mocks.after }));
vi.mock("@/lib/supabase/server", () => ({ getViewer: async () => ({ id: "qa331", demo: false }) }));
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => ({}) }));
vi.mock("@/lib/security", () => ({
  isSameOrigin: () => true, memoryRateLimit: () => true, clientIp: () => "local",
  singleFlight: (_key: string, fn: () => unknown) => fn(),
}));
vi.mock("@/lib/security/db-rate-limit", () => ({ dbRateLimit: async () => true, dbRateLimitAll: async () => true }));
vi.mock("@/lib/onvo", () => ({ isOnvoConfigured: () => true, parsePlanBilling: () => ({ plan: "entreno", billing: "mes" }) }));
vi.mock("@/lib/trial-billing", () => ({ saveCard: mocks.save, prepareCard: vi.fn(), removeCard: vi.fn() }));
vi.mock("@/lib/pago-fallo-server", () => ({ recordPaymentFailed: vi.fn() }));
vi.mock("@/lib/meta-capi", () => ({ sendStartTrial: mocks.send }));
const { POST } = await import("./route");
const trial = { eventId: "trial-331", value: 4.99, predicted_ltv: 29.97 };

beforeEach(() => vi.clearAllMocks());
describe("QA #331: entrega del StartTrial desde guardar tarjeta", () => {
  it("devuelve al navegador el mismo evento que envía después por CAPI", async () => {
    mocks.save.mockResolvedValue({ outcome: "programado", startTrial: trial });
    const response = await POST(new Request("https://bananaburn.app/api/pagos/tarjeta", {
      method: "POST", headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0", referer: "https://bananaburn.app/bienvenida?privado=1" },
      body: JSON.stringify({ action: "guardar", paymentMethodId: "pm_qa" }),
    }));
    expect(response.status).toBe(200);
    expect((await response.json()).startTrial).toEqual(trial);
    expect(mocks.after).toHaveBeenCalledOnce();
    await mocks.after.mock.calls[0][0]();
    expect(mocks.send).toHaveBeenCalledWith(trial, expect.objectContaining({ path: "/bienvenida", ua: "Mozilla/5.0", ip: "" }));
  });
  it("guardar de nuevo no programa otro envío CAPI", async () => {
    mocks.save.mockResolvedValue({ outcome: "sin_cambio" });
    await POST(new Request("https://bananaburn.app/api/pagos/tarjeta", {
      method: "POST", body: JSON.stringify({ action: "guardar", paymentMethodId: "pm_qa" }),
    }));
    expect(mocks.after).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
