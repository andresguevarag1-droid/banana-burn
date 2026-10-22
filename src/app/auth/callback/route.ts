import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/lib/email";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";
  // Enlaces con token_hash (plantilla de correo de Supabase con {{ .TokenHash }}): funcionan aunque se abran en otro dispositivo.
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  if (tokenHash && (type === "email" || type === "magiclink" || type === "signup")) {
    const sb = await createClient();
    const { data, error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type: type === "signup" ? "signup" : "email" });
    if (!error) {
      if (data.user && type === "signup") await sendWelcomeEmail({ userId: data.user.id, to: data.user.email ?? undefined }).catch(() => {});
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }
  if (code) {
    const sb = await createClient();
    const { data, error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) {
      if (data.user) await sendWelcomeEmail({ userId: data.user.id, to: data.user.email ?? undefined }).catch(() => {});
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }
  return NextResponse.redirect(`${origin}/entrar?error=1`);
}
