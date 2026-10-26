// Login con Google y Apple dentro de la app nativa: el sistema muestra su propia hoja de login (Credential Manager en
// Android, Google Sign-In y "Continuar con Apple" en iPhone) y devuelve un id token que Supabase valida con
// signInWithIdToken. La sesión queda en las mismas cookies que la web. Solo se carga dentro de la app (import()).
//
// Nonce: el proveedor recibe el SHA-256 y Supabase el valor original; así un id token robado no sirve para otra sesión.
import { createClient } from "@/lib/supabase/client";
import { NATIVE_AUTH } from "./auth-options";

export type SocialProvider = "google" | "apple";
export type SocialResult = { ok: true } | { ok: false; canceled: boolean };

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

async function nonces() {
  const raw = hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
  const hashed = hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)));
  return { raw, hashed };
}

/** La persona cerró la hoja de login: no es un error que haya que mostrar. */
const isCancel = (e: unknown) => /cancel|canceled|cancelled|1001|12501|16:|user denied|dismiss/i.test(String((e as { message?: string })?.message ?? e));

let ready: Promise<typeof import("@capgo/capacitor-social-login")> | null = null;

function plugin() {
  ready ??= import("@capgo/capacitor-social-login").then(async (m) => {
    await m.SocialLogin.initialize({
      google: NATIVE_AUTH.googleWebClientId
        ? { webClientId: NATIVE_AUTH.googleWebClientId, iOSClientId: NATIVE_AUTH.googleIosClientId || undefined, iOSServerClientId: NATIVE_AUTH.googleWebClientId, mode: "online" }
        : undefined,
      // En iPhone, "Continuar con Apple" usa el sistema: sin redirección.
      apple: NATIVE_AUTH.apple ? { redirectUrl: "" } : undefined,
    });
    return m;
  });
  return ready;
}

export async function signInNative(provider: SocialProvider): Promise<SocialResult> {
  try {
    const { SocialLogin } = await plugin();
    const { raw, hashed } = await nonces();
    const res =
      provider === "google"
        ? await SocialLogin.login({ provider: "google", options: { scopes: ["email", "profile"], nonce: hashed } })
        : await SocialLogin.login({ provider: "apple", options: { scopes: ["email", "name"], nonce: hashed } });
    const idToken = (res.result as { idToken?: string | null }).idToken;
    if (!idToken) return { ok: false, canceled: false };
    const { error } = await createClient().auth.signInWithIdToken({ provider, token: idToken, nonce: raw });
    if (error) return { ok: false, canceled: false };
    return { ok: true };
  } catch (e) {
    return { ok: false, canceled: isCancel(e) };
  }
}
