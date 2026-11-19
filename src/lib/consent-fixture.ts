// Pruebas (#329): el consentimiento que manda la pantalla, con los montos que mostró (consentAmounts de billing-consent.ts).
import { CONSENT_VERSION, consentAmounts } from "./billing-consent";
import type { Billing, PlanId } from "./plans";

/** Para saveCard / startTilopayCard. `promo`: si el texto mostraba el 50 % del primer mes (solo cuenta con mensual). */
export const accept = (plan: PlanId, billing: Billing, promo = true, ipCountry: string | null = "CR") => ({ ipCountry, ...consentAmounts(plan, billing, promo) });

/** Cuerpo `consent` de /api/pagos/tarjeta y /api/pagos/tilopay. */
export const acceptBody = (plan: PlanId, billing: Billing, promo = true) => {
  const a = consentAmounts(plan, billing, promo);
  return { version: CONSENT_VERSION, first_amount_minor: a.firstMinor, full_amount_minor: a.fullMinor };
};

/** Campos del consentimiento en el estado firmado de la vuelta de Tilopay. */
export const acceptState = (plan: PlanId, billing: Billing, promo = true) => {
  const a = consentAmounts(plan, billing, promo);
  return { c: CONSENT_VERSION, fa: a.firstMinor, fu: a.fullMinor };
};
