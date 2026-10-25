import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/lib/email";
import { safeNext as toSafePath } from "@/lib/security/redirect";
import { isSupabaseConfigured } from "@/lib/env";
import { attributeNewAccount } from "@/lib/attribution-server";

/** Tipos de enlace de correo aceptados (lista cerrada) → tipo de verifyOtp. */
const OTP_TYPES = { email: "email", magiclink: "email", signup: "signup", recovery: "recovery", email_change: "email_change", invite: "invite" } as const;
/** Después de un enlace de recuperación siempre se va a fijar la contraseña nueva. */
const RESET_PATH = "/entrar/nueva-clave";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  if (!isSupabaseConfigured) return NextResponse.redirect(`${origin}/entrar`);
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const recovery = type === "recovery";
  // Solo rutas relativas del mismo sitio (sin //, \, esquemas ni caracteres de control).
  const safeNext = recovery ? RESET_PATH : toSafePath(searchParams.get("next"), "/app");
  // Enlaces con token_hash (plantilla de correo de Supabase con {{ .TokenHash }}): funcionan aunque se abran en otro dispositivo.
  const tokenHash = searchParams.get("token_hash");
  if (tokenHash && tokenHash.length <= 512 && type && Object.hasOwn(OTP_TYPES, type)) {
    const otpType = OTP_TYPES[type as keyof typeof OTP_TYPES];
    const sb = await createClient();
    const { data, error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type: otpType });
    if (!error) {
      if (data.user && (otpType === "signup" || otpType === "invite")) {
        await sendWelcomeEmail({ userId: data.user.id, to: data.user.email ?? undefined }).catch(() => {});
        await attributeNewAccount(data.user.id, data.user.email); // invitación: solo cuentas nuevas (la base lo valida)
      }
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }
  if (code && code.length <= 512) {
    const sb = await createClient();
    const { data, error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) {
      if (data.user && !recovery) {
        await sendWelcomeEmail({ userId: data.user.id, to: data.user.email ?? undefined }).catch(() => {});
        await attributeNewAccount(data.user.id, data.user.email); // Google o enlace de correo: la base solo atribuye cuentas de menos de 72 h
      }
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }
  return NextResponse.redirect(`${origin}/entrar?error=${recovery ? "recuperacion" : "1"}`);
}
