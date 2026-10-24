import { NextResponse } from "next/server";
import { errCode, logError } from "@/lib/log";
import { getViewer } from "@/lib/supabase/server";
import { isSameOrigin, memoryRateLimit, singleFlight } from "@/lib/security";
import { isOnvoConfigured, parsePlanBilling } from "@/lib/onvo";
import { BillingError, startCheckout } from "@/lib/billing";
import { adminClient } from "@/lib/supabase/admin";
import { dbRateLimit } from "@/lib/security/db-rate-limit";

export const dynamic = "force-dynamic";

/** Inicia el pago de un plan. Body: { plan: "entreno"|"completo", billing: "mes"|"anual" } -> { url } */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ ok: false, error: "Origen no permitido." }, { status: 403 });
  const v = await getViewer();
  if (!v) return NextResponse.json({ ok: false, error: "Inicia sesión para continuar." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { plan?: unknown; billing?: unknown };
  const pb = parsePlanBilling(body.plan, body.billing);
  if (!pb) return NextResponse.json({ ok: false, error: "Plan o periodo inválido." }, { status: 400 });
  if (v.demo) return NextResponse.json({ ok: false, demo: true, error: "Modo demo: los pagos no están activos." }, { status: 409 });
  if (!isOnvoConfigured()) return NextResponse.json({ ok: false, error: "Los pagos aún no están activos. Te avisaremos muy pronto." }, { status: 503 });
  // Cada intento puede crear un cliente y una suscripción en ONVO: tope por persona y doble clic unido en uno.
  // En memoria (por instancia) y en la base (compartido entre instancias, 0023).
  if (!memoryRateLimit(`checkout:${v.id}`, 10, 10 * 60_000) || !(await dbRateLimit(adminClient(), `checkout:${v.id}`, 3600, 20)))
    return NextResponse.json({ ok: false, error: "Demasiados intentos. Espera unos minutos e intenta de nuevo." }, { status: 429, headers: { "Retry-After": "600" } });
  try {
    const { url } = await singleFlight(`checkout:${v.id}:${pb.plan}:${pb.billing}`, () => startCheckout(v, pb.plan, pb.billing));
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    if (e instanceof BillingError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    logError("pagos", "checkout_failed", { kind: errCode(e) });
    return NextResponse.json({ ok: false, error: "No pudimos iniciar el pago. Intenta de nuevo en un momento." }, { status: 502 });
  }
}
