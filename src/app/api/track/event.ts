// Eventos del embudo (sin terceros). Lo que llega del navegador se valida aquí antes de registrarse.

/** Eventos permitidos. Cualquier otro nombre se descarta. */
export const FUNNEL_EVENTS = [
  "page_view",
  "cta_click",
  "trial_banner_view",
  "plan_wall_view",
  "checkout_view",
  "purchase_success",
  "onboarding_done",
  "card_banner_view",
  "card_saved",
] as const;
export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

export type FunnelProps = Record<string, string | number | boolean>;
export type CleanEvent = { name: FunnelEvent; props: FunnelProps };

const MAX_PROPS = 12;
const KEY = /^[a-z][a-z0-9_]{0,31}$/;
const PII = /@|\d[\d\s.-]{6,}\d/;

/** Valida y recorta un evento. Devuelve null si no es válido. Nunca acepta objetos anidados ni textos largos. */
export function cleanEvent(raw: unknown): CleanEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const { name, props } = raw as { name?: unknown; props?: unknown };
  if (typeof name !== "string" || !(FUNNEL_EVENTS as readonly string[]).includes(name)) return null;
  const out: FunnelProps = {};
  if (props && typeof props === "object" && !Array.isArray(props)) {
    for (const [k, v] of Object.entries(props as Record<string, unknown>).slice(0, MAX_PROPS)) {
      if (!KEY.test(k)) continue;
      // Nunca correos ni números largos (teléfono, cédula, tarjeta) en el log, aunque el cliente los mande.
      if (typeof v === "string") { if (!PII.test(v)) out[k] = v.slice(0, 120); }
      else if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
      else if (typeof v === "boolean") out[k] = v;
    }
  }
  return { name: name as FunnelEvent, props: out };
}
