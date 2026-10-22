// Intención de compra de un visitante sin sesión: sobrevive al registro y al onboarding.
// La landing la guarda en una cookie (no httpOnly: la escribe el navegador) y /app/suscripcion la lee.
import { PLANS, type Billing, type PlanId } from "./plans";

export const INTENT_COOKIE = "bb_checkout";
export const INTENT_MAX_AGE = 60 * 60 * 24; // 1 día

export type CheckoutIntent = { plan: PlanId; billing: Billing };

export function parseIntent(plan: unknown, billing: unknown): CheckoutIntent | null {
  const p = PLANS.find((x) => x.id === plan);
  if (!p || (billing !== "mes" && billing !== "anual")) return null;
  return { plan: p.id, billing };
}

/** Valor de cookie `plan.billing`, p. ej. `completo.anual`. */
export const encodeIntent = (i: CheckoutIntent) => `${i.plan}.${i.billing}`;
export function decodeIntent(v: string | null | undefined): CheckoutIntent | null {
  if (!v) return null;
  const [plan, billing] = v.split(".");
  return parseIntent(plan, billing);
}

/** Ruta a la que hay que mandar al usuario para retomar la compra. */
export const intentPath = (i: CheckoutIntent) => `/app/suscripcion?plan=${i.plan}&pago=${i.billing}`;
