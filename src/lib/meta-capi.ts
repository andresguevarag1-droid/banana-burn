import "server-only";
// API de Conversiones de Meta: reenvía desde el servidor los eventos del embudo que también dispara el píxel.
// Sirve cuando el navegador bloquea el píxel (bloqueadores, Safari). Meta deduplica por event_id.
// Solo corre si existe META_CAPI_TOKEN (Events Manager > Banana Burn > Configuración > Generar token de acceso).
// Datos enviados: IP y navegador (los pide Meta para atribuir), cookies _fbp/_fbc de Meta y la URL sin parámetros.
// Nunca correo, teléfono, id de usuario ni datos de salud.
import { clean } from "@/lib/env";
import { META_PIXEL_ID, toMetaEvent } from "@/lib/meta-pixel";
import type { CleanEvent } from "@/app/api/track/event";

const GRAPH = "https://graph.facebook.com/v23.0";

export const capiToken = () => clean(process.env.META_CAPI_TOKEN);

function cookie(header: string | null, name: string): string | undefined {
  const m = header?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]{1,200})`));
  return m?.[1];
}

/** Arma el cuerpo de la API de Conversiones (exportado para pruebas). null = no se envía. */
export function capiPayload(evt: CleanEvent, ctx: { ip: string; ua: string; cookies: string | null; origin: string; now?: number }) {
  const meta = toMetaEvent(evt.name, evt.props);
  const eid = typeof evt.props.event_id === "string" ? evt.props.event_id : "";
  if (!meta || !eid) return null;
  const path = typeof evt.props.path === "string" && evt.props.path.startsWith("/") ? evt.props.path : "/";
  const user_data: Record<string, string> = {};
  if (ctx.ip) user_data.client_ip_address = ctx.ip;
  if (ctx.ua) user_data.client_user_agent = ctx.ua.slice(0, 400);
  const fbp = cookie(ctx.cookies, "_fbp");
  const fbc = cookie(ctx.cookies, "_fbc");
  if (fbp) user_data.fbp = fbp;
  if (fbc) user_data.fbc = fbc;
  return {
    data: [{
      event_name: meta.name,
      event_time: Math.floor((ctx.now ?? Date.now()) / 1000),
      event_id: eid,
      action_source: "website",
      event_source_url: `${ctx.origin}${path}`,
      user_data,
      custom_data: meta.params,
    }],
  };
}

/** Envía el evento. Nunca lanza: si Meta falla, solo queda en el log. */
export async function sendCapi(evt: CleanEvent, ctx: Parameters<typeof capiPayload>[1]) {
  const token = capiToken();
  if (!token || !META_PIXEL_ID) return;
  const body = capiPayload(evt, ctx);
  if (!body) return;
  try {
    const testCode = clean(process.env.META_CAPI_TEST_CODE);
    const res = await fetch(`${GRAPH}/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testCode ? { ...body, test_event_code: testCode } : body),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) console.warn(JSON.stringify({ kind: "meta_capi", status: res.status, event: body.data[0].event_name }));
  } catch {
    console.warn(JSON.stringify({ kind: "meta_capi", status: "network", event: body.data[0].event_name }));
  }
}
