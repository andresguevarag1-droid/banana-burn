"use server";
import { revalidatePath } from "next/cache";
import { createClient, getViewer } from "@/lib/supabase/server";
import { crToday } from "@/lib/today";

const COL = { water: "water_glasses", steps: "steps", sleep: "sleep_h", protein: "protein_g", kcal: "kcal", energy: "energy" } as const;
const MAX = { water: 20, steps: 80000, sleep: 16, protein: 500, kcal: 8000, energy: 3 };
export type DailyField = keyof typeof COL;

/** Guarda un valor del día (absoluto). XP la primera vez que se registra algo hoy. */
export async function setDaily(field: DailyField, value: number) {
  const v = await getViewer();
  if (!v) return { ok: false };
  if (!(field in COL) || !Number.isFinite(value)) return { ok: false };
  const val = Math.max(0, Math.min(MAX[field], value));
  if (v.demo) return { ok: true, demo: true };
  const sb = await createClient();
  const day = crToday().iso;
  const { data: existing } = await sb.from("daily_logs").select("day").eq("user_id", v.id).eq("day", day).maybeSingle();
  const { error } = await sb.from("daily_logs").upsert({ user_id: v.id, day, [COL[field]]: val }, { onConflict: "user_id,day" });
  if (error) return { ok: false };
  if (!existing) await sb.from("xp_events").insert({ user_id: v.id, kind: "checkin", xp: 15 });
  revalidatePath("/app");
  return { ok: true };
}
