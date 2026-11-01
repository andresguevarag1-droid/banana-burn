import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLANS } from "@/lib/plans";
import { usd2 } from "@/lib/num";

const doc = readFileSync("docs/activacion-primer-entreno.md", "utf8");

describe("netos documentados de la activación", () => {
  for (const plan of PLANS) {
    for (const billing of ["mes", "anual"] as const) {
      it(`${plan.name}, ${billing}: usa el precio vigente, IVA y ambas comisiones`, () => {
        const price = plan.price[billing];
        const label = `${plan.name} ${billing === "mes" ? "mensual" : "anual"}`;
        const net = (fee: number) => usd2(price / 1.13 - price * fee - 0.35);
        expect(doc).toContain(`| ${label} | ${usd2(price)} | ${net(0.039)} | ${net(0.0425)} |`);
      });
    }
  }
});
