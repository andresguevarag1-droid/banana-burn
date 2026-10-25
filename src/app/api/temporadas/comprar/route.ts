import { NextResponse } from "next/server";
import { errCode, logError } from "@/lib/log";
import { getViewer } from "@/lib/supabase/server";
import { isSameOrigin, memoryRateLimit, singleFlight } from "@/lib/security";
import { BillingError } from "@/lib/billing";
import { adminClient } from "@/lib/supabase/admin";
import { dbRateLimit } from "@/lib/security/db-rate-limit";
import { tilopayOfferedTo } from "@/lib/tilopay";
import { providerFor } from "@/lib/pay-provider";
import { isSeasonSlug } from "@/lib/seasons";
import { startSeasonOnvo, startSeasonTilopay } from "@/lib/season-purchase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Inicia la compra de una temporada. Body: { slug, provider?: "onvo"|"tilopay" } -> { url }. El precio y la ventana de
 * inscripción los pone el servidor (public.seasons); el procesador, por país o por lo que elija la persona.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ ok: false, error: "Origen no permitido." }, { status: 403 });
  const v = await getViewer();
  if (!v) return NextResponse.json({ ok: false, error: "Inicia sesión para continuar." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { slug?: unknown; provider?: unknown };
  const slug = typeof body.slug === "string" && isSeasonSlug(body.slug) ? body.slug : null;
  if (!slug) return NextResponse.json({ ok: false, error: "Temporada inválida." }, { status: 400 });
  if (v.demo) return NextResponse.json({ ok: false, demo: true, error: "Modo demo: aquí no se cobra. En la app real pagas con tarjeta en USD." }, { status: 409 });
  if (!memoryRateLimit(`temporada-compra:${v.id}`, 10, 10 * 60_000) || !(await dbRateLimit(adminClient(), `temporada-compra:${v.id}`, 3600, 20)))
    return NextResponse.json({ ok: false, error: "Demasiados intentos. Espera unos minutos e intenta de nuevo." }, { status: 429, headers: { "Retry-After": "600" } });
  const country = req.headers.get("x-vercel-ip-country");
  const provider = providerFor({ country, profileCountry: v.country, override: body.provider, tilopayReady: tilopayOfferedTo(v.role) });
  try {
    const origin = new URL(req.url).origin;
    const { url } = await singleFlight(`temporada-compra:${v.id}:${slug}:${provider}`, () => (provider === "tilopay" ? startSeasonTilopay(v, slug, origin, country ?? v.country) : startSeasonOnvo(v, slug)));
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    if (e instanceof BillingError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    logError("pagos-temporadas", "checkout_failed", { kind: errCode(e) });
    return NextResponse.json({ ok: false, error: "No pudimos iniciar el pago. Intenta de nuevo en un momento." }, { status: 502 });
  }
}
