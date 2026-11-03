// #254: de la bienvenida a Hoy sin ofrecer la tarjeta. La oferta va después del primer entreno (#199) y en Mi plan.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("bienvenida sin oferta de tarjeta (#254)", () => {
  const page = readFileSync("src/app/bienvenida/page.tsx", "utf8");
  it("el paso de la tarjeta solo se abre en la demo con ?vista=tarjeta", () => {
    expect(page).toContain("cardOffer={startOnCard}");
    expect(page).not.toContain("cardOffer={cardOffer}");
    expect(page).toMatch(/const startOnCard = v\.demo && cardOffer && vista === "tarjeta";/);
  });
  it("sin el paso de la tarjeta, Crear mi plan guarda y va directo a Hoy", () => {
    const w = readFileSync("src/app/bienvenida/wizard.tsx", "utf8");
    expect(w).toContain("if (cardOffer && !saved) { go(STEPS); return; }");
    expect(w).toContain('router.replace(demo ? "/app?primera=1" : "/app");');
  });
});
