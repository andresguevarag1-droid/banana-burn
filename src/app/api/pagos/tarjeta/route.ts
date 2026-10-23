import { NextResponse } from "next/server";
import { errCode, logError } from "@/lib/log";
import { getViewer } from "@/lib/supabase/server";
import { isSameOrigin, memoryRateLimit, singleFlight } from "@/lib/security";
import { isOnvoConfigured, parsePlanBilling } from "@/lib/onvo";
import { BillingError } from "@/lib/billing";
import { prepareCard, removeCard, saveCard } from "@/lib/trial-billing";
import { adminClient } from "@/lib/supabase/admin";
import { dbRateLimit, dbRateLimitAll } from "@/lib/security/db-rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Tarjeta guardada (0026). El número de la tarjeta NUNCA llega aquí: el navegador la crea directo en ONVO con la llave
 * publicable y solo nos manda el ID.
 *   { action: "preparar" }                                   -> { customerId, publicKey }
 *   { action: "guardar", paymentMethodId, plan, billing }    -> { card, charge, outcome }  (plan y precio los valida el servidor)
 *   { action: "quitar" }                                     -> { ok }
 * Límite de intentos por persona en la base (rate_hit de 0023) y en memoria.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ ok: false, error: "Origen no permitido." }, { status: 403 });
  const v = await getViewer();
  if (!v) return NextResponse.json({ ok: false, error: "Inicia sesión para continuar." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { action?: unknown; paymentMethodId?: unknown; plan?: unknown; billing?: unknown };
  const action = body.action;
  if (action !== "preparar" && action !== "guardar" && action !== "quitar") return NextResponse.json({ ok: false, error: "Acción inválida." }, { status: 400 });
  // Modo demo: la pantalla simula la tarjeta sin llamar a ONVO.
  if (v.demo) return NextResponse.json({ ok: false, demo: true, error: "Modo demo: no se guardan tarjetas reales." }, { status: 409 });
  if (!isOnvoConfigured()) return NextResponse.json({ ok: false, error: "Los pagos aún no están activos. Te avisaremos muy pronto." }, { status: 503 });

  // Cada intento puede crear un cliente o leer una tarjeta en ONVO: tope por persona, compartido entre instancias.
  const db = adminClient();
  const okMem = memoryRateLimit(`tarjeta:${action}:${v.id}`, action === "preparar" ? 15 : 8, 10 * 60_000);
  const okDb = action === "guardar"
    ? await dbRateLimitAll(db, [{ key: `tarjeta:guardar:${v.id}`, windowSec: 3600, max: 10 }, { key: `tarjeta:guardar:dia:${v.id}`, windowSec: 86400, max: 25 }])
    : await dbRateLimit(db, `tarjeta:${action}:${v.id}`, 3600, 20);
  if (!okMem || !okDb) return NextResponse.json({ ok: false, error: "Demasiados intentos con tarjetas. Espera un rato e intenta de nuevo." }, { status: 429 });

  try {
    if (action === "preparar") {
      const { customerId } = await singleFlight(`tarjeta:preparar:${v.id}`, () => prepareCard(v));
      return NextResponse.json({ ok: true, customerId, publicKey: process.env.NEXT_PUBLIC_ONVO_PUBLISHABLE_KEY });
    }
    if (action === "quitar") {
      await singleFlight(`tarjeta:quitar:${v.id}`, () => removeCard(v));
      return NextResponse.json({ ok: true });
    }
    const pb = parsePlanBilling(body.plan, body.billing);
    if (!pb) return NextResponse.json({ ok: false, error: "Plan o periodo inválido." }, { status: 400 });
    if (typeof body.paymentMethodId !== "string") return NextResponse.json({ ok: false, error: "Tarjeta inválida." }, { status: 400 });
    const pmId = body.paymentMethodId;
    const r = await singleFlight(`tarjeta:guardar:${v.id}`, () => saveCard(v, { paymentMethodId: pmId, plan: pb.plan, billing: pb.billing }));
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    if (e instanceof BillingError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    logError("pagos", "tarjeta_failed", { kind: errCode(e), action });
    return NextResponse.json({ ok: false, error: "No pudimos guardar tu tarjeta. Intenta de nuevo en un momento." }, { status: 502 });
  }
}
