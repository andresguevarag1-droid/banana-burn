import { clientIp, isSameOrigin } from "@/lib/security";
import { hitLimit, tooMany } from "@/lib/security/limits";
import { after } from "next/server";
import { cleanEvent } from "./event";
import { sendCapi } from "@/lib/meta-capi";
import { SITE_URL } from "@/lib/env";
import { nativeAgentFrom } from "@/lib/platform-ua";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Recibe eventos del embudo enviados con navigator.sendBeacon (ver src/components/analytics.tsx).
 * Los deja en el log del servidor como JSON estructurado (sin correo ni id de usuario) y, si hay META_CAPI_TOKEN,
 * reenvía los eventos de conversión a la API de Conversiones de Meta después de responder (ver src/lib/meta-capi.ts).
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return new Response(null, { status: 403 });
  // Ruta pública que escribe en el log: tope por IP para que nadie lo llene (costo y ruido en los registros).
  const lim = await hitLimit("track", `ip:${clientIp(req)}`);
  if (!lim.ok) return tooMany(lim);
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
  // Guardado en la base (0061) para medir el embudo sin depender del log. La persona, si hay sesión (sin correo).
  if (isSupabaseConfigured) {
    let uid: string | null = null;
    try { const { data } = await (await createClient()).auth.getClaims(); uid = typeof data?.claims?.sub === "string" ? data.claims.sub : null; } catch { /* sin sesión */ }
    const { path, ...rest } = evt.props;
    after(async () => {
      const db = adminClient();
      if (!db) return;
      const r = await db.from("funnel_events").insert({ user_id: uid, name: evt.name, path: typeof path === "string" ? path.slice(0, 120) : null, props: rest });
      if (r.error && r.error.code !== "42P01") console.warn(JSON.stringify({ kind: "funnel_persist", code: r.error.code }));
    });
  }
  if (!nativeAgentFrom(ua)) after(() => sendCapi(evt, { ip: ip === "local" ? "" : ip, ua, cookies, origin: SITE_URL }));
  return new Response(null, { status: 204 });
}
