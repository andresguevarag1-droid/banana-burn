import { NextResponse } from "next/server";
import { createClient, getViewer } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { isKnownPushEndpoint, isSameOrigin } from "@/lib/security";
import { hitLimit, tooMany } from "@/lib/security/limits";

export const runtime = "nodejs";

type Body = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };

// Solo servicios de push reales (FCM, Mozilla, Apple, Windows): el cron hace POST a este URL desde el servidor.
const validEndpoint = isKnownPushEndpoint;
const validKey = (k: unknown): k is string => typeof k === "string" && k.length > 0 && k.length < 256 && /^[A-Za-z0-9_\-=+/]+$/.test(k);

/** Guarda la suscripción Web Push del dispositivo actual. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ ok: false, error: "Origen no permitido." }, { status: 403 });
  const v = await getViewer();
  if (!v) return NextResponse.json({ ok: false, error: "Inicia sesión." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Body;
  if (!validEndpoint(b.endpoint) || !validKey(b.keys?.p256dh) || !validKey(b.keys?.auth)) return NextResponse.json({ ok: false, error: "Suscripción inválida." }, { status: 400 });
  if (v.demo) return NextResponse.json({ ok: true, demo: true });
  const lim = await hitLimit("push:suscribir", v.id);
  if (!lim.ok) return tooMany(lim);
  const row = { user_id: v.id, endpoint: b.endpoint, p256dh: b.keys!.p256dh as string, auth: b.keys!.auth as string, user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null };
  // Si el mismo navegador lo usaba otra cuenta, la suscripción pasa a la cuenta actual (se borra la vieja con
  // service_role y se inserta con la sesión del usuario: así aplican RLS, el CHECK del endpoint y el tope por usuario).
  const sb = await createClient();
  const admin = adminClient();
  if (admin) await admin.from("push_subscriptions").delete().eq("endpoint", row.endpoint).neq("user_id", v.id);
  const { error } = await sb.from("push_subscriptions").upsert(row, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ ok: false, error: "No se pudo guardar." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Elimina la suscripción del dispositivo actual. */
export async function DELETE(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ ok: false, error: "Origen no permitido." }, { status: 403 });
  const v = await getViewer();
  if (!v) return NextResponse.json({ ok: false, error: "Inicia sesión." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Body;
  if (typeof b.endpoint !== "string" || b.endpoint.length > 1024) return NextResponse.json({ ok: false, error: "Falta endpoint." }, { status: 400 });
  if (v.demo) return NextResponse.json({ ok: true, demo: true });
  const lim = await hitLimit("push:suscribir", v.id);
  if (!lim.ok) return tooMany(lim);
  const sb = await createClient();
  await sb.from("push_subscriptions").delete().eq("user_id", v.id).eq("endpoint", b.endpoint);
  return NextResponse.json({ ok: true });
}
