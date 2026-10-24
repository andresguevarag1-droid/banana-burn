import { NextResponse } from "next/server";
import { errCode, logError } from "@/lib/log";
import { getViewer } from "@/lib/supabase/server";
import { isSameOrigin, memoryRateLimit, singleFlight } from "@/lib/security";
import { parsePlanBilling } from "@/lib/onvo";
import { BillingError } from "@/lib/billing";
import { isTilopayConfigured } from "@/lib/tilopay";
import { providerFor } from "@/lib/pay-provider";
import { startTilopayCard } from "@/lib/tilopay-billing";
import { adminClient } from "@/lib/supabase/admin";
import { dbRateLimit } from "@/lib/security/db-rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Tilopay (0042), para tarjetas de fuera de Costa Rica.
 *   GET                                     -> { available, suggested: "onvo" | "tilopay" }  (país por IP o el de la bienvenida)
 *   POST { purpose: "tarjeta", plan, billing } -> { url }  página segura de Tilopay para guardar la tarjeta (número nunca aquí)
 */
export async function GET(req: Request) {
  const v = await getViewer();
  if (!v) return NextResponse.json({ ok: false, error: "Inicia sesión para continuar." }, { status: 401 });
  const available = !v.demo && isTilopayConfigured();
  const suggested = providerFor({ country: req.headers.get("x-vercel-ip-country"), profileCountry: v.country, tilopayReady: available });
  return NextResponse.json({ ok: true, available, suggested }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ ok: false, error: "Origen no permitido." }, { status: 403 });
  const v = await getViewer();
  if (!v) return NextResponse.json({ ok: false, error: "Inicia sesión para continuar." }, { status: 401 });
  if (v.demo) return NextResponse.json({ ok: false, demo: true, error: "Modo demo: no se guardan tarjetas reales." }, { status: 409 });
  if (!isTilopayConfigured()) return NextResponse.json({ ok: false, error: "Los pagos con tarjetas de otros países aún no están activos." }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as { purpose?: unknown; plan?: unknown; billing?: unknown };
  if (body.purpose !== "tarjeta") return NextResponse.json({ ok: false, error: "Acción inválida." }, { status: 400 });
  const pb = parsePlanBilling(body.plan, body.billing);
  if (!pb) return NextResponse.json({ ok: false, error: "Plan o periodo inválido." }, { status: 400 });
  if (!memoryRateLimit(`tilopay:tarjeta:${v.id}`, 8, 10 * 60_000) || !(await dbRateLimit(adminClient(), `tilopay:tarjeta:${v.id}`, 3600, 15)))
    return NextResponse.json({ ok: false, error: "Demasiados intentos con tarjetas. Espera un rato e intenta de nuevo." }, { status: 429, headers: { "Retry-After": "600" } });
  try {
    const origin = new URL(req.url).origin;
    const { url } = await singleFlight(`tilopay:tarjeta:${v.id}`, () => startTilopayCard(v, pb.plan, pb.billing, origin));
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    if (e instanceof BillingError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    logError("pagos", "tilopay_start_failed", { kind: errCode(e) });
    return NextResponse.json({ ok: false, error: "No pudimos abrir la página de pago. Intenta de nuevo en un momento." }, { status: 502 });
  }
}
