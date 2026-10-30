import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isSameOrigin } from "@/lib/security";
import { hitLimit, tooMany } from "@/lib/security/limits";
import { loginLinkSecret, signLoginToken } from "@/lib/email/login-link";
import { handoffPath } from "@/lib/handoff";

export const dynamic = "force-dynamic";

/**
 * Pase de navegador (ver lib/handoff.ts): quien está dentro de Instagram o Facebook y abre la app en Safari o Chrome
 * para instalarla llega allá con la sesión. Devuelve la misma ruta de la app con un pase de un solo uso que vence en
 * 30 minutos. Solo con sesión, solo desde la app y con tope por cuenta.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return new Response(null, { status: 403 });
  if (!isSupabaseConfigured) return NextResponse.json({ path: null });
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return new Response(null, { status: 401 });
  const lim = await hitLimit("auth:pase", `u:${uid}`);
  if (!lim.ok) return tooMany(lim);
  const secret = loginLinkSecret();
  if (!secret) return NextResponse.json({ path: null });
  const body = (await req.json().catch(() => null)) as { next?: unknown } | null;
  const path = handoffPath(typeof body?.next === "string" ? body.next : null, signLoginToken(uid, secret, Date.now(), undefined, true));
  return NextResponse.json({ path }, { headers: { "Cache-Control": "no-store" } });
}
