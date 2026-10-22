import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/lib/email";
import { safeNext as toSafePath } from "@/lib/security/redirect";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const safeNext = toSafePath(searchParams.get("next"), "/app");
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
