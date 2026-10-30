import { DAY_MS, firstChargeMinor, PROMO_ID } from "./trial";
import type { Entitlements } from "./entitlements";

/** Días de 24 horas desde el alta: día 5 = [alta + 4 días, alta + 5 días). */
export function trialCardNotice(ent: Pick<Entitlements, "access" | "trial" | "card" | "charge" | "cardStep">, now = new Date()) {
  if (ent.access !== "trial" || !ent.trial || ent.trial.beta || ent.card?.active || ent.charge || ent.cardStep !== "trial") return null;
  const remaining = Date.parse(ent.trial.endsAt) - now.getTime();
  if (!Number.isFinite(remaining) || remaining <= 0 || remaining > 3 * DAY_MS) return null;
  return { day: 8 - Math.ceil(remaining / DAY_MS), chargeAt: ent.trial.endsAt,
    entreno: firstChargeMinor("entreno", "mes", PROMO_ID) / 100,
    completo: firstChargeMinor("completo", "mes", PROMO_ID) / 100 };
}
