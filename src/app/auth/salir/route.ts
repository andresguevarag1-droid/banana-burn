import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isSameOrigin } from "@/lib/security";

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return new NextResponse("Origen no permitido", { status: 403 });
  if (isSupabaseConfigured) await (await createClient()).auth.signOut();
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
