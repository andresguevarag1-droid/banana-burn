import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { capiPayload } from "./meta-capi";

const ctx = { ip: "200.1.2.3", ua: "Mozilla/5.0", cookies: "a=1; _fbp=fb.1.123.456; _fbc=fb.1.123.abc", origin: "https://www.bananaburn.app", now: 1_800_000_000_000 };

describe("capiPayload", () => {
  it("arma el evento con el mismo event_id del píxel y sin datos personales", () => {
    const p = capiPayload({ name: "purchase_success", props: { plan: "Entreno", billing: "mes", path: "/pago/exito", event_id: "abc12345" } }, ctx);
    expect(p?.data[0]).toMatchObject({
      event_name: "Subscribe", event_id: "abc12345", action_source: "website", event_time: 1_800_000_000,
      event_source_url: "https://www.bananaburn.app/pago/exito",
      user_data: { client_ip_address: "200.1.2.3", client_user_agent: "Mozilla/5.0", fbp: "fb.1.123.456", fbc: "fb.1.123.abc" },
      custom_data: { value: 9.99, currency: "USD" },
    });
  });
  it("no envía eventos sin mapeo o sin event_id", () => {
    expect(capiPayload({ name: "page_view", props: { event_id: "abc12345" } }, ctx)).toBeNull();
    expect(capiPayload({ name: "card_saved", props: {} }, ctx)).toBeNull();
  });
});
