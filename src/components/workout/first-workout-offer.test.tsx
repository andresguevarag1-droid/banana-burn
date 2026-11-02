import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/analytics", () => ({ FunnelTracker: ({ view, props }: { view: string; props?: Record<string, string> }) => <span data-view={view} data-where={props?.where} /> }));
import { OfferCard } from "./first-workout-offer";

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
