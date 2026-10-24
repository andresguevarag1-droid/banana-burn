"use server";
// Hábitos que la persona marca a mano dentro de su programa activo (0027: daily_logs.program_checks).
import { revalidatePath } from "next/cache";
import { createClient, getViewer } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements";
import { getActiveProgram } from "@/lib/programs-server";
import { APP_LOCKED_MSG } from "@/lib/plan-access";
import { HABIT_KEY } from "@/lib/programs";
import { todayFor } from "@/lib/today";
import { limitError } from "@/lib/security/limits";

export async function toggleProgramHabit(key: string, on: boolean): Promise<{ ok: boolean; demo?: boolean; error?: string }> {
  const v = await getViewer();
  if (!v) return { ok: false };
  { const lim = v.demo ? null : await limitError("registro", v.id); if (lim) return { ok: false, error: lim }; }
  if (typeof key !== "string" || !HABIT_KEY.test(key)) return { ok: false };
  const ent = await getEntitlements(v);
  if (!ent.app) return { ok: false, error: APP_LOCKED_MSG };
  const p = await getActiveProgram(v);
  // Solo los hábitos del programa activo que se marcan a mano.
  const habit = p?.c.program.experience?.habits.find((h) => h.key === key);
  if (!habit) return { ok: false, error: "Ese hábito no es de tu programa activo." };
  if (v.demo) return { ok: true, demo: true };
  const sb = await createClient();
  const day = todayFor(v).iso;
  const { data, error: readErr } = await sb.from("daily_logs").select("program_checks").eq("user_id", v.id).eq("day", day).maybeSingle();
  if (readErr) return { ok: false, error: "No se pudo guardar. Intenta de nuevo." };
  const cur = new Set<string>(((data?.program_checks as string[] | null) ?? []).filter((k) => HABIT_KEY.test(k)));
  if (on) cur.add(key); else cur.delete(key);
  const { error } = await sb.from("daily_logs").upsert({ user_id: v.id, day, program_checks: [...cur].slice(0, 8) }, { onConflict: "user_id,day" });
  if (error) return { ok: false, error: "No se pudo guardar. Intenta de nuevo." };
  revalidatePath("/app");
  return { ok: true };
}
