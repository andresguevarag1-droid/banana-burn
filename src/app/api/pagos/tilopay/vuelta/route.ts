import { NextResponse } from "next/server";
import { errCode, logError } from "@/lib/log";
import { getViewer } from "@/lib/supabase/server";
import { memoryRateLimit } from "@/lib/security";
import { BillingError } from "@/lib/billing";
import { verifyState } from "@/lib/tilopay";
import { handleTilopayReturn } from "@/lib/tilopay-billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Vuelta desde Tilopay (GET, la hace el navegador). Exige el estado firmado (2 horas) Y la sesión de la misma persona.
 * Los parámetros del navegador nunca dan acceso solos: una compra se confirma consultando a Tilopay (tilopay-billing.ts).
 * Termina en Mi plan con ?tilopay=<resultado>.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const go = (r: string) => NextResponse.redirect(new URL(`/app/suscripcion?tilopay=${r}#tarjeta`, url.origin), { status: 303, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  const s = verifyState(url.searchParams.get("s"));
  if (!s) return go("vencido");
  const v = await getViewer();
  if (!v || v.demo) return NextResponse.redirect(new URL(`/entrar`, url.origin), 303);
  if (v.id !== s.u) return go("vencido");
  if (!memoryRateLimit(`tilopay:vuelta:${v.id}`, 12, 10 * 60_000)) return go("error");
  try {
    const { outcome } = await handleTilopayReturn(v, s, url.searchParams);
    return go(outcome);
  } catch (e) {
    if (e instanceof BillingError) return go(e.status === 409 ? "ocupado" : e.status === 400 ? "rechazada" : "error");
    logError("pagos", "tilopay_return_failed", { kind: errCode(e) });
    return go("error");
  }
}
