// Renovaciones con Tilopay (y el paso después del primer mes con 50 % en ONVO): qué hacer después de cada intento y las
// marcas que dejamos en subscriptions.last_renewal_error. Pura y testeada (sin "server-only").

/** Intentos de renovación antes de cancelar (uno al vencer y uno por día después). */
export const RENEWAL_MAX_ATTEMPTS = 3;

/**
 * Marcas en last_renewal_error (las escribe SIEMPRE el mismo UPDATE que reclama la fila, antes de llamar al procesador):
 *   "por confirmar:<orden o intento>"  se mandó un cobro y no sabemos el resultado: solo se consulta, nunca se cobra de nuevo.
 *   "revisar:<orden o intento>"        lleva más de un día por confirmar: alerta y fila en app_errors; se sigue consultando.
 *   "enviado:<id>"                     (ONVO) ya se creó la suscripción normal: se espera su webhook.
 *   "reemplazar"                       (ONVO) la persona cambió la tarjeta de una suscripción con la renovación fallida:
 *                                      se crea una suscripción nueva con la tarjeta nueva (onvo-intro.ts).
 * Cualquier otro texto es el motivo del último rechazo.
 */
export const PENDING_PREFIX = "por confirmar:";
export const REVIEW_PREFIX = "revisar:";
export const SENT_PREFIX = "enviado:";
export const REPLACE_MARKER = "reemplazar";
/** Más de esto por confirmar: pasa a revisión del equipo. */
export const RENEWAL_REVIEW_AFTER_MS = 24 * 3600_000;

/** ¿Hay un cobro en vuelo para esta fila? (no se puede cobrar de nuevo hasta saber qué pasó). */
export const renewalInFlight = (marker: string | null | undefined) =>
  !!marker && (marker.startsWith(PENDING_PREFIX) || marker.startsWith(REVIEW_PREFIX) || marker.startsWith(SENT_PREFIX));
/** Orden (o intento) que quedó por confirmar, o null. */
export const pendingRef = (marker: string | null | undefined) =>
  !marker ? null : marker.startsWith(PENDING_PREFIX) ? marker.slice(PENDING_PREFIX.length) : marker.startsWith(REVIEW_PREFIX) ? marker.slice(REVIEW_PREFIX.length) : null;

export type RenewalStep =
  | { do: "renewed" }
  | { do: "retry"; status: "past_due"; nextAt: string }
  | { do: "cancel" }
  | { do: "wait"; nextAt: string };

/** Qué hacer después de un intento de renovación. Pura y testeada. */
export function renewalNext(attempt: number, outcome: "approved" | "declined" | "unknown" | "sin_tarjeta", now = new Date()): RenewalStep {
  if (outcome === "approved") return { do: "renewed" };
  // Sin respuesta: no se reintenta a ciegas; se consulta la orden en una hora.
  if (outcome === "unknown") return { do: "wait", nextAt: new Date(now.getTime() + 3600_000).toISOString() };
  if (attempt >= RENEWAL_MAX_ATTEMPTS) return { do: "cancel" };
  return { do: "retry", status: "past_due", nextAt: new Date(now.getTime() + 864e5).toISOString() };
}

/**
 * Llave única del cobro (0062) después de un intento: se libera solo si se sabe que no se cobró (rechazo o sin tarjeta, que
 * llevan a reintento o cancelación). Aprobado o sin respuesta: queda reservada (cobrado o por confirmar: nunca otro cobro).
 */
export const releaseKeyAfter = (step: RenewalStep) => step.do === "retry" || step.do === "cancel";
