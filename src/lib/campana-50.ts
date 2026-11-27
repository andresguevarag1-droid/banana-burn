// #332: campaña "primer mes al 50 %" para las cuentas creadas antes de la tarjeta obligatoria (CARD_REQUIRED_FROM).
// Reglas puras (campana-50.test.ts); la lectura y el envío están en campana-50-server.ts y el botón en /admin/campana-50.
//
// - Segmentos: "entrenaron" (al menos 1 entreno terminado) y "sin_entreno" (nunca terminó uno).
// - Fuera: staff, testers, cortesías o meses gratis vigentes (incluye condominios), quien ya pagó, quien tiene un cobro en
//   curso (programado, cobrando, pendiente), quien se dio de baja de los correos y quien ya recibió esta campaña.
// - La oferta dura OFFER_DAYS desde el envío: el primer cobro mensual va al 50 % (promoFor con offer en trial.ts).
import { CARD_REQUIRED_FROM } from "./card-required";
import { DAY_MS } from "./trial";

export const CAMPAIGN = "campana_50_actuales" as const;
export const OFFER_DAYS = 14;
export const BATCH_SIZE = 50;

export type CampaignSegment = "entrenaron" | "sin_entreno";

export type CampaignInput = {
  createdAt: string | null | undefined;
  staff: boolean;
  tester: boolean;
  comp: boolean;
  paid: boolean;
  /** trial_charges en curso: scheduled, charging, pending, unknown o retry_scheduled. */
  chargeInFlight: boolean;
  emailReminders: boolean;
  alreadySent: boolean;
  workouts: number;
};

/** Segmento de la cuenta, o null si no recibe la campaña. */
export function campaignSegment(i: CampaignInput, cardRequiredFrom = CARD_REQUIRED_FROM): CampaignSegment | null {
  const c = Date.parse(i.createdAt ?? "");
  if (!Number.isFinite(c) || c >= Date.parse(cardRequiredFrom)) return null;
  if (i.staff || i.tester || i.comp || i.paid || i.chargeInFlight || !i.emailReminders || i.alreadySent) return null;
  return i.workouts > 0 ? "entrenaron" : "sin_entreno";
}

export const offerExpiry = (sentAt: Date) => new Date(sentAt.getTime() + OFFER_DAYS * DAY_MS).toISOString();

/** ¿La oferta sigue vigente? */
export const offerActive = (row: { expires_at: string } | null | undefined, now = new Date()) =>
  Boolean(row) && Date.parse(row!.expires_at) > now.getTime();

export const CHARGE_IN_FLIGHT = ["scheduled", "charging", "pending", "unknown", "retry_scheduled"] as const;
