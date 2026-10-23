import { NextResponse } from "next/server";
import { errCode, logError } from "@/lib/log";
import { getViewer } from "@/lib/supabase/server";
import { isSameOrigin, memoryRateLimit, singleFlight } from "@/lib/security";
import { parsePlanBilling } from "@/lib/onvo";
import { BillingError } from "@/lib/billing";
import { cancelTrial, changeTrialPlan, resumeTrial } from "@/lib/trial-billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Cobro programado con la tarjeta guardada (0026).
 *   { action: "cancelar", keepCard }   -> no se cobra; el acceso sigue hasta el fin de la prueba. keepCard=false desconecta la tarjeta en ONVO.
 *   { action: "plan", plan, billing }  -> cambia el plan que se cobrará (el precio lo pone el servidor).
 *   { action: "reanudar" }             -> deshace la cancelación antes del fin de la prueba (con la tarjeta guardada).
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ ok: false, error: "Origen no permitido." }, { status: 403 });
  const v = await getViewer();
  if (!v) return NextResponse.json({ ok: false, error: "Inicia sesión para continuar." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { action?: unknown; keepCard?: unknown; plan?: unknown; billing?: unknown };
  if (body.action !== "cancelar" && body.action !== "plan" && body.action !== "reanudar") return NextResponse.json({ ok: false, error: "Acción inválida." }, { status: 400 });
  if (v.demo) return NextResponse.json({ ok: true, demo: true });
  if (!memoryRateLimit(`prueba:${v.id}`, 10, 10 * 60_000)) return NextResponse.json({ ok: false, error: "Demasiados intentos. Espera unos minutos e intenta de nuevo." }, { status: 429 });
  try {
    if (body.action === "cancelar") {
      const keep = body.keepCard === true;
      const r = await singleFlight(`prueba:cancelar:${v.id}`, () => cancelTrial(v, keep));
      return NextResponse.json({ ok: true, ...r });
    }
    if (body.action === "reanudar") return NextResponse.json({ ok: true, charge: await singleFlight(`prueba:reanudar:${v.id}`, () => resumeTrial(v)) });
    const pb = parsePlanBilling(body.plan, body.billing);
    if (!pb) return NextResponse.json({ ok: false, error: "Plan o periodo inválido." }, { status: 400 });
    const charge = await singleFlight(`prueba:plan:${v.id}`, () => changeTrialPlan(v, pb.plan, pb.billing));
    return NextResponse.json({ ok: true, charge });
  } catch (e) {
    if (e instanceof BillingError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    logError("pagos", "prueba_failed", { kind: errCode(e) });
    return NextResponse.json({ ok: false, error: "No pudimos hacer el cambio. Escríbenos a hola@bananaburn.app." }, { status: 500 });
  }
}
