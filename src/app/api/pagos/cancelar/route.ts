import { NextResponse } from "next/server";
import { errCode, logError } from "@/lib/log";
import { getViewer } from "@/lib/supabase/server";
import { isSameOrigin, singleFlight } from "@/lib/security";
import { BillingError, cancelAtPeriodEnd } from "@/lib/billing";
import { hitLimit, tooMany } from "@/lib/security/limits";

export const dynamic = "force-dynamic";

/** Cancela al final del periodo. Body opcional: { reason } */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ ok: false, error: "Origen no permitido." }, { status: 403 });
  const v = await getViewer();
  if (!v) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { reason?: unknown };
  if (v.demo) return NextResponse.json({ ok: true, demo: true, endsAt: null });
  const lim = await hitLimit("pagos:cancelar", v.id);
  if (!lim.ok) return tooMany(lim);
  try {
    const { endsAt } = await singleFlight(`cancelar:${v.id}`, () => cancelAtPeriodEnd(v, typeof body.reason === "string" ? body.reason : undefined));
    return NextResponse.json({ ok: true, endsAt });
  } catch (e) {
    if (e instanceof BillingError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    logError("pagos", "cancel_failed", { kind: errCode(e) });
    return NextResponse.json({ ok: false, error: "No se pudo cancelar. Escríbenos a hola@bananaburn.app." }, { status: 500 });
  }
}
