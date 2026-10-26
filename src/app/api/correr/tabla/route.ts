// Tabla semanal de km (0055): sumarse o salirse. Apagada por defecto.
import { createClient, getViewer } from "@/lib/supabase/server";
import { isSameOrigin } from "@/lib/security";
import { hitLimit } from "@/lib/security/limits";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const v = await getViewer();
  if (!v) return Response.json({ error: "Inicia sesión." }, { status: 401 });
  if (v.demo) return Response.json({ ok: true, demo: true });
  const lim = await hitLimit("correr:objetivo", v.id);
  if (!lim.ok) return Response.json({ error: lim.error }, { status: 429 });
  const { error } = await (await createClient()).from("run_board").upsert({ user_id: v.id }, { onConflict: "user_id", ignoreDuplicates: true });
  return error ? Response.json({ error: error.code === "42501" ? "Necesitas tu plan o la prueba gratis." : "No pudimos sumarte." }, { status: 500 }) : Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!isSameOrigin(req)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const v = await getViewer();
  if (!v) return Response.json({ error: "Inicia sesión." }, { status: 401 });
  if (v.demo) return Response.json({ ok: true, demo: true });
  const { error } = await (await createClient()).from("run_board").delete().eq("user_id", v.id);
  return error ? Response.json({ error: "No pudimos sacarte de la tabla." }, { status: 500 }) : Response.json({ ok: true });
}
