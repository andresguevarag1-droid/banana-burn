import { NextResponse } from "next/server";
import { errCode, logError } from "@/lib/log";
import { getViewer } from "@/lib/supabase/server";
import { isSameOrigin, memoryRateLimit, singleFlight } from "@/lib/security";
import { BillingError } from "@/lib/billing";
import { isSeasonSlug } from "@/lib/seasons";
import { redeemAnnualSeason } from "@/lib/season-purchase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Canjea la temporada incluida en el plan anual. Body: { slug } -> { ok, slug }. Todo se verifica en el servidor. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ ok: false, error: "Origen no permitido." }, { status: 403 });
  const v = await getViewer();
  if (!v) return NextResponse.json({ ok: false, error: "Inicia sesión para continuar." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { slug?: unknown };
  const slug = typeof body.slug === "string" && isSeasonSlug(body.slug) ? body.slug : null;
  if (!slug) return NextResponse.json({ ok: false, error: "Temporada inválida." }, { status: 400 });
  if (v.demo) return NextResponse.json({ ok: false, demo: true, error: "Modo demo: elige tu temporada en la app real." }, { status: 409 });
  if (!memoryRateLimit(`temporada-anual:${v.id}`, 6, 10 * 60_000)) return NextResponse.json({ ok: false, error: "Demasiados intentos. Espera unos minutos." }, { status: 429 });
  try {
    const r = await singleFlight(`temporada-anual:${v.id}`, () => redeemAnnualSeason(v, slug));
    return r.ok ? NextResponse.json({ ok: true, slug: r.slug }) : NextResponse.json({ ok: false, error: r.error }, { status: r.status });
  } catch (e) {
    if (e instanceof BillingError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    logError("pagos-temporadas", "redeem_failed", { kind: errCode(e) });
    return NextResponse.json({ ok: false, error: "No pudimos activar tu temporada. Intenta de nuevo." }, { status: 502 });
  }
}
