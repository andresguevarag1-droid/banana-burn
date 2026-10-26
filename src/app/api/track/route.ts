import { clientIp, isSameOrigin, memoryRateLimit } from "@/lib/security";
import { after } from "next/server";
import { cleanEvent } from "./event";
import { sendCapi } from "@/lib/meta-capi";
import { SITE_URL } from "@/lib/env";
import { nativeAgentFrom } from "@/lib/platform-ua";

export const dynamic = "force-dynamic";

/**
 * Recibe eventos del embudo enviados con navigator.sendBeacon (ver src/components/analytics.tsx).
 * Los deja en el log del servidor como JSON estructurado (sin correo ni id de usuario) y, si hay META_CAPI_TOKEN,
 * reenvía los eventos de conversión a la API de Conversiones de Meta después de responder (ver src/lib/meta-capi.ts).
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return new Response(null, { status: 403 });
  // Ruta pública que escribe en el log: tope por IP para que nadie lo llene (costo y ruido en los registros).
  if (!memoryRateLimit(`track:${clientIp(req)}`, 120, 60_000)) return new Response(null, { status: 429, headers: { "Retry-After": "60" } });
  const text = await req.text().catch(() => "");
  if (!text || text.length > 2048) return new Response(null, { status: 400 });
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return new Response(null, { status: 400 }); }
  const evt = cleanEvent(raw);
  if (!evt) return new Response(null, { status: 400 });
  console.info(JSON.stringify({ kind: "funnel", at: new Date().toISOString(), event: evt.name, ...evt.props }));
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent") ?? "";
  const cookies = req.headers.get("cookie");
  // Desde la app nativa no va nada a Meta: rastrear entre apps obliga a pedir permiso de rastreo (ATT) en iPhone.
  if (!nativeAgentFrom(ua)) after(() => sendCapi(evt, { ip: ip === "local" ? "" : ip, ua, cookies, origin: SITE_URL }));
  return new Response(null, { status: 204 });
}
