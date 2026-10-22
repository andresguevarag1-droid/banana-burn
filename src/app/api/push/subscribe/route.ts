import { NextResponse } from "next/server";
import { createClient, getViewer } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Body = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };

const validEndpoint = (e: unknown): e is string => {
  if (typeof e !== "string" || e.length > 1024) return false;
  try { return new URL(e).protocol === "https:"; } catch { return false; }
};
const validKey = (k: unknown): k is string => typeof k === "string" && k.length > 0 && k.length < 256 && /^[A-Za-z0-9_\-=+/]+$/.test(k);

/** Guarda la suscripción Web Push del dispositivo actual. */
export async function POST(req: Request) {
  const v = await getViewer();
  if (!v) return NextResponse.json({ ok: false, error: "Inicia sesión." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Body;
  if (!validEndpoint(b.endpoint) || !validKey(b.keys?.p256dh) || !validKey(b.keys?.auth)) return NextResponse.json({ ok: false, error: "Suscripción inválida." }, { status: 400 });
  if (v.demo) return NextResponse.json({ ok: true, demo: true });
  const row = { user_id: v.id, endpoint: b.endpoint, p256dh: b.keys!.p256dh as string, auth: b.keys!.auth as string, user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null };
  // Con service_role: si el mismo navegador lo usaba otra cuenta, la suscripción pasa a la cuenta actual.
  const admin = adminClient();
  const sb = admin ?? (await createClient());
  const { error } = await sb.from("push_subscriptions").upsert(row, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ ok: false, error: "No se pudo guardar." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Elimina la suscripción del dispositivo actual. */
export async function DELETE(req: Request) {
  const v = await getViewer();
  if (!v) return NextResponse.json({ ok: false, error: "Inicia sesión." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Body;
  if (!validEndpoint(b.endpoint)) return NextResponse.json({ ok: false, error: "Falta endpoint." }, { status: 400 });
  if (v.demo) return NextResponse.json({ ok: true, demo: true });
  const sb = await createClient();
  await sb.from("push_subscriptions").delete().eq("user_id", v.id).eq("endpoint", b.endpoint);
  return NextResponse.json({ ok: true });
}
