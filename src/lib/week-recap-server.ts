// "Tu semana con Banana Burn": los lunes, un resumen honesto de la semana pasada y lo que cambia en el plan por lo que
// la persona anotó. Solo servidor. Todo sale de sus datos reales (workouts, workout_sets y la progresión del motor).
import "server-only";
import { createClient, type Viewer } from "@/lib/supabase/server";
import { EX, prescribe, type SlotCfg } from "@/lib/engine";
import { getHistory } from "@/lib/history";
import { recapFrom, type WeekRecap } from "@/lib/week-recap";

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Solo el lunes (en la zona de la persona) y si la semana pasada tiene algo que contar. Nunca lanza para la pantalla. */
export async function weekRecapFor(v: Viewer, today: { iso: string; dow: number }, trainDays: number, nextExercises: { id: string; name: string; cfg: SlotCfg }[]): Promise<WeekRecap | null> {
  if (today.dow !== 1 || v.demo) return null;
  const mon = Date.parse(today.iso + "T12:00:00Z") - 7 * 864e5;
  const from = iso(mon), to = iso(mon + 6 * 864e5);
  const sb = await createClient();
  const { data: ws } = await sb.from("workouts").select("id,day").eq("user_id", v.id).gte("day", from).lte("day", to).limit(30);
  const ids = (ws ?? []).map((w) => w.id as string);
  let sets = 0;
  if (ids.length) {
    const { count } = await sb.from("workout_sets").select("id", { count: "exact", head: true }).eq("user_id", v.id).in("workout_id", ids);
    sets = count ?? 0;
  }
  // Lo que cambia: ejercicios de la próxima sesión donde el motor ya pide más peso o más repeticiones.
  const weighted = nextExercises.filter((e) => (EX[e.id as keyof typeof EX]?.inc ?? 0) > 0).slice(0, 8);
  const hist = weighted.length ? await getHistory(v, weighted.map((e) => e.id)) : {};
  const ups = weighted.map((e) => ({ name: e.name, rx: prescribe(e.id, e.cfg, hist[e.id] ?? []) })).filter((x) => x.rx.type === "up" || x.rx.type === "reps");
  return recapFrom({ weekOf: from, workouts: new Set((ws ?? []).map((w) => w.day as string)).size, sets, planned: trainDays, heavier: ups.filter((u) => u.rx.type === "up").map((u) => u.name), moreReps: ups.filter((u) => u.rx.type === "reps").length });
}
