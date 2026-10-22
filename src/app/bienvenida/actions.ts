"use server";
import { createClient, getViewer } from "@/lib/supabase/server";
import { crToday } from "@/lib/today";

export type Onboard = { name: string; goal: "grasa" | "recomp" | "fuerza"; sex: "m" | "f"; dob: string; heightCm: number; weight: number; goalWeight: number; goalDate: string; days: number; equipment: "gym" | "casa" | "mixto"; consent: boolean };

export async function completeOnboarding(o: Onboard): Promise<{ ok: boolean; error?: string }> {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Inicia sesión." };
  if (!o.consent) return { ok: false, error: "Necesitamos tu consentimiento para procesar tus datos de salud." };
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(o.dob) && /^\d{4}-\d{2}-\d{2}$/.test(o.goalDate) && o.heightCm >= 120 && o.heightCm <= 230 && o.weight >= 35 && o.weight <= 300 && o.goalWeight >= 35 && o.goalWeight <= 300 && [3, 4, 5, 6].includes(o.days);
  if (!valid) return { ok: false, error: "Revisa los datos ingresados." };
  if (v.demo) return { ok: true };
  const sb = await createClient();
  const p = await sb.from("profiles").update({
    full_name: o.name.slice(0, 60) || null, dob: o.dob, sex: o.sex, height_cm: o.heightCm, train_days: o.days, equipment: o.equipment, goal_type: o.goal,
    onboarded: true, health_consent_at: new Date().toISOString(),
  }).eq("id", v.id);
  if (p.error) return { ok: false, error: "No se pudo guardar tu perfil." };
  await sb.from("goals").update({ active: false }).eq("user_id", v.id).eq("active", true);
  const g = await sb.from("goals").insert({ user_id: v.id, start_weight: o.weight, goal_weight: o.goalWeight, goal_date: o.goalDate, mode: o.goal === "grasa" ? "acelerada" : "recomp" });
  if (g.error) return { ok: false, error: "No se pudo guardar tu meta." };
  await sb.from("weights").upsert({ user_id: v.id, day: crToday().iso, kg: o.weight }, { onConflict: "user_id,day" });
  await sb.from("xp_events").insert({ user_id: v.id, kind: "onboard", xp: 50 });
  return { ok: true };
}
