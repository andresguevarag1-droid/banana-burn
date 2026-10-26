// Guardar y borrar carreras con GPS (0049). El servidor recalcula todo con los puntos y guarda el mapa recortado.
// Idempotente: el navegador manda un id de carrera (client_id); si ya existe, responde con la misma carrera.
import { createClient, getViewer } from "@/lib/supabase/server";
import { isSameOrigin } from "@/lib/security";
import { hitLimit } from "@/lib/security/limits";
import { privacyTrim, processUpload } from "@/lib/runs";
import { todayIn } from "@/lib/today";
import { runXp } from "@/lib/run-badges";

export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const v = await getViewer();
  if (!v) return Response.json({ error: "Inicia sesión para guardar tu carrera." }, { status: 401 });
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 3_000_000) return Response.json({ error: "La carrera es demasiado larga para guardarla." }, { status: 413 });
  const body = (await req.json().catch(() => null)) as { clientId?: unknown; segments?: unknown } | null;
  const clientId = typeof body?.clientId === "string" && UUID.test(body.clientId) ? body.clientId : null;
  if (!clientId) return Response.json({ error: "Carrera inválida." }, { status: 400 });
  const run = processUpload(body?.segments);
  if (!run) return Response.json({ error: "No pudimos medir esta carrera: muy corta o con mala señal de GPS." }, { status: 422 });
  if (v.demo) return Response.json({ id: "demo-0", demo: true });
  const lim = await hitLimit("carreras:guardar", v.id);
  if (!lim.ok) return Response.json({ error: lim.error }, { status: 429 });
  const sb = await createClient();
  const row = {
    user_id: v.id, client_id: clientId, day: todayIn(v.tz, new Date(run.startedAt)).iso,
    started_at: new Date(run.startedAt).toISOString(), ended_at: new Date(run.endedAt).toISOString(),
    distance_m: run.stats.distanceM, moving_s: run.stats.movingS, pace_s_km: run.stats.paceSKm, splits: run.stats.splits,
    // Solo se guarda lo necesario para el mapa: lat, lng y tiempo, sin los primeros ni los últimos 200 m.
    track: privacyTrim(run.track).map((s) => s.map((p) => ({ t: p.t, lat: Math.round(p.lat * 1e6) / 1e6, lng: Math.round(p.lng * 1e6) / 1e6, acc: Math.round(p.acc) }))),
  };
  const { data, error } = await sb.from("runs").insert(row).select("id").single();
  if (error?.code === "23505") {
    const { data: had } = await sb.from("runs").select("id").eq("user_id", v.id).eq("client_id", clientId).maybeSingle();
    if (had) return Response.json({ id: had.id, repeated: true });
  }
  if (error) return Response.json({ error: error.code === "42501" ? "Necesitas tu plan o la prueba gratis para guardar carreras." : "No pudimos guardar tu carrera. Queda en tu teléfono; intenta de nuevo." }, { status: error.code === "42501" ? 403 : 500 });
  // XP por correr (0055): lo respalda la carrera recién guardada; sin la migración, la base lo rechaza y no pasa nada.
  await sb.from("xp_events").insert({ user_id: v.id, kind: "run", xp: runXp(run.stats.distanceM) }).then(() => undefined, () => undefined);
  return Response.json({ id: data.id });
}

export async function DELETE(req: Request) {
  if (!isSameOrigin(req)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const v = await getViewer();
  if (!v) return Response.json({ error: "Inicia sesión." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (v.demo) return Response.json({ ok: true, demo: true });
  if (!UUID.test(id)) return Response.json({ error: "Carrera inválida." }, { status: 400 });
  const { error } = await (await createClient()).from("runs").delete().eq("id", id).eq("user_id", v.id);
  return error ? Response.json({ error: "No pudimos borrar la carrera." }, { status: 500 }) : Response.json({ ok: true });
}
