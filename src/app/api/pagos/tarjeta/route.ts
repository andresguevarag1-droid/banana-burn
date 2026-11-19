import { NextResponse, after } from "next/server";
import { errCode, logError } from "@/lib/log";
import { getViewer } from "@/lib/supabase/server";
import { clientIp, isSameOrigin, memoryRateLimit, singleFlight } from "@/lib/security";
import { isOnvoConfigured, parsePlanBilling } from "@/lib/onvo";
import { BillingError } from "@/lib/billing";
import { prepareCard, removeCard, saveCard } from "@/lib/trial-billing";
import { adminClient } from "@/lib/supabase/admin";
import { normalizeCondoCode } from "@/lib/condos";
import { dbRateLimit, dbRateLimitAll } from "@/lib/security/db-rate-limit";
import { recordPaymentFailed } from "@/lib/pago-fallo-server";
import { sendStartTrial } from "@/lib/meta-capi";
import { SITE_URL } from "@/lib/env";
import { nativeAgentFrom } from "@/lib/platform-ua";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Tarjeta guardada (0026). El número de la tarjeta NUNCA llega aquí: el navegador la crea directo en ONVO con la llave
 * publicable y solo nos manda el ID.
 *   { action: "preparar" }                                   -> { customerId, publicKey }
 *   { action: "guardar", paymentMethodId, plan, billing, condo? } -> { card, charge, outcome }  (plan y precio los valida el servidor)
 *   { action: "quitar" }                                     -> { ok }
 * Límite de intentos por persona en la base (rate_hit de 0023) y en memoria.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ ok: false, error: "Origen no permitido." }, { status: 403 });
  const v = await getViewer();
  if (!v) return NextResponse.json({ ok: false, error: "Inicia sesión para continuar." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { action?: unknown; paymentMethodId?: unknown; plan?: unknown; billing?: unknown; condo?: unknown };
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
  if (!okMem || !okDb) return NextResponse.json({ ok: false, error: "Demasiados intentos con tarjetas. Espera un rato e intenta de nuevo." }, { status: 429, headers: { "Retry-After": "600" } });

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
    // 0066: desde el enlace de un condominio con tarjeta (/c/<código>). El servidor decide si aplica.
    const condo = normalizeCondoCode(body.condo);
    const r = await singleFlight(`tarjeta:guardar:${v.id}`, () => saveCard(v, { paymentMethodId: pmId, plan: pb.plan, billing: pb.billing, condo }));
    // Tarjeta guardada pero el cobro de ese momento se rechazó (cuenta sin prueba): queda el motivo (#296).
    if (r.outcome === "rechazado") await recordPaymentFailed(db, { userId: v.id, provider: "onvo", stage: "tarjeta", code: "cobro_rechazado", plan: pb.plan, billing: pb.billing });
    // #331: la tarjeta empezó la prueba: StartTrial a Meta desde el servidor, con el mismo event_id que manda el píxel.
    // Desde la app nativa no va nada a Meta (igual que /api/track).
    const ua = req.headers.get("user-agent") ?? "";
    if (r.startTrial && !nativeAgentFrom(ua)) {
      const ip = clientIp(req);
      const st = r.startTrial;
      const send = () => sendStartTrial(st, { ip: ip === "local" ? "" : ip, ua, cookies: req.headers.get("cookie"), origin: SITE_URL, path: refererPath(req) });
      // after() fuera de un request (pruebas que llaman a POST directo) lanza: el evento a Meta nunca puede tumbar el guardado.
      try { after(send); } catch { void Promise.resolve().then(send).catch(() => null); }
    }
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    // Cada tarjeta que no se pudo guardar deja su motivo (#296); 409 es "ya hay un cobro en curso", no un fallo.
    if (action === "guardar" && !(e instanceof BillingError && e.status === 409)) {
      const code = e instanceof BillingError ? (e.status === 400 ? "tarjeta_rechazada" : `billing_${e.status}`) : errCode(e);
      await recordPaymentFailed(db, { userId: v.id, provider: "onvo", stage: "tarjeta", code });
    }
    if (e instanceof BillingError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    logError("pagos", "tarjeta_failed", { kind: errCode(e), action });
    return NextResponse.json({ ok: false, error: "No pudimos guardar tu tarjeta. Intenta de nuevo en un momento." }, { status: 502 });
  }
}

/** Pantalla donde se guardó la tarjeta (bienvenida, Mi plan…), sin parámetros, para event_source_url. */
function refererPath(req: Request): string {
  try { return new URL(req.headers.get("referer") ?? "/", SITE_URL).pathname.slice(0, 120); } catch { return "/"; }
}
