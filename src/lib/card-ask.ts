// Pedidos de tarjeta (#280): dónde se pidió y cómo se lleva ese dato hasta card_saved. Cada enlace al formulario de Mi plan
// lleva ?desde=<where>; Mi plan lo lee y lo guarda en card_saved. Sin ?desde, el pedido es el de Mi plan.
import { CARD_ASK_WHERE, type CardAskWhere } from "@/app/api/track/event";
import { DAY_MS, firstChargeMinor, PROMO_ID, amountMinorFor, promoApplies, promoPrice } from "./trial";
import { PLANS, type Billing, type PlanId } from "./plans";
import { usd2 } from "./num";
import type { Entitlements } from "./entitlements";

export type { CardAskWhere };

/** El `desde` de la URL si es un pedido conocido; si no, null (nunca entra texto libre). */
export function askWhere(v: unknown): CardAskWhere | null {
  return typeof v === "string" && (CARD_ASK_WHERE as readonly string[]).includes(v) ? (v as CardAskWhere) : null;
}

/** El mismo enlace con ?desde=<where>, antes del #ancla. */
export function withDesde(href: string, where: CardAskWhere): string {
  const [path, hash] = href.split("#");
  return `${path}${path.includes("?") ? "&" : "?"}desde=${where}${hash ? `#${hash}` : ""}`;
}

/** Último día de la prueba con el banner de Hoy. El día 7 lo cubre el aviso de TrialCardNotice. */
export const HOY_CARD_LAST_DAY = 6;

/**
 * Banner de Hoy (#280): del día 1 al 6 de la prueba, sin tarjeta ni cobro, entrene o no. Días de 24 horas desde el alta,
 * igual que trialCardNotice: `left` es lo que realmente le queda (7 el día 1, 2 el día 6). Montos del plan Entreno mensual (OFFER_PLAN),
 * de las mismas funciones que cobran.
 */
export function hoyCardBanner(ent: Pick<Entitlements, "access" | "trial" | "card" | "charge" | "cardStep">, now = new Date()) {
  if (ent.access !== "trial" || !ent.trial || ent.trial.beta || ent.card?.active || ent.charge || ent.cardStep !== "trial") return null;
  const remaining = Date.parse(ent.trial.endsAt) - now.getTime();
  if (!Number.isFinite(remaining) || remaining <= 0) return null;
  const left = Math.ceil(remaining / DAY_MS);
  const day = 8 - left;
  if (day < 1 || day > HOY_CARD_LAST_DAY) return null;
  return { day, left, first: firstChargeMinor("entreno", "mes", PROMO_ID) / 100, month: amountMinorFor("entreno", "mes") / 100 };
}

/** "Cerrar" del pedido tras la primera serie: no vuelve en este teléfono. */
export const firstSetAskKey = (userId: string) => `bb.first-set-card.${userId}`;

/** Botón de la tarjeta opcional en la bienvenida (#280): el beneficio en dólares ("$4.99 tu primer mes, en lugar de $9.99"). */
export function cardOfferLabel(c: { plan: PlanId; billing: Billing }): string {
  if (!promoApplies(PROMO_ID, c.billing)) return "Dejar mi tarjeta lista";
  return `Dejar mi tarjeta: ${usd2(promoPrice(c.plan))} tu primer mes, en lugar de ${usd2(PLANS.find((p) => p.id === c.plan)!.price.mes)}`;
}
