import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLANS, annualSaving } from "./plans";
import { amountMinorFor, firstChargeMinor, promoFor } from "./trial";
import { activateHref, canActivatePlan, firstWorkoutOffer } from "./first-workout-offer";
import { parseIntent } from "./checkout-intent";
import type { Entitlements } from "./entitlements";

type Ent = Parameters<typeof canActivatePlan>[0];
const trial: Ent = { access: "trial", status: "none", card: null, charge: null, cardStep: "trial" };

describe("Oferta del primer entreno: montos", () => {
  const o = firstWorkoutOffer();
  const entreno = PLANS.find((p) => p.id === "entreno")!;

  it("muestra los montos de la issue: anual con su ahorro en dólares y el primer mes al 50 %", () => {
    expect(o).toMatchObject({ plan: "entreno", annual: 59.99, annualSaving: 59.89, monthFirst: 4.99, month: 9.99 });
  });

  it("coincide con lo que cobra el checkout (plan.price, IVA incluido)", () => {
    // /pago/checkout cobra plan.price[billing] y dice "Precios en USD, IVA incluido": el IVA no se suma después.
    const checkout = readFileSync("src/app/pago/checkout/page.tsx", "utf8");
    expect(checkout).toContain("const price = plan.price[row.billing");
    expect(checkout).toContain("IVA incluido");
    expect(o.annual).toBe(entreno.price.anual);
    expect(o.month).toBe(entreno.price.mes);
    expect(o.annualSaving).toBe(annualSaving(entreno));
  });

  it("coincide con el primer cobro de la tarjeta guardada en la prueba (con el 50 % solo en mensual)", () => {
    const promo = promoFor("prueba", false);
    expect(Math.round(o.monthFirst * 100)).toBe(firstChargeMinor("entreno", "mes", promo));
    expect(Math.round(o.annual * 100)).toBe(firstChargeMinor("entreno", "anual", promo));
    expect(Math.round(o.annual * 100)).toBe(amountMinorFor("entreno", "anual"));
  });

  it("lleva a Mi plan con el plan y el periodo elegidos, directo a la tarjeta", () => {
    expect(activateHref()).toBe("/app/suscripcion?plan=entreno&pago=anual#tarjeta");
    expect(activateHref("mes")).toBe("/app/suscripcion?plan=entreno&pago=mes#tarjeta");
  });

  it("Mi plan lee ese plan y periodo tal cual (la elección de la tarjeta no se pierde)", () => {
    for (const billing of ["anual", "mes"] as const) {
      const query = new URL(activateHref(billing), "https://bananaburn.app").searchParams;
      expect(parseIntent(query.get("plan"), query.get("pago"))).toEqual({ plan: "entreno", billing });
    }
  });
});

describe("Oferta del primer entreno: a quién", () => {
  it("sale en la prueba sin tarjeta ni cobro", () => {
    expect(canActivatePlan(trial)).toBe(true);
  });

  it("no cambia nada para quien ya pagó o tiene tarjeta guardada", () => {
    const card = { brand: "visa", last4: "4242", expMonth: 1, expYear: 2030, active: true };
    expect(canActivatePlan({ ...trial, card })).toBe(false);
    expect(canActivatePlan({ ...trial, charge: {} as NonNullable<Entitlements["charge"]> })).toBe(false);
    expect(canActivatePlan({ ...trial, access: "subscription", status: "active", cardStep: "none" })).toBe(false);
    for (const status of ["active", "canceling", "canceled", "past_due", "expired"] as const) expect(canActivatePlan({ ...trial, status })).toBe(false);
    expect(canActivatePlan({ ...trial, cardStep: "none" })).toBe(false);
    expect(canActivatePlan({ ...trial, cardStep: "pay", access: "none" })).toBe(false);
  });

  it("no sale en demo, cortesía ni equipo", () => {
    for (const access of ["demo", "comp", "staff", "manual"] as const) expect(canActivatePlan({ ...trial, access })).toBe(false);
  });

  it("sale solo en el primer entreno guardado: la página la decide con los entrenos guardados (no con el cliente)", () => {
    const page = readFileSync("src/app/(app)/app/entreno/page.tsx", "utf8");
    expect(page).toContain("const firstOffer = !everSaved && canActivatePlan(ent) ? v.id : undefined;");
    const player = readFileSync("src/app/(app)/app/entreno/player.tsx", "utf8");
    // Solo si este guardado es nuevo (no un reenvío ni una repetición del día).
    expect(player).toContain("const fresh = !!saved?.ok && !saved.demo && !saved.already;");
    expect(player).toContain("firstOffer={fresh && !saved?.repeat ? firstOffer : undefined}");
  });
});
