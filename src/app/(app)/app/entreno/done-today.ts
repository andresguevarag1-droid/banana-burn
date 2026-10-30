import "server-only";
import { createClient, type Viewer } from "@/lib/supabase/server";
import { todayFor } from "@/lib/today";

/** Plantillas que el usuario ya entrenó hoy (en su zona horaria). En demo no hay registros. */
export async function templatesDoneToday(v: Viewer): Promise<string[]> {
  if (v.demo) return [];
  const sb = await createClient();
  const { data } = await sb.from("workouts").select("template").eq("user_id", v.id).eq("day", todayFor(v).iso);
  return (data ?? []).map((r) => String(r.template ?? ""));
}

/** ¿Ya guardó algún entreno? Decide el primer entreno corto en el servidor. En demo cuenta como sí (la demo tiene historial). */
export async function hasSavedWorkout(v: Viewer): Promise<boolean> {
  if (v.demo) return true;
  const sb = await createClient();
  const { count, error } = await sb.from("workouts").select("id", { count: "exact", head: true }).eq("user_id", v.id).limit(1);
  // Si la lectura falla, la rutina normal: nunca un entreno corto por error a quien ya entrena.
  return !!error || (count ?? 0) > 0;
}
