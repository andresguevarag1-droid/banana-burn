// Carrera objetivo (0054): guardar (crear o cambiar) y borrar. El plan se calcula en el servidor al mostrarlo.
import { createClient, getViewer } from "@/lib/supabase/server";
import { isSameOrigin } from "@/lib/security";
import { hitLimit } from "@/lib/security/limits";
import { parseRaceGoal, parseTime } from "@/lib/run-fitness";
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

/** Resultado de la carrera: tiempo oficial ("1:58:40") o una carrera con GPS del día de la carrera. */
export async function PATCH(req: Request) {
  if (!isSameOrigin(req)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const v = await getViewer();
  if (!v) return Response.json({ error: "Inicia sesión." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { time?: unknown; runId?: unknown } | null;
  if (v.demo) return Response.json({ ok: true, demo: true });
  const sb = await createClient();
  const { data: g } = await sb.from("race_goals").select("race_date,distance_m").eq("user_id", v.id).maybeSingle();
  if (!g) return Response.json({ error: "Primero elige tu carrera." }, { status: 400 });
  if (String(g.race_date).slice(0, 10) > todayFor(v).iso) return Response.json({ error: "Tu carrera todavía no ha pasado." }, { status: 400 });
  let resultS: number | null = null, resultRun: string | null = null;
  if (typeof body?.runId === "string" && /^[0-9a-f-]{36}$/i.test(body.runId)) {
    const { data: r } = await sb.from("runs").select("id,moving_s,day").eq("id", body.runId).eq("user_id", v.id).maybeSingle();
    if (!r) return Response.json({ error: "No encontramos esa carrera." }, { status: 400 });
    resultS = Number(r.moving_s); resultRun = String(r.id);
  } else {
    resultS = parseTime(body?.time);
    if (!resultS) return Response.json({ error: "Escribe tu tiempo como 25:30 o 1:58:40." }, { status: 400 });
  }
  const pace = resultS / (Number(g.distance_m) / 1000);
  if (pace < 150 || pace > 1200) return Response.json({ error: "Ese tiempo no parece de esta distancia. Revísalo." }, { status: 400 });
  const { error } = await sb.from("race_goals").update({ result_s: resultS, result_run: resultRun, updated_at: new Date().toISOString() }).eq("user_id", v.id);
  return error ? Response.json({ error: "No pudimos guardar tu resultado." }, { status: 500 }) : Response.json({ ok: true });
}
