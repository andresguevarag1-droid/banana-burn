// Carrera objetivo (0054): guardar (crear o cambiar) y borrar. El plan se calcula en el servidor al mostrarlo.
import { createClient, getViewer } from "@/lib/supabase/server";
import { isSameOrigin } from "@/lib/security";
import { hitLimit } from "@/lib/security/limits";
import { parseRaceGoal } from "@/lib/run-fitness";
import { todayFor } from "@/lib/today";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const v = await getViewer();
  if (!v) return Response.json({ error: "Inicia sesión para guardar tu carrera." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const today = todayFor(v).iso;
  const p = parseRaceGoal(body, today);
  if (!p.ok) return Response.json({ error: p.error }, { status: 400 });
  if (v.demo) return Response.json({ ok: true, demo: true });
  const lim = await hitLimit("correr:objetivo", v.id);
  if (!lim.ok) return Response.json({ error: lim.error }, { status: 429 });
  const sb = await createClient();
  const { data: prev } = await sb.from("race_goals").select("race_date,kind,distance_m,plan_start").eq("user_id", v.id).maybeSingle();
  const g = p.goal;
  // El plan arranca cuando se elige la carrera; si solo cambia la meta o el nombre, sigue donde iba.
  const same = prev && String(prev.race_date).slice(0, 10) === g.raceDate && prev.kind === g.kind && Number(prev.distance_m) === g.distanceM;
  const row = {
    user_id: v.id, name: g.name, race_date: g.raceDate, kind: g.kind, distance_m: g.distanceM, goal_s: g.goalS, recent_distance_m: g.recentDistanceM, recent_s: g.recentS,
    own_plan: g.ownPlan, hard_days: g.hardDays, plan_start: same ? String(prev!.plan_start).slice(0, 10) : today, updated_at: new Date().toISOString(),
    ...(same ? {} : { result_s: null, result_run: null }),
  };
  const { error } = await sb.from("race_goals").upsert(row, { onConflict: "user_id" });
  if (error) return Response.json({ error: error.code === "42501" ? "Necesitas tu plan o la prueba gratis para guardar tu carrera." : "No pudimos guardar tu carrera. Intenta de nuevo." }, { status: error.code === "42501" ? 403 : 500 });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!isSameOrigin(req)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const v = await getViewer();
  if (!v) return Response.json({ error: "Inicia sesión." }, { status: 401 });
  if (v.demo) return Response.json({ ok: true, demo: true });
  const { error } = await (await createClient()).from("race_goals").delete().eq("user_id", v.id);
  return error ? Response.json({ error: "No pudimos borrar tu carrera." }, { status: 500 }) : Response.json({ ok: true });
}
