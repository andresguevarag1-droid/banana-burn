// Tus tenis (0055): agregar un par (retira el anterior) y retirar. Los km se calculan con tus carreras.
import { createClient, getViewer } from "@/lib/supabase/server";
import { isSameOrigin } from "@/lib/security";
import { hitLimit } from "@/lib/security/limits";
import { todayFor } from "@/lib/today";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const v = await getViewer();
  if (!v) return Response.json({ error: "Inicia sesión." }, { status: 401 });
  const b = (await req.json().catch(() => null)) as { name?: unknown; startKm?: unknown } | null;
  const name = typeof b?.name === "string" ? b.name.trim().replace(/\s+/g, " ").slice(0, 60) : "";
  const startKm = Number(String(b?.startKm ?? "0").replace(",", ".")) || 0;
  if (!name) return Response.json({ error: "Escribe el nombre de tus tenis." }, { status: 400 });
  if (startKm < 0 || startKm > 3000) return Response.json({ error: "Los km iniciales van de 0 a 3000." }, { status: 400 });
  if (v.demo) return Response.json({ ok: true, demo: true });
  const lim = await hitLimit("correr:objetivo", v.id);
  if (!lim.ok) return Response.json({ error: lim.error }, { status: 429 });
  const sb = await createClient();
  const today = todayFor(v).iso;
  await sb.from("run_shoes").update({ retired_on: today }).eq("user_id", v.id).is("retired_on", null);
  const { error } = await sb.from("run_shoes").insert({ user_id: v.id, name, start_km: Math.round(startKm * 10) / 10, since: today });
  return error ? Response.json({ error: error.code === "42501" ? "Necesitas tu plan o la prueba gratis." : "No pudimos guardar tus tenis." }, { status: 500 }) : Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!isSameOrigin(req)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const v = await getViewer();
  if (!v) return Response.json({ error: "Inicia sesión." }, { status: 401 });
  if (v.demo) return Response.json({ ok: true, demo: true });
  const { error } = await (await createClient()).from("run_shoes").update({ retired_on: todayFor(v).iso }).eq("user_id", v.id).is("retired_on", null);
  return error ? Response.json({ error: "No pudimos retirar tus tenis." }, { status: 500 }) : Response.json({ ok: true });
}
