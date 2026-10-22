import { NextResponse } from "next/server";
import { getViewer } from "@/lib/supabase/server";
import { isOnvoConfigured, parsePlanBilling } from "@/lib/onvo";
import { BillingError, startCheckout } from "@/lib/billing";

export const dynamic = "force-dynamic";

/** Inicia el pago de un plan. Body: { plan: "entreno"|"completo", billing: "mes"|"anual" } -> { url } */
export async function POST(req: Request) {
  const v = await getViewer();
  if (!v) return NextResponse.json({ ok: false, error: "Inicia sesión para continuar." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { plan?: unknown; billing?: unknown };
  const pb = parsePlanBilling(body.plan, body.billing);
  if (!pb) return NextResponse.json({ ok: false, error: "Plan o periodo inválido." }, { status: 400 });
  if (v.demo) return NextResponse.json({ ok: false, demo: true, error: "Modo demo: los pagos no están activos." }, { status: 409 });
  if (!isOnvoConfigured()) return NextResponse.json({ ok: false, error: "Los pagos aún no están activos. Te avisaremos muy pronto." }, { status: 503 });
  try {
    const { url } = await startCheckout(v, pb.plan, pb.billing);
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    if (e instanceof BillingError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    console.error("[pagos] checkout", e);
    return NextResponse.json({ ok: false, error: "No pudimos iniciar el pago. Intenta de nuevo en un momento." }, { status: 502 });
  }
}
