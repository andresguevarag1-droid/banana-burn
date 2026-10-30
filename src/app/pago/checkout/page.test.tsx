import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ANNUAL_SEASON_NOTE, PLANS, annualSaving } from "@/lib/plans";
import { money } from "@/lib/copy";

const { subscription } = vi.hoisted(() => ({ subscription: { plan: "entreno", billing: "mes", status: "incomplete", provider_customer_id: "customer" } }));
vi.mock("@/lib/supabase/server", () => ({
  getViewer: async () => ({ id: "viewer", tz: "America/Costa_Rica" }),
  createClient: async () => ({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: subscription }) }) }) }) }) }),
}));
vi.mock("@/components/analytics", () => ({ FunnelTracker: ({ view }: { view: string }) => <span data-view={view} /> }));
vi.mock("./onvo-pay-form", () => ({ OnvoPayForm: () => <div data-testid="onvo-form" /> }));
import CheckoutPage from "./page";

afterEach(() => vi.unstubAllEnvs());

describe("Presentación del checkout", () => {
  for (const plan of PLANS) for (const billing of ["mes", "anual"] as const) {
    it(`${plan.id} ${billing}: precio, periodicidad y acceso al formulario`, async () => {
      vi.stubEnv("NEXT_PUBLIC_ONVO_PUBLISHABLE_KEY", "test-key");
      Object.assign(subscription, { plan: plan.id, billing });
      const html = renderToStaticMarkup(await CheckoutPage({ searchParams: Promise.resolve({ s: "subscription" }) }));
      expect(html).toContain(plan.name.replaceAll("&", "&amp;"));
      expect(html).toContain(`${money(plan.price[billing])} USD`);
      expect(html).toContain(billing === "mes" ? "Hoy y cada mes" : "Hoy y cada año");
      expect(html).toContain(money(annualSaving(plan)));
      expect(html).toContain('data-view="checkout_view"');
      expect(html).toContain("Cancela cuando quieras");
      expect(html).toContain("Continuar sin tarjeta");
      expect(html).toContain("No sustituye la indicación de tu médico.");
      expect(html.indexOf('data-testid="onvo-form"')).toBeLessThan(html.indexOf("¿Qué pasa después del pago?"));
      if (billing === "mes") expect(html).toContain(`/app/suscripcion?plan=${plan.id}&amp;pago=anual`);
      else {
        expect(html).toContain(ANNUAL_SEASON_NOTE);
        expect(html).not.toContain("checkout-cambiar-anual");
      }
      if (plan.excluded.length) expect(html).toContain('class="line-through"');
    });
  }
});
