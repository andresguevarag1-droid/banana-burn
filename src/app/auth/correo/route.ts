import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { clientIp, isSameOrigin } from "@/lib/security";
import { hitLimit, tooManyText } from "@/lib/security/limits";
import { safeNext } from "@/lib/security/redirect";
import { loginLinkSecret, verifyLoginToken } from "@/lib/email/login-link";
import { logError } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Enlace de un toque de los correos (ver lib/email/login-link.ts).
 * GET muestra un botón (los antivirus del correo abren los enlaces y no deben gastarlo); POST lo gasta e inicia la sesión.
 * Solo cuentas de clientes (nunca staff), no bloqueadas, y solo hacia rutas de la app.
 */

const appPath = (raw: string | null) => {
  const p = safeNext(raw, "/app");
  return p === "/app" || p.startsWith("/app/") || p.startsWith("/app?") || p.startsWith("/app#") ? p : "/app";
};
const toLogin = (origin: string, next: string, why?: string) =>
  NextResponse.redirect(`${origin}/entrar?next=${encodeURIComponent(next)}${why ? `&enlace=${why}` : ""}`, 303);

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function page(token: string, next: string) {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Entrar a Banana Burn</title>
<style>
:root{color-scheme:light}body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#FFF8E6;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1B1505}
main{width:min(420px,calc(100% - 32px));text-align:center}
img{width:96px;height:96px;border-radius:24px}
h1{font-size:28px;line-height:1.1;margin:20px 0 8px;letter-spacing:-.02em}
p{margin:0 0 24px;font-size:17px;line-height:1.5;color:#4A4232}
button{width:100%;min-height:60px;border:0;border-radius:999px;background:#1B1505;color:#FFD23F;font-size:19px;font-weight:800;cursor:pointer}
button:focus-visible{outline:4px solid #FFD23F;outline-offset:3px}
a{display:inline-block;margin-top:18px;color:#1B1505;font-weight:700;min-height:44px;line-height:44px}
</style></head><body><main>
<img src="/icons/icon-192.png" alt="">
<h1>Tu entreno te espera</h1>
<p>Toca el botón y entras directo, sin contraseña.</p>
<form method="post" action="/auth/correo"><input type="hidden" name="t" value="${esc(token)}"><input type="hidden" name="next" value="${esc(next)}">
<button type="submit">Entrar a mi entreno</button></form>
<a href="/entrar?next=${esc(encodeURIComponent(next))}">Prefiero entrar con mi correo</a>
</main></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex" } });
}

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const next = appPath(searchParams.get("next"));
  const lim = await hitLimit("auth:correo:ver", `ip:${clientIp(req)}`);
  if (!lim.ok) return tooManyText(lim);
  if (!isSupabaseConfigured) return toLogin(origin, next);
  const token = searchParams.get("t") ?? "";
  const t = verifyLoginToken(token, loginLinkSecret());
  if (!t) return toLogin(origin, next, "vencido");
  // Ya tiene la sesión de esa misma persona en este navegador: directo, sin gastar el enlace.
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (data.user?.id === t.userId) return NextResponse.redirect(`${origin}${next}`, 303);
  return page(token, next);
}

export async function POST(req: NextRequest) {
  const { origin } = new URL(req.url);
  // Solo desde nuestro propio botón: nadie puede meter a otra persona en una cuenta ajena desde otro sitio.
  if (!isSameOrigin(req)) return NextResponse.redirect(`${origin}/entrar`, 303);
  const form = await req.formData().catch(() => null);
  const next = appPath(typeof form?.get("next") === "string" ? (form!.get("next") as string) : null);
  const lim = await hitLimit("auth:correo:entrar", `ip:${clientIp(req)}`);
  if (!lim.ok) return tooManyText(lim);
  const raw = form?.get("t");
  const t = verifyLoginToken(typeof raw === "string" ? raw : null, loginLinkSecret());
  const admin = adminClient();
  if (!t || !admin || !isSupabaseConfigured) return toLogin(origin, next, t ? undefined : "vencido");

  const sb = await createClient();
  const { data: cur } = await sb.auth.getUser();
  if (cur.user?.id === t.userId) return NextResponse.redirect(`${origin}${next}`, 303);

  // Solo clientes activos: nunca staff (un correo reenviado no puede abrir el panel) ni cuentas bloqueadas.
  const { data: prof } = await admin.from("profiles").select("role,blocked_at").eq("id", t.userId).maybeSingle();
  if (!prof || !["free", "pro"].includes(String(prof.role)) || prof.blocked_at) return toLogin(origin, next);

  // Un enlace, un uso (la llave primaria lo garantiza aunque lleguen dos clics a la vez).
  const used = await admin.from("email_login_uses").insert({ nonce: t.nonce, user_id: t.userId });
  if (used.error) return toLogin(origin, next, used.error.code === "23505" ? "usado" : undefined);

  try {
    const { data: u } = await admin.auth.admin.getUserById(t.userId);
    const email = u.user?.email;
    if (!email || u.user?.banned_until && Date.parse(u.user.banned_until) > Date.now()) return toLogin(origin, next);
    const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    const hash = link?.properties?.hashed_token;
    if (error || !hash) { logError("correo", "generate_link_failed"); return toLogin(origin, next); }
    const v = await sb.auth.verifyOtp({ token_hash: hash, type: "email" });
    if (v.error) { logError("correo", "verify_failed"); return toLogin(origin, next); }
    return NextResponse.redirect(`${origin}${next}`, 303);
  } catch {
    logError("correo", "login_link_failed");
    return toLogin(origin, next);
  }
}
