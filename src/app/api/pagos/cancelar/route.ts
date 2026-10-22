import { NextResponse } from "next/server";
import { getViewer } from "@/lib/supabase/server";
import { isSameOrigin, memoryRateLimit, singleFlight } from "@/lib/security";
import { BillingError, cancelAtPeriodEnd } from "@/lib/billing";

export const dynamic = "force-dynamic";

/** Cancela al final del periodo. Body opcional: { reason } */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ ok: false, error: "Origen no permitido." }, { status: 403 });
  const v = await getViewer();
  if (!v) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { reason?: unknown };
  if (v.demo) return NextResponse.json({ ok: true, demo: true, endsAt: null });
  if (!memoryRateLimit(`cancelar:${v.id}`, 5, 10 * 60_000)) return NextResponse.json({ ok: false, error: "Demasiados intentos. Espera unos minutos e intenta de nuevo." }, { status: 429 });
  try {
    const { endsAt } = await singleFlight(`cancelar:${v.id}`, () => cancelAtPeriodEnd(v, typeof body.reason === "string" ? body.reason : undefined));
    return NextResponse.json({ ok: true, endsAt });
  } catch (e) {
    if (e instanceof BillingError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    console.error("[pagos] cancelar", e);
    return NextResponse.json({ ok: false, error: "No se pudo cancelar. Escríbenos a hola@bananaburn.app." }, { status: 500 });
  }
}
