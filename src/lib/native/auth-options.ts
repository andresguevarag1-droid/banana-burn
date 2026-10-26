// Qué botones de login social muestra la app nativa. Puro y probado (auth-options.test.ts).
//
// Google no deja su login dentro de un WebView, así que en la app se usa el login nativo de cada sistema y la sesión se
// crea con supabase.auth.signInWithIdToken (src/lib/native/auth.ts). Regla 4.8 de Apple: si la app de iPhone ofrece
// Google, también tiene que ofrecer "Continuar con Apple"; por eso en iOS Google solo aparece si Apple está listo.
import type { AppPlatform } from "@/lib/platform-ua";

export type NativeAuthConfig = {
  /** Cliente OAuth "Aplicación web" de Google (el mismo proyecto que el de Supabase). */
  googleWebClientId: string;
  /** Cliente OAuth "iOS" de Google (bundle app.bananaburn). */
  googleIosClientId: string;
  /** Apple activo en Supabase con el bundle app.bananaburn como Client ID. */
  apple: boolean;
};

const CLIENT_ID = /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/;

export function nativeAuthConfigFrom(env: { web?: string; ios?: string; apple?: string }): NativeAuthConfig {
  const id = (v?: string) => {
    const s = (v ?? "").trim();
    return CLIENT_ID.test(s) ? s : "";
  };
  return { googleWebClientId: id(env.web), googleIosClientId: id(env.ios), apple: (env.apple ?? "").trim() === "1" };
}

// Literales: Next solo incrusta en el navegador las NEXT_PUBLIC_ escritas completas.
export const NATIVE_AUTH = nativeAuthConfigFrom({
  web: process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  ios: process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  apple: process.env.NEXT_PUBLIC_NATIVE_APPLE_AUTH,
});

export type SocialButtons = { google: boolean; apple: boolean };

export function socialButtonsFor(platform: AppPlatform, cfg: NativeAuthConfig, webGoogle: boolean): SocialButtons {
  if (platform === "web") return { google: webGoogle, apple: false };
  if (platform === "android") return { google: Boolean(cfg.googleWebClientId), apple: false };
  const apple = cfg.apple;
  return { apple, google: apple && Boolean(cfg.googleWebClientId && cfg.googleIosClientId) };
}
