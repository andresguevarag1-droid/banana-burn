import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SEED } from "./challenge-seed";
import { ALL_PROGRAM_SEED } from "./program-seed";
import { priceMinor } from "./challenges";
import { PLANS, PREMIUM_RETOS_NOTE } from "./plans";
import { usd2 } from "./num";
import { renderToStaticMarkup } from "react-dom/server";
import { PurchaseNote } from "@/components/retos/purchase-note";

const doc = readFileSync("docs/upsell-retos.md", "utf8");
const net = (amount: number, rate = 0.039) => amount / 1.13 - amount * rate - 0.35;

describe("oferta de retos", () => {
  it("documenta el neto de cada reto y programa con los descuentos reales", () => {
    const catalog = new Map([...SEED, ...ALL_PROGRAM_SEED].filter((c) => c.priceUsd > 0).map((c) => [c.slug, c]));
    for (const [slug, c] of catalog) {
      const columns = [0, 10, 15, 20].map((discount) => usd2(net(priceMinor(c.priceUsd, discount) / 100)));
      expect(doc).toContain(`| ${c.title} (${slug}) | ${usd2(c.priceUsd)} | ${columns.join(" | ")} | ${usd2(net(c.priceUsd, 0.0425))} |`);
    }
  });

  it("mantiene las cifras de referencia de los planes y separa compras de suscripciones", () => {
    for (const plan of PLANS) {
      expect(doc).toContain(usd2(plan.price.mes));
      expect(doc).toContain(usd2(plan.price.anual));
      expect(doc).toContain(usd2(net(plan.price.mes) * 100));
    }
    expect(doc).toContain("status = 'pagado'");
    expect(doc).toContain("no registra visitas al detalle ni clics");
  });

  it("aclara el pago adicional y no promete nutrición con la compra", () => {
    const html = renderToStaticMarkup(<PurchaseNote nutrition />);
    expect(html).toContain(PREMIUM_RETOS_NOTE);
    expect(html).toContain("Necesitas un plan activo");
    expect(html).toContain("<s>Nutrición incluida con esta compra</s>");
    expect(html).toContain("Precio con IVA incluido");
    expect(renderToStaticMarkup(<PurchaseNote />)).not.toContain("<s>");
  });
});
