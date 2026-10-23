// Muro de planes en el servidor (pura y testeada). La usa el middleware: sin plan ni prueba vigente, una página de /app
// que pide plan ni siquiera se ejecuta en el servidor (se reescribe a Mi plan y el muro se dibuja encima). Así ningún dato
// de una sección pagada viaja al navegador, ni en la carga inicial ni en la navegación del lado del cliente.
// Las acciones del servidor y las API validan por su cuenta (accessError / getEntitlements) y la base lo repite con RLS.

/** Rutas que siempre se pueden abrir sin plan: la cuenta, el pago y "Invita y gana" (invitar es una forma de ganar meses). */
export const ALWAYS_OPEN = ["/app/perfil", "/app/suscripcion", "/app/referidos"];
export const isAlwaysOpen = (path: string) => ALWAYS_OPEN.some((p) => path === p || path.startsWith(p + "/"));

/** A dónde se reescribe una página con muro: su contenido es solo de la persona y el muro la tapa en el cliente. */
export const WALL_PATH = "/app/suscripcion";

/**
 * ¿Hay que comprobar el acceso antes de servir esta petición?
 * - Solo páginas de /app (no /admin, no API, no /bienvenida) y solo lecturas (GET/HEAD).
 * - Las server actions (cabecera Next-Action) validan por su cuenta: reescribirlas rompería la respuesta.
 */
export function needsAccessCheck(r: { path: string; method: string; isAction: boolean }): boolean {
  if (r.isAction) return false;
  if (r.method !== "GET" && r.method !== "HEAD") return false;
  if (r.path !== "/app" && !r.path.startsWith("/app/")) return false;
  return !isAlwaysOpen(r.path);
}

/** Decisión final: `rewrite` solo si la base confirmó que NO hay acceso. Un error de la base no bloquea (falla abierta: el layout y RLS siguen). */
export function gateAction(r: { path: string; method: string; isAction: boolean; signedIn: boolean; hasAccess: boolean | null }): "pass" | "rewrite" {
  if (!r.signedIn || !needsAccessCheck(r)) return "pass";
  return r.hasAccess === false ? "rewrite" : "pass";
}

/** Cabecera para todo lo privado: nunca en cachés compartidas ni en el disco del navegador. */
export const PRIVATE_NO_STORE = "private, no-store";
export const isPrivatePath = (path: string) => /^\/(app|admin|bienvenida|pago|r)(\/|$)/.test(path) || path === "/entrar";
