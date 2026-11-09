import { getViewer } from "@/lib/supabase/server";
import { isSameOrigin, memoryRateLimit } from "@/lib/security";
import { adminClient } from "@/lib/supabase/admin";
import { recordPaymentFailed } from "@/lib/pago-fallo-server";
import { isFailProvider, isFailStage, safeCode } from "@/lib/pago-fallo";
import { parseIntent } from "@/lib/checkout-intent";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * El navegador avisa que un pago no se completó (#296): el formulario de ONVO (rechazo o 3D Secure sin terminar) o la tarjeta
 * que ONVO no aceptó. Body: { provider, stage, code, s?, plan?, billing? }. Solo códigos cortos: nunca datos de la tarjeta.
 * `s` (la suscripción) se guarda solo si es de esta persona. Responde 204 siempre que el pedido sea válido.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return new Response(null, { status: 403 });
  const v = await getViewer();
  if (!v) return new Response(null, { status: 401 });
  if (v.demo) return new Response(null, { status: 204 });
  if (!memoryRateLimit(`pagos:fallo:${v.id}`, 20, 10 * 60_000)) return new Response(null, { status: 429, headers: { "Retry-After": "600" } });
  const text = await req.text().catch(() => "");
  if (!text || text.length > 1024) return new Response(null, { status: 400 });
  let b: { provider?: unknown; stage?: unknown; code?: unknown; s?: unknown; plan?: unknown; billing?: unknown };
  try { b = JSON.parse(text) as typeof b; } catch { return new Response(null, { status: 400 }); }
  if (!b || typeof b !== "object" || !isFailProvider(b.provider) || !isFailStage(b.stage)) return new Response(null, { status: 400 });
  const db = adminClient();
  let subId: string | null = null;
  let pb = parseIntent(b.plan, b.billing);
  if (db && typeof b.s === "string" && b.s.length <= 120) {
    const { data } = await db.from("subscriptions").select("provider_subscription_id,plan,billing").eq("provider_subscription_id", b.s).eq("user_id", v.id).maybeSingle();
    if (data) { subId = data.provider_subscription_id as string; pb = parseIntent(data.plan, data.billing) ?? pb; }
  }
  await recordPaymentFailed(db, { userId: v.id, provider: b.provider, stage: b.stage, code: safeCode(b.code) ?? "desconocido", subId, plan: pb?.plan, billing: pb?.billing });
  return new Response(null, { status: 204 });
}
