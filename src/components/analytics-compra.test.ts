// #228: el Subscribe del navegador en /pago/exito lleva el event_id de la suscripción, el mismo que manda el servidor
// desde el webhook del pago (billing.ts), así Meta deduplica y cuenta un solo pago.
import { afterEach, describe, expect, it, vi } from "vitest";

const fbq = vi.hoisted(() => vi.fn());
vi.mock("@/components/meta-pixel", () => ({ fbq }));
vi.mock("next/navigation", () => ({ usePathname: () => "/pago/exito" }));

const { track } = await import("./analytics");
const { purchaseEventId } = await import("@/lib/meta-pixel");
const { cleanEvent } = await import("@/app/api/track/event");

afterEach(() => { vi.unstubAllGlobals(); fbq.mockReset(); });

function beacons() {
  const sendBeacon = vi.fn((_url: string, _b: Blob) => true);
  vi.stubGlobal("navigator", { sendBeacon });
  vi.stubGlobal("location", { pathname: "/pago/exito" });
  return async () => Promise.all(sendBeacon.mock.calls.map(async ([, b]) => JSON.parse(await b.text())));
}

describe("Subscribe del navegador en /pago/exito", () => {
  it("usa el event_id de la suscripción en el píxel y en el beacon a /api/track", async () => {
    const read = beacons();
    const eid = purchaseEventId("sub_checkout");
    track("purchase_success", { plan: "Entreno", billing: "mes", event_id: eid });
    expect(fbq).toHaveBeenCalledWith("track", "Subscribe", expect.objectContaining({ currency: "USD" }), { eventID: eid });
    const [body] = await read();
    expect(body.props.event_id).toBe(eid);
    // /api/track lo acepta tal cual para reenviarlo a la API de Conversiones.
    expect(cleanEvent(body)?.props.event_id).toBe(eid);
  });

  it("los ids de ONVO, Tilopay y del primer mes caben en el formato de /api/track", () => {
    for (const id of ["sub_01HZX9ABCDEFGHJKMNPQRSTVWXYZ0123456789", "tlp:bbc-1", "onvo-pi:pi_1"]) {
      const eid = purchaseEventId(id);
      expect(eid).toBe(purchaseEventId(id));
      expect(cleanEvent({ name: "purchase_success", props: { event_id: eid } })?.props.event_id).toBe(eid);
    }
  });

  it("los demás eventos siguen con un id nuevo en cada llamada", () => {
    beacons();
    track("checkout_view", { plan: "entreno", billing: "mes" });
    track("checkout_view", { plan: "entreno", billing: "mes" });
    const [a, b] = fbq.mock.calls.map((c) => (c[3] as { eventID: string }).eventID);
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
  });
});
