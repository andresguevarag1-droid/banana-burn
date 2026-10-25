import { NextResponse } from "next/server";
import { getViewer } from "@/lib/supabase/server";
import { CONDO_COOKIE, CONDO_COOKIE_MAX_AGE, normalizeCondoCode } from "@/lib/condos";
import { joinCondo } from "@/lib/condos-server";
import { clientIp, isSameOrigin, memoryRateLimit } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headersFor = (res: NextResponse) => {
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
};
const cookieOpts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: CONDO_COOKIE_MAX_AGE };

/**
 * "Activar mi mes gratis" desde /c/<código> sin sesión: guarda el código en una cookie (solo servidor, 30 días) y abre el
 * registro (o la entrada con ?cuenta=1). Al crear la cuenta, attributeNewAccount la vincula al condominio. Con sesión no
 * cambia nada: vuelve a la página del condominio, que muestra el botón (POST). Un GET nunca vincula una cuenta.
 */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCondoCode((await params).code);
  if (!code) return headersFor(NextResponse.redirect(new URL("/", req.url), 303));
  const back = `/c/${code}`;
  // Freno por red (antes de tocar la base): un enlace del afiche no se abre cientos de veces en 10 minutos.
  if (!memoryRateLimit(`condo:get:${clientIp(req)}`, 60, 600_000)) return headersFor(NextResponse.redirect(new URL(back, req.url), 303));
  const v = await getViewer().catch(() => null);
  if (v && !v.demo) return headersFor(NextResponse.redirect(new URL(back, req.url), 303));
  const url = new URL("/entrar", req.url);
  if (new URL(req.url).searchParams.get("cuenta") !== "1") url.searchParams.set("modo", "registro");
  url.searchParams.set("next", back);
  const res = NextResponse.redirect(url, 303);
  res.cookies.set(CONDO_COOKIE, code, cookieOpts);
  return headersFor(res);
}

/** Con sesión: vincula la cuenta al condominio (mismo sitio) y vuelve a /c/<código> con el resultado. */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCondoCode((await params).code);
  if (!code) return headersFor(NextResponse.redirect(new URL("/", req.url), 303));
  const back = new URL(`/c/${code}`, req.url);
  if (!isSameOrigin(req)) return headersFor(NextResponse.redirect(back, 303));
  if (!memoryRateLimit(`condo:post:${clientIp(req)}`, 20, 600_000)) return headersFor(NextResponse.redirect(back, 303));
  const v = await getViewer().catch(() => null);
  if (!v) return GET(req, { params: Promise.resolve({ code }) });
  const r = v.demo ? { kind: "join" as const } : await joinCondo(v.id, code);
  back.searchParams.set("estado", r.kind);
  const res = NextResponse.redirect(back, 303);
  res.cookies.delete(CONDO_COOKIE);
  return headersFor(res);
}
