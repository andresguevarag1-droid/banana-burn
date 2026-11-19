// Consentimiento del cobro recurrente (#329, Ley 7472 y evidencia ante contracargos). Justo arriba del botón que guarda la
// tarjeta (bienvenida, Mi plan, condominio, primera serie y antes de ir a Tilopay) se dice qué se cobra, cuándo y cada cuánto.
// Al tocar el botón el navegador manda `consent: CONSENT_VERSION`; el servidor guarda una fila en billing_consents (0074)
// con los montos y la fecha que él mismo calcula y, sin esa fila, no programa el cobro (saveVerifiedCard en trial-billing.ts).
// Si cambia el texto, cambia CONSENT_VERSION: cada fila dice qué versión aceptó la persona.
import { PLANS, type Billing, type PlanId } from "./plans";
import { usd2 } from "./num";
import { amountMinorFor, firstChargeMinor, PROMO_ID } from "./trial";
import { tr, type T } from "./i18n/t";
import { DEFAULT_LOCALE } from "./i18n/locale";

/** Versión del texto de consentimiento. Cambia si cambia el texto (se guarda en billing_consents.text_version). */
export const CONSENT_VERSION = "2026-11-19";

/** ¿El navegador mandó el consentimiento de la versión vigente? */
export const consentGiven = (raw: unknown): boolean => raw === CONSENT_VERSION;

/** Montos del consentimiento en centavos: el primer cobro (con el 50 % si aplica, solo mensual) y el normal de cada periodo. */
export function consentAmounts(plan: PlanId, billing: Billing, promo: boolean): { firstMinor: number; fullMinor: number } {
  return { firstMinor: firstChargeMinor(plan, billing, promo ? PROMO_ID : null), fullMinor: amountMinorFor(plan, billing) };
}

/**
 * El texto que va arriba del botón. `day`: fecha del primer cobro ya escrita ("30 de noviembre"); null si todavía no se
 * sabe ("al terminar tu prueba"). `today`: el primer cobro es ahora (la prueba ya terminó): no dice "Hoy no se cobra nada".
 */
export function consentLine(i: { button: string; plan: PlanId; billing: Billing; promo: boolean; day: string | null; today?: boolean }, t: T = tr(DEFAULT_LOCALE)): string {
  const { firstMinor, fullMinor } = consentAmounts(i.plan, i.billing, i.promo);
  const vars = {
    button: i.button, day: i.day ?? "", first: usd2(firstMinor / 100), full: usd2(fullMinor / 100),
    plan: t(PLANS.find((p) => p.id === i.plan)!.name), every: i.billing === "anual" ? t("cada año") : t("cada mes"),
  };
  if (i.today) return t("Al tocar «{button}» autorizas que hoy se cobre {first} ({plan}) y luego {full} {every}, hasta que canceles en Mi plan.", vars);
  if (!i.day) return t("Al tocar «{button}» autorizas que al terminar tu prueba se cobre {first} ({plan}) y luego {full} {every}, hasta que canceles en Mi plan. Hoy no se cobra nada.", vars);
  return t("Al tocar «{button}» autorizas que el {day} se cobre {first} ({plan}) y luego {full} {every}, hasta que canceles en Mi plan. Hoy no se cobra nada.", vars);
}

/** País de la conexión (cabecera de Vercel), solo el código de 2 letras. Nunca la IP. */
export const ipCountryOf = (h: Headers): string | null => {
  const c = h.get("x-vercel-ip-country")?.trim().toUpperCase() ?? "";
  return /^[A-Z]{2}$/.test(c) ? c : null;
};
