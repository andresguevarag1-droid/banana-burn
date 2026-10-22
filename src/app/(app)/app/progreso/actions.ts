"use server";
import { revalidatePath } from "next/cache";
import { createClient, getViewer } from "@/lib/supabase/server";
import { crToday } from "@/lib/today";

export type FormState = { ok?: string; error?: string };

export async function logWeight(_: FormState, fd: FormData): Promise<FormState> {
  const v = await getViewer();
  if (!v) return { error: "Inicia sesión." };
  const kg = Number(String(fd.get("kg")).replace(",", "."));
  if (!(kg >= 30 && kg <= 300)) return { error: "Peso inválido." };
  if (v.demo) return { ok: `Demo: registrarías ${kg} kg.` };
  const sb = await createClient();
  const { error } = await sb.from("weights").upsert({ user_id: v.id, day: crToday().iso, kg }, { onConflict: "user_id,day" });
  if (error) return { error: "No se pudo guardar." };
  revalidatePath("/app", "layout");
  return { ok: `¡Listo! ${kg} kg guardado ✅` };
}

export async function saveProfile(_: FormState, fd: FormData): Promise<FormState> {
  const v = await getViewer();
  if (!v) return { error: "Inicia sesión." };
  if (v.demo) return { ok: "Demo: perfil no guardado." };
  const g = (k: string) => String(fd.get(k) ?? "").trim();
  const start = Number(g("start_weight").replace(",", ".")), goal = Number(g("goal_weight").replace(",", "."));
  if (!g("dob") || !g("height_cm") || !start || !goal || !g("goal_date")) return { error: "Completa todos los campos." };
  if (!fd.get("health_consent")) return { error: "Necesitamos tu consentimiento para procesar datos de salud." };
  const sb = await createClient();
  const p = await sb.from("profiles").update({ full_name: g("full_name") || null, dob: g("dob"), height_cm: Number(g("height_cm")), sex: g("sex") || "m", onboarded: true, health_consent_at: new Date().toISOString() }).eq("id", v.id);
  if (p.error) return { error: "No se pudo guardar el perfil." };
  await sb.from("goals").update({ active: false }).eq("user_id", v.id).eq("active", true);
  const r = await sb.from("goals").insert({ user_id: v.id, start_weight: start, goal_weight: goal, goal_date: g("goal_date"), mode: g("mode") === "recomp" ? "recomp" : "acelerada" });
  if (r.error) return { error: "No se pudo guardar la meta." };
  await sb.from("weights").upsert({ user_id: v.id, day: crToday().iso, kg: start }, { onConflict: "user_id,day", ignoreDuplicates: true });
  revalidatePath("/app", "layout");
  return { ok: "¡Plan calculado! 🎉" };
}
