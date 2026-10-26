// Qué hacer con un enlace dentro de la app nativa. Puro y probado (links.test.ts); lo usa boot.ts.
//
// - Nuestro dominio: se queda en la app.
// - Otra página web: se abre con @capacitor/browser (Safari o Chrome dentro de la app, con su botón de cerrar), así la
//   persona no sale de Banana Burn.
// - WhatsApp, correo, teléfono: los abre el sistema (la app de WhatsApp, el correo).

export const OWN_HOSTS = ["www.bananaburn.app", "bananaburn.app"] as const;

const SYSTEM_SCHEMES = new Set(["mailto:", "tel:", "sms:", "whatsapp:", "geo:", "maps:"]);
const SYSTEM_HOSTS = new Set(["wa.me", "api.whatsapp.com", "chat.whatsapp.com", "apps.apple.com", "itunes.apple.com", "play.google.com"]);

export type LinkAction = "app" | "browser" | "system" | "ignore";

function parse(href: string, base: string): URL | null {
  try {
    return new URL(href, base);
  } catch {
    return null;
  }
}

const isOwnHost = (host: string, currentHost: string) => host === currentHost || (OWN_HOSTS as readonly string[]).includes(host);

/** `currentOrigin`: el origen de la página (en la app, el de server.url; en un preview, el del preview). */
export function linkAction(href: string, currentOrigin: string): LinkAction {
  const u = parse(href, currentOrigin);
  if (!u) return "ignore";
  if (SYSTEM_SCHEMES.has(u.protocol)) return "system";
  if (u.protocol !== "https:" && u.protocol !== "http:") return "ignore";
  if (isOwnHost(u.host, new URL(currentOrigin).host)) return "app";
  if (SYSTEM_HOSTS.has(u.host)) return "system";
  return "browser";
}

/**
 * Ruta interna de un deep link (Universal Link o App Link): "/app/entreno?x=1" si el enlace es nuestro, si no null.
 * Normaliza el dominio sin www y descarta lo que no sea https.
 */
export function deepLinkPath(url: string, currentOrigin: string): string | null {
  const u = parse(url, currentOrigin);
  if (!u || u.protocol !== "https:" || !isOwnHost(u.host, new URL(currentOrigin).host)) return null;
  const path = `${u.pathname}${u.search}${u.hash}`;
  return path.startsWith("/") && !path.startsWith("//") ? path : null;
}

/** Rutas que se resuelven en el servidor (route handlers): hay que cargarlas completas, no con el router de Next. */
export const needsFullLoad = (path: string) => /^\/(auth|api)\//.test(path);
