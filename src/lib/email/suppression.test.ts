import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));
const state: { rows: Set<string> } = { rows: new Set() };
vi.mock("@/lib/supabase/admin", () => ({
  adminClient: () => ({
    from: () => ({
      select: () => ({ eq: (_c: string, v: string) => ({ maybeSingle: async () => ({ data: state.rows.has(v) ? { email: v } : null, error: null }) }) }),
    }),
  }),
}));

import { suppressionsFrom } from "./suppression";
import { sendEmail } from "./send";

describe("correos rebotados (0072)", () => {
  it("toma solo bounced y complained, en minúsculas y sin repetir", () => {
    expect(suppressionsFrom([
      { id: "1", to: ["Ana@Gmail.com"], last_event: "bounced" },
      { id: "2", to: ["ana@gmail.com"], last_event: "complained" },
      { id: "3", to: ["luis@hotmail.com"], last_event: "delivered" },
      { id: "4", to: ["no-es-correo"], last_event: "bounced" },
      { id: "5", to: ["pepe@yahoo.com"], last_event: "BOUNCED" },
    ])).toEqual([{ email: "ana@gmail.com", reason: "complained" }, { email: "pepe@yahoo.com", reason: "bounced" }]);
  });

  describe("sendEmail no le escribe a una dirección suprimida", () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "re_1" }), { status: 200 }));
    beforeEach(() => { vi.stubEnv("RESEND_API_KEY", "re_test"); vi.stubGlobal("fetch", fetchMock); fetchMock.mockClear(); state.rows = new Set(["rebota@gmail.com"]); });
    afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

    it("suprimida: no llama a Resend", async () => {
      const r = await sendEmail("Rebota@Gmail.com", { subject: "s", html: "h", text: "t" });
      expect(r).toMatchObject({ ok: false, skipped: true, error: "suprimido" });
      expect(fetchMock).not.toHaveBeenCalled();
    });
    it("normal: se manda", async () => {
      const r = await sendEmail("bien@gmail.com", { subject: "s", html: "h", text: "t" });
      expect(r).toMatchObject({ ok: true, id: "re_1" });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
