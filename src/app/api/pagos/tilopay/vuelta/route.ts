import { NextResponse, after } from "next/server";
import { errCode, logError } from "@/lib/log";
import { getViewer } from "@/lib/supabase/server";
import { clientIp, memoryRateLimit } from "@/lib/security";
import { BillingError } from "@/lib/billing";
import { splitReturn, verifyState } from "@/lib/tilopay";
import { handleTilopayReturn, handleTilopayReturnNoSession } from "@/lib/tilopay-billing";
import { recordPaymentFailed } from "@/lib/pago-fallo-server";
import { adminClient } from "@/lib/supabase/admin";
import { tilopayReturnPath as returnPath } from "@/lib/pago-fallo";
import { sendStartTrial } from "@/lib/meta-capi";
import { SITE_URL } from "@/lib/env";
import { nativeAgentFrom } from "@/lib/platform-ua";
import type { ReturnResult } from "@/lib/tilopay-billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Vuelta desde Tilopay (GET, la hace el navegador). Exige el estado firmado (2 horas) Y la sesión de la misma persona.
 * Los parámetros del navegador nunca dan acceso solos: una compra se confirma consultando a Tilopay (tilopay-billing.ts).
 * Sin sesión, una compra directa o una tarjeta (#313, prueba con tarjeta obligatoria) se procesan igual con el estado firmado
 * y se pide entrar para ver el resultado.
 * Termina en Mi plan con ?tilopay=<resultado>&motivo=<por qué no se completó>. Cada fallo queda en payment_events (#296).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
  const go = (path: string) => NextResponse.redirect(new URL(path, url.origin), { status: 303, headers });
  const { state, params } = splitReturn(url.searchParams);
  const s = verifyState(state);
  const v = await getViewer();
  if (!s) {
    if (v && !v.demo) await recordPaymentFailed(adminClient(), { userId: v.id, provider: "tilopay", stage: "vuelta", code: "vencido" });
    return go(returnPath("vencido", null, "vencido"));
  }
  if (v?.demo) return go("/entrar");
  if (!v) {
    if (!memoryRateLimit(`tilopay:vuelta:${s.u}`, 12, 10 * 60_000)) return go("/entrar");
    const r = await handleTilopayReturnNoSession(s, params).catch((e) => { logError("pagos", "tilopay_return_failed", { kind: errCode(e), session: false }); return null; });
    return go(`/entrar?next=${encodeURIComponent(r ? returnPath(r.outcome, s, r.kind, startTrial(req, r)) : "/app/suscripcion")}`);
  }
  if (v.id !== s.u) return go(returnPath("vencido", null, "vencido"));
  if (!memoryRateLimit(`tilopay:vuelta:${v.id}`, 12, 10 * 60_000)) return go(returnPath("error", s));
  try {
    const r = await handleTilopayReturn(v, s, params);
    return go(returnPath(r.outcome, s, r.kind, startTrial(req, r)));
  } catch (e) {
    if (e instanceof BillingError) {
      if (e.status === 409) return go(returnPath("ocupado", s));
      const kind = await recordPaymentFailed(adminClient(), { userId: v.id, provider: "tilopay", stage: s.p === "tarjeta" ? "tarjeta" : "vuelta", code: e.status === 400 ? "tarjeta_rechazada" : `billing_${e.status}`, plan: s.plan, billing: s.billing });
      return go(returnPath(e.status === 400 ? "rechazada" : "error", s, kind));
    }
    logError("pagos", "tilopay_return_failed", { kind: errCode(e) });
    await recordPaymentFailed(adminClient(), { userId: v.id, provider: "tilopay", stage: "vuelta", code: errCode(e), plan: s.plan, billing: s.billing });
    return go(returnPath("error", s, "error"));
  }
}

/**
 * #331: la tarjeta de Tilopay empezó la prueba. Manda StartTrial a Meta desde el servidor y devuelve su event_id para que
 * Mi plan mande el del píxel con el mismo (Meta lo cuenta una vez). Desde la app nativa no va nada a Meta.
 */
function startTrial(req: Request, r: ReturnResult): string | undefined {
  const st = r.outcome === "tarjeta_ok" ? r.result?.startTrial : null;
  const ua = req.headers.get("user-agent") ?? "";
  if (!st || nativeAgentFrom(ua)) return undefined;
  const ip = clientIp(req);
  after(() => sendStartTrial(st, { ip: ip === "local" ? "" : ip, ua, cookies: req.headers.get("cookie"), origin: SITE_URL, path: "/app/suscripcion" }));
  return st.eventId;
}
