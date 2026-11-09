// Eventos del embudo (sin terceros). Lo que llega del navegador se valida aquí antes de registrarse.
import { LANDING_VARIANTS } from "@/lib/landing-variants";

/** Eventos permitidos. Cualquier otro nombre se descarta. */
export const FUNNEL_EVENTS = [
  "page_view",
  // Portada (#285): qué hero vio, "general" o el utm_content del anuncio (LANDING_VARIANTS).
  "landing_variant_view",
  "cta_click",
  "trial_banner_view",
  "plan_wall_view",
  // Oferta de salida del muro de planes (#227): "Ahora no" muestra una vez el 50 % del primer mes dejando la tarjeta.
  "plan_wall_exit_offer",
  "checkout_view",
  "purchase_success",
  "onboarding_done",
  "card_banner_view",
  // Cada pedido de tarjeta (#280): dónde se vio (CARD_ASK_WHERE). card_saved lleva el mismo `where` del pedido que funcionó.
  "card_ask_view",
  "card_saved",
  "install_view",
  "install_click",
  "app_installed",
  "push_enabled",
  // Entreno (0061): saber dónde se van, porque la fila de workouts solo existe al guardar.
  "hoy_view",
  "workout_open",
  // Primer entreno (#273): vio el primer ejercicio y todavía no hizo la serie. Separa irse antes de verlo o después.
  "workout_first_set_view",
  "workout_first_set",
  "workout_summary",
  "workout_saved",
  "workout_leave",
  // Hábito semanal (#288): Hoy mostró la meta de la semana ("1 de 3 entrenos") y la cumplió (una vez por semana).
  "weekly_goal_view",
  "weekly_goal_done",
  // Dentro del entreno (sin datos personales): empezar el ejercicio, cada serie, saltar descanso, cambiar, ver cómo se hace.
  "brief_start",
  "set_done",
  "rest_skip",
  "exercise_swap",
  "help_open",
  // El coach se presenta (#198): tocó una respuesta de la burbuja del coach (resumen del primer entreno u Hoy).
  "coach_prompt_tap",
  // Opinión del tercer entreno (#238): se vio la tarjeta y se envió (estrellas, con texto, permiso para publicar).
  "testimonial_view",
  "testimonial_sent",
  // Registro (#236): dónde se cae entre tocar "Empezar" y la cuenta creada. Solo códigos fijos, nunca el correo.
  // signup_view lleva `inapp` (#235): si llegó dentro de Instagram o Facebook, donde no se muestra Google.
  "signup_view",
  "signup_submit",
  "signup_error",
  "onboarding_step",
] as const;
export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

/** Eventos que cuentan una sola vez por cuenta: el navegador los guarda en sessionStorage y /api/track rechaza el segundo. */
export const ONCE_PER_ACCOUNT: ReadonlySet<FunnelEvent> = new Set<FunnelEvent>(["onboarding_done", "plan_wall_exit_offer"]);

/** Cómo se intenta crear la cuenta en /entrar?modo=registro. */
export const SIGNUP_METHODS = ["password", "code", "google", "apple"] as const;
export type SignupMethod = (typeof SIGNUP_METHODS)[number];
/** Motivo corto de un registro fallido (ver signupReason en src/app/(auth)/entrar/validate.ts). */
export const SIGNUP_ERRORS = ["invalid_email", "weak_password", "email_taken", "rate_limit", "bad_code", "network", "oauth_blocked", "other"] as const;
export type SignupErrorReason = (typeof SIGNUP_ERRORS)[number];
/** Dónde se pide la tarjeta (#280). "dia6" es el correo del día 6: se cuenta al llegar a Mi plan desde su enlace. */
export const CARD_ASK_WHERE = ["bienvenida", "hoy-banner", "primer-entreno", "primera-serie", "salida", "mi-plan", "muro", "dia6"] as const;
export type CardAskWhere = (typeof CARD_ASK_WHERE)[number];
/** Pasos de la bienvenida que cuentan en onboarding_step: 0 a 6 (la oferta de la tarjeta ya tiene card_banner_view). */
export const ONBOARDING_STEPS = 7;

/**
 * Eventos del registro con forma fija: solo `path` y su único dato permitido. Lo demás se descarta, y si el dato no es uno
 * de los valores conocidos el evento entero se rechaza (así nunca entra texto libre, como un correo).
 */
const STRICT: Partial<Record<string, { key?: string; ok?: (v: unknown) => boolean }>> = {
  signup_view: { key: "inapp", ok: (v) => typeof v === "boolean" },
  signup_submit: { key: "method", ok: (v) => (SIGNUP_METHODS as readonly unknown[]).includes(v) },
  signup_error: { key: "reason", ok: (v) => (SIGNUP_ERRORS as readonly unknown[]).includes(v) },
  landing_variant_view: { key: "variant", ok: (v) => (LANDING_VARIANTS as readonly unknown[]).includes(v) },
  card_ask_view: { key: "where", ok: (v) => (CARD_ASK_WHERE as readonly unknown[]).includes(v) },
  onboarding_step: { key: "step", ok: (v) => Number.isInteger(v) && (v as number) >= 0 && (v as number) < ONBOARDING_STEPS },
};

export type FunnelProps = Record<string, string | number | boolean>;
export type CleanEvent = { name: FunnelEvent; props: FunnelProps };

const MAX_PROPS = 12;
const KEY = /^[a-z][a-z0-9_]{0,31}$/;
const PII = /@|\d[\d\s.-]{6,}\d/;
const EVENT_ID = /^[a-z0-9-]{8,40}$/i;

/** Valida y recorta un evento. Devuelve null si no es válido. Nunca acepta objetos anidados ni textos largos. */
export function cleanEvent(raw: unknown): CleanEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const { name, props } = raw as { name?: unknown; props?: unknown };
  if (typeof name !== "string" || !(FUNNEL_EVENTS as readonly string[]).includes(name)) return null;
  const out: FunnelProps = {};
  const strict = STRICT[name];
  if (strict) {
    const p = (props && typeof props === "object" && !Array.isArray(props) ? props : {}) as Record<string, unknown>;
    if (strict.key && !strict.ok?.(p[strict.key])) return null;
    if (typeof p.path === "string" && !PII.test(p.path)) out.path = p.path.slice(0, 120);
    if (strict.key) out[strict.key] = p[strict.key] as string | number;
    return { name: name as FunnelEvent, props: out };
  }
  if (props && typeof props === "object" && !Array.isArray(props)) {
    for (const [k, v] of Object.entries(props as Record<string, unknown>).slice(0, MAX_PROPS)) {
      if (!KEY.test(k)) continue;
      // Nunca correos ni números largos (teléfono, cédula, tarjeta) en el log, aunque el cliente los mande.
      // event_id: id aleatorio para deduplicar con Meta (puede tener dígitos seguidos; no es dato personal).
      if (k === "event_id") { if (typeof v === "string" && EVENT_ID.test(v)) out[k] = v; continue; }
      if (typeof v === "string") { if (!PII.test(v)) out[k] = v.slice(0, 120); }
      else if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
      else if (typeof v === "boolean") out[k] = v;
    }
  }
  return { name: name as FunnelEvent, props: out };
}
