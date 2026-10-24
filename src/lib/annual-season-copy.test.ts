import { describe, expect, it } from "vitest";
import { offer } from "@/lib/offer";
import { ANNUAL_SEASON_NOTE } from "@/lib/plans";
import { faq } from "@/app/(marketing)/content";

// El plan anual incluye 1 temporada deportiva gratis (0047): lo dicen precios, la oferta y las preguntas frecuentes.
describe("copy del plan anual con temporada incluida", () => {
  it("la oferta lo dice antes y después del lanzamiento", () => {
    for (const d of ["2026-10-24T12:00:00Z", "2027-02-01T12:00:00Z"]) expect(offer(new Date(d)).pricingIntro(17)).toMatch(/1 temporada deportiva gratis/);
  });
  it("las preguntas frecuentes lo explican sin marcas registradas", () => {
    const all = JSON.stringify(faq(new Date("2026-10-24T12:00:00Z")));
    expect(all).toMatch(/1 temporada deportiva gratis|incluye 1 gratis/);
    expect(all).not.toMatch(/crossfit|—/i);
    expect(ANNUAL_SEASON_NOTE).toBe("Incluye 1 temporada deportiva gratis");
  });
});
