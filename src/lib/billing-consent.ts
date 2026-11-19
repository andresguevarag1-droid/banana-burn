// Consentimiento del cobro recurrente (#329, Ley 7472 y evidencia ante contracargos). Justo arriba del botón que guarda la
// tarjeta (bienvenida, Mi plan, condominio, primera serie y antes de ir a Tilopay) se dice qué se cobra, cuándo y cada cuánto.
// Al tocar el botón el navegador manda `consent: { version, first_amount_minor, full_amount_minor }`: lo que la persona vio.
// El servidor lo compara con lo que va a cobrar (409 con los montos correctos si no coincide), guarda una fila en
// billing_consents (0074) y, sin esa fila, no programa ni cobra un plan nuevo (saveVerifiedCard en trial-billing.ts).
// Si cambia el texto, cambia CONSENT_VERSION: cada fila dice qué versión aceptó la persona.
import { PLANS, type Billing, type PlanId } from "./plans";
import { usd2 } from "./num";
import { amountMinorFor, firstChargeMinor, PROMO_ID } from "./trial";
import { tr, type T } from "./i18n/t";
import { DEFAULT_LOCALE } from "./i18n/locale";

/** Versión del texto de consentimiento. Cambia si cambia el texto (se guarda en billing_consents.text_version). */
export const CONSENT_VERSION = "2026-11-19";

/** Lo que la persona vio arriba del botón: el texto y sus montos en centavos (los manda el navegador al tocarlo). */
export type ConsentShown = { text: string; firstMinor: number; fullMinor: number };

/** Cuerpo `consent` que manda el navegador (card-form.tsx). */
export const consentBody = (c: ConsentShown) => ({ version: CONSENT_VERSION, first_amount_minor: c.firstMinor, full_amount_minor: c.fullMinor });

const minor = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n > 0;

/** Montos que la persona aceptó con la versión vigente del texto; null si no lo aceptó (o mandó algo que no es). */
export function consentGiven(raw: unknown): { firstMinor: number; fullMinor: number } | null {
  const r = raw && typeof raw === "object" ? (raw as { version?: unknown; first_amount_minor?: unknown; full_amount_minor?: unknown }) : null;
  if (!r || r.version !== CONSENT_VERSION || !minor(r.first_amount_minor) || !minor(r.full_amount_minor)) return null;
  return { firstMinor: r.first_amount_minor, fullMinor: r.full_amount_minor };
}

/** Consentimiento del cuerpo de la petición, con el país de la conexión (nunca la IP); null si no lo aceptó. */
export function consentAccepted(raw: unknown, h: Headers): { ipCountry: string | null; firstMinor: number; fullMinor: number } | null {
  const c = consentGiven(raw);
  return c && { ...c, ipCountry: ipCountryOf(h) };
}

/** Montos del consentimiento en centavos: el primer cobro (con el 50 % si aplica, solo mensual) y el normal de cada periodo. */
export function consentAmounts(plan: PlanId, billing: Billing, promo: boolean): { firstMinor: number; fullMinor: number } {
  return { firstMinor: firstChargeMinor(plan, billing, promo ? PROMO_ID : null), fullMinor: amountMinorFor(plan, billing) };
}

/**
 * El texto que va arriba del botón. `day`: fecha del primer cobro ya escrita ("30 de noviembre"); null si todavía no se
 * sabe ("al terminar tu prueba"). `today`: el primer cobro es ahora (la prueba ya terminó): no dice "Hoy no se cobra nada".
 */
export function consentLine(i: ConsentTerms, t: T = tr(DEFAULT_LOCALE)): string {
  return consentFor(i, t).text;
}

export type ConsentTerms = { button: string; plan: PlanId; billing: Billing; promo: boolean; day: string | null; today?: boolean };

/** El texto de consentLine con sus montos, para mandarlos al tocar el botón. */
export function consentFor(i: ConsentTerms, t: T = tr(DEFAULT_LOCALE)): ConsentShown {
  const { firstMinor, fullMinor } = consentAmounts(i.plan, i.billing, i.promo);
  const vars = {
    button: i.button, day: i.day ?? "", first: usd2(firstMinor / 100), full: usd2(fullMinor / 100),
    plan: t(PLANS.find((p) => p.id === i.plan)!.name), every: i.billing === "anual" ? t("cada año") : t("cada mes"),
  };
  const text = i.today ? t("Al tocar «{button}» autorizas que hoy se cobre {first} ({plan}) y luego {full} {every}, hasta que canceles en Mi plan.", vars)
    : !i.day ? t("Al tocar «{button}» autorizas que al terminar tu prueba se cobre {first} ({plan}) y luego {full} {every}, hasta que canceles en Mi plan. Hoy no se cobra nada.", vars)
    : t("Al tocar «{button}» autorizas que el {day} se cobre {first} ({plan}) y luego {full} {every}, hasta que canceles en Mi plan. Hoy no se cobra nada.", vars);
  return { text, firstMinor, fullMinor };
}

/** País de la conexión (cabecera de Vercel), solo el código de 2 letras. Nunca la IP. */
export const ipCountryOf = (h: Headers): string | null => {
  const c = h.get("x-vercel-ip-country")?.trim().toUpperCase() ?? "";
  return /^[A-Z]{2}$/.test(c) ? c : null;
};
