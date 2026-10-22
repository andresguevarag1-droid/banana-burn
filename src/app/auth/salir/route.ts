import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isSameOrigin } from "@/lib/security";
import { safeNext } from "@/lib/security/redirect";

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return new NextResponse("Origen no permitido", { status: 403 });
  if (isSupabaseConfigured) await (await createClient()).auth.signOut();
  const form = await req.formData().catch(() => null);
  const next = safeNext(form?.get("next"), "/");
  return NextResponse.redirect(new URL(next, req.url), { status: 303 });
}
