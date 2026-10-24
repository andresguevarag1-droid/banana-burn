import { clientIp, isSameOrigin, memoryRateLimit } from "@/lib/security";
import { cleanEvent } from "./event";

export const dynamic = "force-dynamic";

/**
 * Recibe eventos del embudo enviados con navigator.sendBeacon (ver src/components/analytics.tsx).
 * Por ahora solo los deja en el log del servidor como JSON estructurado: sin terceros, sin cookies nuevas,
 * sin datos personales (no se guarda el correo ni el id de usuario).
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
  return new Response(null, { status: 204 });
}
