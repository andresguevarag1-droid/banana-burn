import { NextResponse } from "next/server";
import { createClient, getViewer } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

/** Derecho de supresión (Ley 8968): borra la cuenta y, en cascada, todos sus datos. */
export async function POST(req: Request) {
  const v = await getViewer();
  if (!v) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { confirm?: string };
  if (body.confirm !== "BORRAR") return NextResponse.json({ ok: false, error: "Escribe BORRAR para confirmar." }, { status: 400 });
  if (v.demo) return NextResponse.json({ ok: true, demo: true });
  const admin = adminClient();
  if (!admin) return NextResponse.json({ ok: false, error: "El borrado no está configurado todavía. Escríbenos a hola@bananaburn.app y lo hacemos en 48 h." }, { status: 503 });
  const { error } = await admin.auth.admin.deleteUser(v.id);
  if (error) return NextResponse.json({ ok: false, error: "No se pudo borrar la cuenta." }, { status: 500 });
  await (await createClient()).auth.signOut().catch(() => {});
  return NextResponse.json({ ok: true });
}
