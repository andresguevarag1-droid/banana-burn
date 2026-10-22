import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/lib/email";
import { safeNext as toSafePath } from "@/lib/security/redirect";

/** Tipos de enlace de correo aceptados (lista cerrada) → tipo de verifyOtp. */
const OTP_TYPES = { email: "email", magiclink: "email", signup: "signup" } as const;

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  // Solo rutas relativas del mismo sitio (sin //, \, esquemas ni caracteres de control).
  const safeNext = toSafePath(searchParams.get("next"), "/app");
  // Enlaces con token_hash (plantilla de correo de Supabase con {{ .TokenHash }}): funcionan aunque se abran en otro dispositivo.
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  if (tokenHash && tokenHash.length <= 512 && type && Object.hasOwn(OTP_TYPES, type)) {
    const otpType = OTP_TYPES[type as keyof typeof OTP_TYPES];
    const sb = await createClient();
    const { data, error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type: otpType });
    if (!error) {
      if (data.user && otpType === "signup") await sendWelcomeEmail({ userId: data.user.id, to: data.user.email ?? undefined }).catch(() => {});
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }
  if (code && code.length <= 512) {
    const sb = await createClient();
    const { data, error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) {
      if (data.user) await sendWelcomeEmail({ userId: data.user.id, to: data.user.email ?? undefined }).catch(() => {});
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }
  return NextResponse.redirect(`${origin}/entrar?error=1`);
}
