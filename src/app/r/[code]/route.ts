import { NextResponse } from "next/server";
import { REF_COOKIE, REF_COOKIE_MAX_AGE, normalizeCode } from "@/lib/referrals";

export const dynamic = "force-dynamic";

/**
 * Enlace de invitación /r/<código>: guarda el código en una cookie (solo servidor, 30 días) y abre el registro.
 * No consulta la base: un código inexistente no revela nada (la atribución lo valida al crear la cuenta).
 * Primer enlace gana: si ya había un código válido guardado, no se reemplaza.
 */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCode((await params).code);
  const url = new URL("/entrar", req.url);
  url.searchParams.set("modo", "registro");
  const res = NextResponse.redirect(url, 303);
  const had = normalizeCode(req.headers.get("cookie")?.match(new RegExp(`(?:^|; )${REF_COOKIE}=([^;]+)`))?.[1]);
  if (code && !had) {
    res.cookies.set(REF_COOKIE, code, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: REF_COOKIE_MAX_AGE });
  }
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}
