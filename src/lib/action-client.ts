// Llamar acciones de servidor desde el navegador sin que una falla de red rompa la pantalla.
// Una acción rechaza (en vez de responder { ok: false }) cuando no hay señal, el servidor no responde o hubo un deploy.

export function netMessage(online = typeof navigator === "undefined" ? true : navigator.onLine) {
  return online ? "No pudimos conectar. Intenta de nuevo." : "Sin conexión. Intenta de nuevo cuando tengas señal.";
}

/**
 * Convierte el rechazo de una acción en `{ ok: false, error }`, con la misma forma que sus errores normales.
 * Así los rollbacks optimistas y los mensajes de cada pantalla funcionan igual sin señal.
 */
export function safeAction<T extends { ok?: boolean; error?: string }>(p: Promise<T>): Promise<T> {
  return p.catch(() => ({ ok: false, error: netMessage() }) as unknown as T);
}
