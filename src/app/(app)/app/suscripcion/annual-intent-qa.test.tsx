import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { parseIntent } from "@/lib/checkout-intent";
import { PLANS } from "@/lib/plans";
import { usd2 } from "@/lib/num";
import { SubscriptionManager } from "./manager";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("QA: intención anual desde un mensual activo", () => {
  it.each(PLANS)("ofrece el anual del mismo plan $id antes de cobrar", (plan) => {
    const query = new URLSearchParams(`plan=${plan.id}&pago=anual`);
    const intent = parseIntent(query.get("plan"), query.get("pago"));
    const html = renderToStaticMarkup(<SubscriptionManager
      current={{ plan: plan.id, billing: "mes", status: "active", endsAt: null, fromSubscription: true, cancellable: true }}
      intent={intent} payments demo={false}
    />);
    expect(html).toContain(`Estás a un paso: ${plan.name}, anual`);
    expect(html).toContain(usd2(plan.price.anual));
    expect(html).toContain("Reemplaza tu plan actual en cuanto se confirme el pago (sin prorrateo).");
    expect(html).toContain('data-cta="manager-intent"');
    expect(html).toContain("Continuar al pago");
  });
});
