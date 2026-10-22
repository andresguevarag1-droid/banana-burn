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
