// ¿La petición viene de la app nativa? La app (Capacitor) agrega "BananaBurnApp/<cascarón> (ios|android)" al user agent
// (capacitor.config.ts). Puro y probado (platform-ua.test.ts): lo usan el servidor (platform-server.ts), el middleware y
// el navegador (platform.ts).
//
// El user agent se puede falsear: solo sirve para decidir qué se MUESTRA (por ejemplo, esconder los pagos web dentro de
// la app). Nada de acceso ni de dinero se decide con esto.

export type NativePlatform = "ios" | "android";
export type AppPlatform = NativePlatform | "web";

/** Lo que dice el user agent de la app: plataforma y número de cascarón (sube cuando cambia lo nativo que la web usa). */
export type NativeAgent = { platform: NativePlatform; shell: number };

const APP_UA = /\bBananaBurnApp\/(\d{1,4}) \((ios|android)\)/;

export function nativeAgentFrom(ua: string | null | undefined): NativeAgent | null {
  const m = APP_UA.exec(ua ?? "");
  if (!m) return null;
  return { platform: m[2] as NativePlatform, shell: Number(m[1]) };
}

export const platformFromUserAgent = (ua: string | null | undefined): AppPlatform => nativeAgentFrom(ua)?.platform ?? "web";
