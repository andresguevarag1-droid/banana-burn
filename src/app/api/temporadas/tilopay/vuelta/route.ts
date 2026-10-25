import { NextResponse } from "next/server";
import { errCode, logError } from "@/lib/log";
import { getViewer } from "@/lib/supabase/server";
import { memoryRateLimit } from "@/lib/security";
import { confirmSeasonTilopay, verifySeasonState } from "@/lib/season-purchase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Vuelta desde Tilopay después de pagar una temporada. Exige el estado firmado (2 horas) y la sesión de la misma persona.
 * Los parámetros del navegador nunca dan acceso: se consulta la orden en Tilopay (season-purchase.ts).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const st = verifySeasonState(url.searchParams.get("s"));
  const go = (path: string) => NextResponse.redirect(new URL(path, url.origin), { status: 303, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  if (!st) return go("/app/temporadas?pago=vencido");
  const v = await getViewer();
  if (!v || v.demo) return go("/entrar");
  if (v.id !== st.u) return go("/app/temporadas?pago=vencido");
  if (!memoryRateLimit(`temporada-vuelta:${v.id}`, 12, 10 * 60_000)) return go(`/app/temporadas/${st.s}?pago=error`);
  try {
    const r = await confirmSeasonTilopay(v, st);
    return go(r === "pagada" ? `/app/temporadas/${st.s}/cuestionario?pago=ok` : `/app/temporadas/${st.s}?pago=${r}`);
  } catch (e) {
    logError("pagos-temporadas", "tilopay_return_failed", { kind: errCode(e) });
    return go(`/app/temporadas/${st.s}?pago=error`);
  }
}
