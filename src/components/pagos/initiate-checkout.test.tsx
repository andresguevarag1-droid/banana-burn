// #293: abrir cualquier camino de pago manda un solo InitiateCheckout al píxel, con el mismo event_id que el beacon a
// /api/track (que lo reenvía a la API de Conversiones), así Meta no lo cuenta doble.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

// Sin DOM: los componentes se llaman como funciones con los hooks mínimos.
const card = { holder: "Ana Pérez", number: "4242 4242 4242 4242", exp: "12/30", cvv: "123" };
let tilopay = false;
vi.mock("react", async (orig) => {
  const real = await orig<typeof import("react")>();
  const useState = (init: unknown) => {
    let v = typeof init === "function" ? (init as () => unknown)() : init;
    if (v && typeof v === "object" && "holder" in v) v = card;
    if (v && typeof v === "object" && "available" in v && tilopay) v = { available: true, provider: "tilopay" };
    return [v, () => {}];
  };
  return { ...real, useState, useRef: (v: unknown) => ({ current: v }), useEffect: () => {}, useId: () => "id" };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }), usePathname: () => "/app/suscripcion" }));

const { loadMetaPixel } = await import("@/components/meta-pixel");
const { track } = await import("@/components/analytics");
const { useCheckout } = await import("./use-checkout");
const { CardForm } = await import("./card-form");
const { CardPanel } = await import("@/app/(app)/app/suscripcion/card-panel");

let beacons: { name: string; props: Record<string, unknown> }[] = [];
function stubBrowser(w: Record<string, unknown> = {}) {
  beacons = [];
  const loc = { pathname: "/app/suscripcion", assign: vi.fn() };
  vi.stubGlobal("window", Object.assign(w, { location: loc }));
  vi.stubGlobal("location", loc);
  vi.stubGlobal("navigator", { sendBeacon: (_u: string, b: Blob) => { void b.text().then((t) => beacons.push(JSON.parse(t))); return true; } });
}
const flush = () => new Promise((r) => setTimeout(r, 0));
afterEach(() => { vi.unstubAllGlobals(); tilopay = false; });

const initiates = (calls: unknown[][]) => calls.filter((c) => c[0] === "track" && c[1] === "InitiateCheckout");

describe("InitiateCheckout antes de que cargue el píxel (/pago/checkout)", () => {
  it("se guarda y sale una vez, después de init, con el mismo event_id del beacon", async () => {
    const w = { document: { createElement: () => ({}), head: { appendChild() {} } } } as Record<string, unknown>;
    stubBrowser(w);
    // El FunnelTracker de /pago/checkout dispara al hidratar; el píxel carga después (load + idle).
    track("checkout_view", { plan: "completo", billing: "anual" });
    loadMetaPixel("123", w as unknown as Window & typeof globalThis);
    const queue = (w.fbq as unknown as { queue: unknown[][] }).queue;
    expect(queue.slice(0, 2)).toEqual([["init", "123"], ["track", "PageView"]]);
    const ic = initiates(queue);
    expect(ic).toHaveLength(1);
    expect(ic[0][2]).toEqual({ value: 89.99, currency: "USD", content_name: "completo" });
    await flush();
    expect(beacons[0].props.event_id).toBe((ic[0][3] as { eventID: string }).eventID);
  });
});

describe("caminos de pago con el píxel cargado", () => {
  const fbq = vi.fn();
  beforeEach(() => { fbq.mockReset(); stubBrowser({ fbq }); });

  async function startWith(url: string) {
    vi.stubGlobal("fetch", vi.fn(async () => ({ status: 200, json: async () => ({ ok: true, url }) })));
    const checkout = useCheckout(); // eslint-disable-line react-hooks/rules-of-hooks -- hooks falsos, sin React
    await checkout.start("entreno", "anual");
    expect(location.assign).toHaveBeenCalledWith(url);
  }

  it("Tilopay desde Mi plan (página de otro dominio): un InitiateCheckout al salir", async () => {
    await startWith("https://app.tilopay.com/pay/abc");
    expect(initiates(fbq.mock.calls)).toHaveLength(1);
    await flush();
    expect(beacons.map((b) => b.name)).toEqual(["checkout_view"]);
    expect(beacons[0].props.event_id).toBe((fbq.mock.calls[0][3] as { eventID: string }).eventID);
  });

  it("ONVO: no lo manda al salir, porque /pago/checkout lo cuenta al abrir (no se duplica)", async () => {
    await startWith("/pago/checkout?s=sub_1");
    expect(fbq).not.toHaveBeenCalled();
  });

  function findCardForm(n: ReactNode): ReactElement<{ onStart?: () => void }> | null {
    if (!n || typeof n !== "object") return null;
    if (Array.isArray(n)) { for (const x of n) { const f = findCardForm(x); if (f) return f; } return null; }
    const el = n as ReactElement<{ children?: ReactNode }>;
    if (el.type === CardForm) return el as ReactElement<{ onStart?: () => void }>;
    return findCardForm(el.props?.children);
  }
  const panel = (demo = false) => CardPanel({ step: "trial", charge: null, card: null, demo, payments: true, initial: { plan: "entreno", billing: "mes" }, tz: "America/Costa_Rica", betaFirstPaid: "1 de diciembre" });

  it("tarjeta en Mi plan (card-panel): un solo InitiateCheckout aunque envíe el formulario dos veces", () => {
    const form = findCardForm(panel());
    expect(form?.props.onStart).toBeTypeOf("function");
    form!.props.onStart!();
    form!.props.onStart!();
    const ic = initiates(fbq.mock.calls);
    expect(ic).toHaveLength(1);
    expect(ic[0][2]).toEqual({ value: 9.99, currency: "USD", content_name: "entreno" });
  });

  it("en modo demo no se manda", () => {
    findCardForm(panel(true))!.props.onStart!();
    expect(fbq).not.toHaveBeenCalled();
  });

  it("CardForm llama onStart al enviar, con ONVO y con Tilopay", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
    const submitWith = async () => {
      const onStart = vi.fn();
      const form = CardForm({ choice: { plan: "entreno", billing: "mes" }, demo: false, submitLabel: "Pagar", note: null, onSaved() {}, onStart }) as ReactElement<{ onSubmit: (e: unknown) => Promise<void> }>;
      await form.props.onSubmit({ preventDefault() {} });
      return onStart;
    };
    expect(await submitWith()).toHaveBeenCalledTimes(1);
    tilopay = true;
    expect(await submitWith()).toHaveBeenCalledTimes(1);
  });
});
