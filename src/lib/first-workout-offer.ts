// Oferta al terminar el primer entreno (#199): el pico de motivación es el resumen del primer entreno, no el día 7.
// Los montos salen de las mismas funciones que cobran (firstChargeMinor, la que usa el cobro de la tarjeta guardada, y
// amountMinorFor, la del checkout), y los precios de plans.ts ya llevan el IVA incluido: lo que se muestra es lo que se cobra.
import { PLANS, annualSaving, type Billing, type PlanId } from "./plans";
import { PROMO_ID, amountMinorFor, firstChargeMinor } from "./trial";
import type { Entitlements } from "./entitlements";

/** Plan de la oferta: Entreno (el que se usa en el primer entreno). Su ahorro anual es $59.89 y su primer mes al 50 %, $4.99. */
export const OFFER_PLAN: PlanId = "entreno";

/** Clave de "Ahora no" en este teléfono: una vez cerrada, la tarjeta no vuelve (se ve luego en Mi plan desde el perfil). */
export const offerDismissKey = (userId: string) => `bb.first-offer-dismiss.${userId}`;
/** Clave de la oferta de salida (#227): se ve una sola vez por cuenta en este teléfono; /api/track repite el freno por cuenta. */
export const exitOfferKey = (userId: string) => `bb.exit-offer.${userId}`;

/** Mi plan con el plan y el periodo ya elegidos, directo al formulario de la tarjeta. */
export const activateHref = (billing: Billing = "anual", plan: PlanId = OFFER_PLAN) => `/app/suscripcion?plan=${plan}&pago=${billing}#tarjeta`;

/**
 * ¿Le ofrecemos activar su plan? Solo en la prueba gratis, sin tarjeta guardada, sin cobro programado y sin haber pagado
 * nunca (cardStep "trial" ya exige que no haya acceso pagado ni fila en trial_charges). A quien ya pagó o dejó su tarjeta
 * no le cambia nada.
 */
export function canActivatePlan(ent: Pick<Entitlements, "access" | "status" | "card" | "charge" | "cardStep">): boolean {
  return ent.access === "trial" && ent.cardStep === "trial" && !ent.card && !ent.charge && (ent.status === "none" || ent.status === "incomplete");
}

/** Los montos de la tarjeta, en USD con IVA incluido. */
export function firstWorkoutOffer(plan: PlanId = OFFER_PLAN) {
  const p = PLANS.find((x) => x.id === plan)!;
  return {
    plan,
    name: p.name,
    /** Anual: se paga completo, sin el 50 % (PROMO_TERMS). */
    annual: firstChargeMinor(plan, "anual", PROMO_ID) / 100,
    annualSaving: annualSaving(p),
    /** Primer mes con el 50 % por dejar la tarjeta lista. */
    monthFirst: firstChargeMinor(plan, "mes", PROMO_ID) / 100,
    /** Desde el segundo mes. */
    month: amountMinorFor(plan, "mes") / 100,
  };
}
