// Renovaciones con Tilopay: qué hacer después de cada intento. Pura y testeada (sin "server-only").

/** Intentos de renovación antes de cancelar (uno al vencer y uno por día después). */
export const RENEWAL_MAX_ATTEMPTS = 3;

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

