import { describe, expect, it, vi } from "vitest";
import { addAiUsage, aiLimits, takeAiBudget } from "./ai-budget";

vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => null }));

type Db = NonNullable<NonNullable<Parameters<typeof takeAiBudget>[1]>["db"]>;
const db = (data: unknown, error: { code?: string } | null = null) => ({ rpc: vi.fn(async () => ({ data, error })) }) as unknown as Db & { rpc: ReturnType<typeof vi.fn> };

describe("tope diario global de la IA (0040)", () => {
  it("valores por defecto y desde el entorno", () => {
    expect(aiLimits({})).toEqual({ chat: { requests: 5000, tokens: 30_000_000 }, feedback: { requests: 3000, tokens: 0 } });
    expect(aiLimits({ COACH_DAILY_MAX: "8000", COACH_DAILY_TOKENS: "50_000_000", COACH_FEEDBACK_DAILY_MAX: "0" })).toEqual({ chat: { requests: 8000, tokens: 50_000_000 }, feedback: { requests: 0, tokens: 0 } });
  });

  it("un valor raro cae al valor por defecto, nunca a sin tope", () => {
    expect(aiLimits({ COACH_DAILY_MAX: "muchas", COACH_DAILY_TOKENS: "-5" }).chat).toEqual({ requests: 5000, tokens: 30_000_000 });
    expect(aiLimits({ COACH_DAILY_MAX: "" }).chat.requests).toBe(5000);
  });

  it("reserva con ai_budget_take y los topes del entorno", async () => {
    const d = db(true);
    expect(await takeAiBudget("chat", { db: d, env: { COACH_DAILY_MAX: "10", COACH_DAILY_TOKENS: "99" } })).toBe(true);
    expect(d.rpc).toHaveBeenCalledWith("ai_budget_take", { p_kind: "chat", p_max_requests: 10, p_max_tokens: 99 });
  });

  it("corta cuando la base dice que se llegó al tope (y lo registra)", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await takeAiBudget("chat", { db: db(false), env: {} })).toBe(false);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("tope 0 = apagado, sin consultar la base", async () => {
    const d = db(true);
    expect(await takeAiBudget("feedback", { db: d, env: { COACH_FEEDBACK_DAILY_MAX: "0" } })).toBe(false);
    expect(d.rpc).not.toHaveBeenCalled();
  });

  it("si la base falla o falta 0040, deja pasar con un tope por instancia", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await takeAiBudget("chat", { db: db(null, { code: "PGRST202" }), env: {} })).toBe(true);
    const env = { COACH_FEEDBACK_DAILY_MAX: "2" };
    const broken = db(null, { code: "57014" });
    const r = [await takeAiBudget("feedback", { db: broken, env }), await takeAiBudget("feedback", { db: broken, env }), await takeAiBudget("feedback", { db: broken, env })];
    expect(r).toEqual([true, true, false]);
    err.mockRestore();
  });

  it("suma tokens (solo conteos) y devuelve la llamada si la IA no respondió", async () => {
    const d = db(null);
    await addAiUsage("chat", { in: 1200, out: 300.7, cacheRead: -4, cacheWrite: Number.NaN }, { db: d });
    expect(d.rpc).toHaveBeenCalledWith("ai_budget_add", { p_kind: "chat", p_requests: 0, p_in: 1200, p_out: 300, p_cache_read: 0, p_cache_write: 0 });
    await addAiUsage("feedback", {}, { db: d, refund: true });
    expect(d.rpc).toHaveBeenLastCalledWith("ai_budget_add", { p_kind: "feedback", p_requests: -1, p_in: 0, p_out: 0, p_cache_read: 0, p_cache_write: 0 });
  });

  it("nunca lanza", async () => {
    await expect(addAiUsage("chat", { in: 1 }, { db: { rpc: vi.fn(async () => { throw new Error("red"); }) } as unknown as Db })).resolves.toBeUndefined();
  });
});
