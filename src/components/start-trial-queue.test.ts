import { afterEach, describe, expect, it, vi } from "vitest";
import { trackStartTrial } from "./analytics";
import { loadMetaPixel } from "./meta-pixel";

vi.mock("next/navigation", () => ({ usePathname: () => "/app/suscripcion" }));
afterEach(() => vi.unstubAllGlobals());

describe("QA #331: StartTrial antes de cargar el píxel", () => {
  it("conserva valor y event_id en la cola y no repite al volver a mostrar la prueba", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    });
    const w = {
      document: {
        createElement: () => ({ async: false, src: "" }),
        head: { appendChild: vi.fn() },
      },
    } as unknown as Window & typeof globalThis;
    vi.stubGlobal("window", w);
    const trial = { eventId: "trial-qa-331", value: 4.99, predicted_ltv: 29.97 };
    trackStartTrial(trial);
    trackStartTrial(trial);
    expect(w.fbq).toBeUndefined();
    loadMetaPixel("123", w);
    const queue = (w.fbq as unknown as { queue: unknown[][] }).queue;
    expect(queue).toEqual([
      ["init", "123"], ["track", "PageView"],
      ["track", "StartTrial", { value: 4.99, currency: "USD", predicted_ltv: 29.97 }, { eventID: trial.eventId }],
    ]);
    trackStartTrial(trial);
    expect(queue).toHaveLength(3);
  });
});
