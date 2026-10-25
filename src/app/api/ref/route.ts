import { NextResponse } from "next/server";
import { clientIp, isSameOrigin, memoryRateLimit } from "@/lib/security";
import { AFF_COOKIE, affCookieValue, cleanUtm, normalizeAffCode } from "@/lib/affiliates";
import { AFF_UTM_COOKIE, getAffSettings, recordClick } from "@/lib/affiliates-server";
import { ipSignal } from "@/lib/referrals-server";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status: number) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Clic en un enlace de referidor (?ref=CÓDIGO en cualquier página pública; lo manda components/ref-capture.tsx).
 * Guarda la cookie de primera parte (el último clic gana, dura los días de los ajustes) y anota el clic sin datos personales
 * (hash de la red). Código inválido o inactivo: 404 y sin cookie.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return json({ ok: false, error: "Origen no permitido." }, 403);
  const ip = clientIp(req);
  if (!memoryRateLimit(`ref:${ip}`, 30, 10 * 60_000)) return json({ ok: false, error: "Demasiadas solicitudes." }, 429);
  let body: { code?: unknown; path?: unknown; utm?: Record<string, unknown> } = {};
  try { body = JSON.parse((await req.text()).slice(0, 2000)); } catch { return json({ ok: false, error: "JSON inválido." }, 400); }
  const code = normalizeAffCode(body.code);
  if (!code) return json({ ok: false, error: "Código inválido." }, 400);
  const utm = cleanUtm(body.utm ?? null);
  const path = typeof body.path === "string" && body.path.startsWith("/") ? body.path.slice(0, 200) : null;
  const ok = await recordClick(code, path, utm, ipSignal(ip)).catch(() => false);
  if (!ok) return json({ ok: false, error: "Código no encontrado." }, 404);
  const db = adminClient();
  const days = db ? (await getAffSettings(db)).cookie_days : 60;
  const res = json({ ok: true }, 200);
  const opts = { path: "/", sameSite: "lax" as const, httpOnly: true, secure: process.env.NODE_ENV === "production", maxAge: days * 86400 };
  res.cookies.set(AFF_COOKIE, affCookieValue(code), opts);
  if (Object.keys(utm).length) res.cookies.set(AFF_UTM_COOKIE, JSON.stringify(utm), opts);
  else res.cookies.delete(AFF_UTM_COOKIE);
  return res;
}
