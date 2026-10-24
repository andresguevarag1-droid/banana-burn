import { NextResponse } from "next/server";
import { createClient, getViewer } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { deleteAccountData } from "@/lib/admin-account";
import { isSameOrigin } from "@/lib/security";
import { hitLimit, tooMany } from "@/lib/security/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Derecho de supresión (Ley 8968). La secuencia completa vive en deleteAccountData (la misma que usa el panel). */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ ok: false, error: "Origen no permitido." }, { status: 403 });
  const v = await getViewer();
  if (!v) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { confirm?: string };
  if (body.confirm !== "BORRAR") return NextResponse.json({ ok: false, error: "Escribe BORRAR para confirmar." }, { status: 400 });
  if (v.demo) return NextResponse.json({ ok: true, demo: true });
  const lim = await hitLimit("cuenta:borrar", v.id);
  if (!lim.ok) return tooMany(lim);
  const admin = adminClient();
  if (!admin) return NextResponse.json({ ok: false, error: "El borrado no está configurado todavía. Escríbenos a hola@bananaburn.app y lo hacemos en 48 h." }, { status: 503 });
  const r = await deleteAccountData(admin, v.id);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
  await (await createClient()).auth.signOut().catch(() => {});
  return NextResponse.json({ ok: true });
}
