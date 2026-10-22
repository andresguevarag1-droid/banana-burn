import { createClient, getViewer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const TABLES = ["profiles", "goals", "weights", "measurements", "daily_logs", "meals", "workouts", "workout_sets", "coach_messages", "xp_events", "subscriptions"] as const;

/** Derecho de acceso (Ley 8968): descarga todos tus datos en JSON. */
export async function GET() {
  const v = await getViewer();
  if (!v) return new Response("No autorizado", { status: 401 });
  const out: Record<string, unknown> = { exportado: new Date().toISOString(), cuenta: { id: v.id, email: v.email } };
  if (!v.demo) {
    const sb = await createClient();
    for (const t of TABLES) {
      const q = t === "profiles" ? sb.from(t).select("*").eq("id", v.id) : sb.from(t).select("*").eq("user_id", v.id);
      const { data } = await q;
      out[t] = data ?? [];
    }
  } else out.nota = "Modo demo: no hay datos reales.";
  return new Response(JSON.stringify(out, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="banana-burn-mis-datos-${new Date().toISOString().slice(0, 10)}.json"` },
  });
}
