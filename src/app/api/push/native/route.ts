import { NextResponse } from "next/server";
import { createClient, getViewer } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { isSameOrigin } from "@/lib/security";
import { hitLimit, tooMany } from "@/lib/security/limits";

export const runtime = "nodejs";

// Token de avisos de la app nativa (0057): FCM en Android, APNs en iPhone. Lo manda src/lib/native/push.ts al registrarse
// y lo borra al cerrar sesión. Mismas reglas que la tabla (formato y largo) para responder 400 antes de ir a la base.
type Body = { token?: unknown; platform?: unknown; appVersion?: unknown };
const TOKEN = /^[A-Za-z0-9:_.-]{32,4096}$/;
const validToken = (t: unknown): t is string => typeof t === "string" && TOKEN.test(t);
const validPlatform = (p: unknown): p is "ios" | "android" => p === "ios" || p === "android";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ ok: false, error: "Origen no permitido." }, { status: 403 });
  const v = await getViewer();
  if (!v) return NextResponse.json({ ok: false, error: "Inicia sesión." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Body;
  if (!validToken(b.token) || !validPlatform(b.platform)) return NextResponse.json({ ok: false, error: "Token inválido." }, { status: 400 });
  if (v.demo) return NextResponse.json({ ok: true, demo: true });
  const lim = await hitLimit("push:suscribir", v.id);
  if (!lim.ok) return tooMany(lim);
  const appVersion = typeof b.appVersion === "string" ? b.appVersion.slice(0, 40) : null;
  // Si en ese teléfono había otra cuenta, el token pasa a la cuenta actual: se borra la fila vieja con service_role y se
  // inserta con la sesión (así aplican la RLS, los CHECK y el tope de 10 teléfonos por persona).
  const admin = adminClient();
  if (admin) await admin.from("native_push_tokens").delete().eq("token", b.token).neq("user_id", v.id);
  const sb = await createClient();
  const { error } = await sb.from("native_push_tokens").upsert(
    { user_id: v.id, platform: b.platform, token: b.token, app_version: appVersion, last_used_at: new Date().toISOString() },
    { onConflict: "token" },
  );
  if (error) return NextResponse.json({ ok: false, error: "No se pudo guardar." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Al cerrar sesión en la app: el teléfono deja de recibir los avisos de esta cuenta. */
export async function DELETE(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ ok: false, error: "Origen no permitido." }, { status: 403 });
  const v = await getViewer();
  if (!v) return NextResponse.json({ ok: false, error: "Inicia sesión." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Body;
  if (!validToken(b.token)) return NextResponse.json({ ok: false, error: "Token inválido." }, { status: 400 });
  if (v.demo) return NextResponse.json({ ok: true, demo: true });
  const lim = await hitLimit("push:suscribir", v.id);
  if (!lim.ok) return tooMany(lim);
  const sb = await createClient();
  await sb.from("native_push_tokens").delete().eq("user_id", v.id).eq("token", b.token);
  return NextResponse.json({ ok: true });
}
