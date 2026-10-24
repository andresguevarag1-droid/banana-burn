// Meta Pixel (navegador) + API de Conversiones (servidor) para medir los anuncios de Meta.
// Un solo mapa de eventos del embudo a eventos estándar de Meta, compartido por los dos lados para que Meta
// deduplique con el mismo event_id. Nunca se envían datos de salud, correos ni ids de usuario.
import type { FunnelEvent, FunnelProps } from "@/app/api/track/event";
import { clean } from "@/lib/env";
import { PLANS, type Billing, type PlanId } from "@/lib/plans";

/** Píxel "Banana Burn" (dataset 1544502257509303, negocio Naviro/Atlas). El ID no es secreto. NEXT_PUBLIC_META_PIXEL_ID=off lo apaga. */
const DEFAULT_PIXEL_ID = "1544502257509303";
export function pixelIdFrom(env: Record<string, string | undefined>): string {
  const v = clean(env.NEXT_PUBLIC_META_PIXEL_ID);
  if (v.toLowerCase() === "off") return "";
  return /^\d{10,20}$/.test(v) ? v : DEFAULT_PIXEL_ID;
}
export const META_PIXEL_ID = pixelIdFrom({ NEXT_PUBLIC_META_PIXEL_ID: process.env.NEXT_PUBLIC_META_PIXEL_ID });

/** Rutas donde el píxel no corre: panel de administración y callbacks técnicos. */
export const PIXEL_SKIP = /^\/(admin|auth|api)(\/|$)/;

/** Botones que llevan a crear la cuenta o a elegir plan (data-cta). */
const LEAD_CTA = /^(hero|final|nav|sticky|glp1-(hero|final|sticky|banda)|registro-[a-z]+|precios?-[a-z0-9-]+|plan-[a-z0-9-]+)$/;

export type MetaEvent = { name: string; custom?: boolean; params: Record<string, string | number> };

const planValue = (plan: unknown, billing: unknown): number | null => {
  const p = PLANS.find((x) => x.id === plan || x.name === plan);
  if (!p) return null;
  const b: Billing = billing === "anual" ? "anual" : "mes";
  return p.price[b];
};

/**
 * Traduce un evento del embudo a un evento de Meta. null = no se envía a Meta.
 * page_view no se mapea: el componente del píxel ya registra PageView en cada cambio de ruta.
 */
export function toMetaEvent(name: FunnelEvent, props: FunnelProps = {}): MetaEvent | null {
  switch (name) {
    case "cta_click": {
      const cta = typeof props.cta === "string" ? props.cta : "";
      // Los botones que llevan a crear la cuenta cuentan como Lead (señal temprana para optimizar con poco volumen).
      if (LEAD_CTA.test(cta)) return { name: "Lead", params: { content_name: cta.slice(0, 60) } };
      return null;
    }
    case "onboarding_done":
      return { name: "CompleteRegistration", params: { status: props.trial ? "trial" : "registered" } };
    case "checkout_view": {
      const value = planValue(props.plan, props.billing);
      return { name: "InitiateCheckout", params: value == null ? {} : { value, currency: "USD", content_name: String(props.plan) } };
    }
    case "card_saved":
      return { name: "AddPaymentInfo", params: {} };
    case "purchase_success": {
      const value = planValue(props.plan, props.billing);
      return { name: "Subscribe", params: value == null ? { currency: "USD" } : { value, currency: "USD", predicted_ltv: value * (props.billing === "anual" ? 1 : 6) } };
    }
    case "plan_wall_view":
      return { name: "ViewContent", params: { content_name: "planes" } };
    default:
      return null;
  }
}

/** Precio del plan para eventos de compra (exportado para pruebas). */
export const priceOf = (plan: PlanId, billing: Billing) => planValue(plan, billing);

/** Id corto y aleatorio para deduplicar navegador y servidor. */
export function newEventId(): string {
  const r = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return r.replace(/[^a-z0-9-]/gi, "").slice(0, 40);
}
