"use server";
import { revalidatePath } from "next/cache";
import { creditChallenges } from "@/lib/challenges-server";
import { createClient, getViewer } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements";
import { APP_LOCKED_MSG, DAILY_NEED, NUTRITION_LOCKED_MSG, canSetDaily } from "@/lib/plan-access";
import { todayFor } from "@/lib/today";

const COL = { water: "water_glasses", steps: "steps", sleep: "sleep_h", protein: "protein_g", kcal: "kcal", energy: "energy", nausea: "nausea", fiber: "fiber_g" } as const;
const MAX = { water: 20, steps: 80000, sleep: 16, protein: 500, kcal: 8000, energy: 3, nausea: 3, fiber: 150 };
export type DailyField = keyof typeof COL;

/**
 * Guarda un valor del día (absoluto). XP la primera vez que se registra algo hoy.
 * Agua, pasos, sueño y energía: cualquier plan. Calorías, proteína, fibra y náusea: solo con nutrición (plan-access.ts).
 */
export async function setDaily(field: DailyField, value: number): Promise<{ ok: boolean; demo?: boolean; error?: string }> {
  const v = await getViewer();
  if (!v) return { ok: false };
  if (!Object.hasOwn(COL, field) || !Number.isFinite(value)) return { ok: false };
  const ent = await getEntitlements(v);
  if (!canSetDaily(field, ent)) return { ok: false, error: DAILY_NEED[field] === "nutrition" && ent.app ? NUTRITION_LOCKED_MSG : APP_LOCKED_MSG };
  const val = Math.max(0, Math.min(MAX[field], value));
  if (v.demo) return { ok: true, demo: true };
  const sb = await createClient();
  const day = todayFor(v).iso;
  const { data: existing } = await sb.from("daily_logs").select("day").eq("user_id", v.id).eq("day", day).maybeSingle();
  const { error } = await sb.from("daily_logs").upsert({ user_id: v.id, day, [COL[field]]: val }, { onConflict: "user_id,day" });
  if (error) return { ok: false };
  if (!existing) await sb.from("xp_events").insert({ user_id: v.id, kind: "checkin", xp: 15 });
  await creditChallenges(v).catch(() => null);
  revalidatePath("/app");
  return { ok: true };
}
