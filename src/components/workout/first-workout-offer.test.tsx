import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/analytics", () => ({ FunnelTracker: ({ view, props }: { view: string; props?: Record<string, string> }) => <span data-view={view} data-where={props?.where} /> }));
import { ExitOfferCard, OfferCard, claimExitOffer } from "./first-workout-offer";
import { FUNNEL_EVENTS, ONCE_PER_ACCOUNT } from "@/app/api/track/event";
import { PROMO_ID, amountMinorFor, firstChargeMinor, promoFor } from "@/lib/trial";
import { usd2 } from "@/lib/num";

const html = (billing: "anual" | "mes") => renderToStaticMarkup(<OfferCard billing={billing} onBilling={() => {}} onDismiss={() => {}} />);

describe("Tarjeta de oferta del primer entreno", () => {
  it("anual preseleccionado, con su ahorro y el primer mes al 50 % como opción", () => {
    const h = html("anual");
    expect(h).toContain("Terminaste tu primer entreno");
    expect(h).toContain("Sigue con tu plan");
    expect(h).toMatch(/checked="" value="anual"/);
    expect(h).not.toMatch(/checked="" value="mes"/);
    expect(h).toContain("$59.99/año");
    expect(h).toContain("Ahorras $59.89 al año");
    expect(h).toContain("Primer mes a $4.99 dejando tu tarjeta");
    expect(h).toContain("IVA incluido");
    expect(h).toContain("Cancela cuando quieras en 2 toques.");
    expect(h).toContain("Activar mi plan");
    expect(h).toContain("Ahora no");
    expect(h).toContain('href="/app/suscripcion?plan=entreno&amp;pago=anual#tarjeta"');
    expect(h).toContain('data-view="plan_wall_view" data-where="primer-entreno"');
  });

  it("no usa el 'equivale a $5 al mes' (choca con el primer mes a $4.99)", () => {
    expect(html("anual")).not.toMatch(/equivale/i);
  });

  it("con mensual elegido, el botón va al plan mensual", () => {
    expect(html("mes")).toContain('href="/app/suscripcion?plan=entreno&amp;pago=mes#tarjeta"');
  });
});

describe("Oferta de salida (#227)", () => {
  const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

  it("aparece una sola vez por cuenta", () => {
    const st = memory();
    expect(claimExitOffer(st, "u1")).toBe(true);
    expect(claimExitOffer(st, "u1")).toBe(false);
    expect(claimExitOffer(st, "u1")).toBe(false);
    expect(claimExitOffer(st, "u2")).toBe(true);
    expect(ONCE_PER_ACCOUNT.has("plan_wall_exit_offer")).toBe(true);
    expect(FUNNEL_EVENTS).toContain("plan_wall_exit_offer");
  });

  it("usa el 50 % que ya existe y los montos coinciden con el cobro de la tarjeta guardada", () => {
    const h = renderToStaticMarkup(<ExitOfferCard onDismiss={() => {}} />).replaceAll("\u00a0", " ");
    expect(h).toContain("Antes de irte: 50 % en tu primer mes si dejas tu tarjeta hoy");
    // Quien ve la tarjeta está en su prueba: guardar la tarjeta gana la promoción y el primer cobro es el de abajo.
    expect(promoFor("prueba", false)).toBe(PROMO_ID);
    expect(h).toContain(`primer mes a <b class="tabular-nums">${usd2(firstChargeMinor("entreno", "mes", PROMO_ID) / 100)}</b>`);
    expect(h).toContain(`${usd2(amountMinorFor("entreno", "mes") / 100)}/mes`);
    expect(h).toContain("$4.99");
    expect(h).toContain("IVA incluido");
    expect(h).toContain('href="/app/suscripcion?plan=entreno&amp;pago=mes#tarjeta"');
    expect(h).toContain("No, gracias");
    expect(h).not.toMatch(/equivale/i);
  });
});
