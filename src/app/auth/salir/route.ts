import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export async function POST(req: NextRequest) {
  if (isSupabaseConfigured) await (await createClient()).auth.signOut();
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
