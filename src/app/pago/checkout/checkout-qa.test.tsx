import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PLANS, annualSaving } from "@/lib/plans";
import { money } from "@/lib/copy";
import { parseIntent } from "@/lib/checkout-intent";
import { toMetaEvent } from "@/lib/meta-pixel";

const { subscription } = vi.hoisted(() => ({ subscription: { plan: "entreno", billing: "mes", status: "incomplete", provider_customer_id: "customer" } }));
vi.mock("@/lib/supabase/server", () => ({
  getViewer: async () => ({ id: "viewer", tz: "America/Costa_Rica" }),
  createClient: async () => ({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: subscription }) }) }) }) }) }),
}));
vi.mock("@/components/analytics", () => ({ FunnelTracker: () => null }));
vi.mock("./onvo-pay-form", () => ({ OnvoPayForm: () => <div data-testid="onvo-form" /> }));
import CheckoutPage from "./page";

const doc = readFileSync("docs/qa/checkout-cro.md", "utf8");
const render = async (plan: string, billing: string) => {
  vi.stubEnv("NEXT_PUBLIC_ONVO_PUBLISHABLE_KEY", "test-key");
  Object.assign(subscription, { plan, billing });
  const html = renderToStaticMarkup(await CheckoutPage({ searchParams: Promise.resolve({ s: "subscription" }) }));
  vi.unstubAllEnvs();
  return html.replaceAll("&amp;", "&");
};

describe("QA #112: checkout", () => {
  it("el enlace a anual lo entiende Mi plan como el mismo plan en anual", async () => {
    for (const plan of PLANS) {
      const html = await render(plan.id, "mes");
      const tag = html.match(/<a [^>]*data-cta="checkout-cambiar-anual"[^>]*>/)?.[0];
      const href = tag?.match(/href="([^"]+)"/)?.[1];
      expect(href).toBeDefined();
      const q = new URL(href!, "https://bananaburn.app").searchParams;
      expect(parseIntent(q.get("plan"), q.get("pago"))).toEqual({ plan: plan.id, billing: "anual" });
      expect(html).toContain(`Cambiar a anual: ${money(plan.price.anual)}, ahorra ${money(annualSaving(plan))}`);
    }
  });

  it("no muestra puntuación doble, emojis ni menciones de IA", async () => {
    for (const plan of PLANS) for (const billing of ["mes", "anual"]) {
      const text = (await render(plan.id, billing)).replace(/<[^>]+>/g, " ");
      expect(text).not.toMatch(/\.\./);
      expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(text).not.toMatch(/\bIA\b|inteligencia artificial/i);
      expect(text).not.toContain("—");
    }
  });

  it("checkout_view sigue mapeando a InitiateCheckout y card_saved a AddPaymentInfo", () => {
    expect(toMetaEvent("checkout_view", { plan: "completo", billing: "anual" })?.name).toBe("InitiateCheckout");
    expect(toMetaEvent("card_saved")?.name).toBe("AddPaymentInfo");
  });

  it("las cifras del documento salen de plans.ts", () => {
    for (const plan of PLANS) {
      const row = doc.split("\n").find((l) => l.startsWith(`| ${plan.name} |`));
      expect(row, plan.name).toBeDefined();
      expect(row).toContain(money(plan.price.mes));
      expect(row).toContain(money(plan.price.anual));
      expect(row).toContain(money(annualSaving(plan)));
      expect(row).toContain(money(Math.round((plan.price.anual - plan.price.mes) * 100) / 100));
    }
    const [e, c] = PLANS;
    for (const v of [e.price.mes * 10, c.price.mes * 10, e.price.anual * 10, c.price.anual * 10]) expect(doc).toContain(money(Math.round(v * 100) / 100));
  });
});
