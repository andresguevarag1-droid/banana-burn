"use server";
import { revalidatePath } from "next/cache";
import { createClient, getViewer } from "@/lib/supabase/server";

export async function updateTraining(input: { days: number; equipment: "gym" | "casa" | "mixto" | "ninguno"; mode: "acelerada" | "recomp"; level: "principiante" | "intermedio" | "avanzado"; minutes: number | null }) {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Inicia sesión." };
  if (![3, 4, 5, 6].includes(input.days) || !["gym", "casa", "mixto", "ninguno"].includes(input.equipment) || !["acelerada", "recomp"].includes(input.mode) || !["principiante", "intermedio", "avanzado"].includes(input.level) || (input.minutes != null && ![20, 30, 45, 60].includes(input.minutes))) return { ok: false, error: "Datos inválidos." };
  if (v.demo) return { ok: true, demo: true };
  const sb = await createClient();
  const a = await sb.from("profiles").update({ train_days: input.days, equipment: input.equipment, level: input.level, session_minutes: input.minutes }).eq("id", v.id);
  const b = await sb.from("goals").update({ mode: input.mode }).eq("user_id", v.id).eq("active", true);
  if (a.error || b.error) return { ok: false, error: "No se pudo guardar." };
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function updateGlp1(input: { on: boolean; med: "semaglutida" | "tirzepatida" | "liraglutida" | "otro"; dow: number | null }) {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Inicia sesión." };
  if (!["semaglutida", "tirzepatida", "liraglutida", "otro"].includes(input.med) || (input.dow != null && !(input.dow >= 0 && input.dow <= 6))) return { ok: false, error: "Datos inválidos." };
  if (v.demo) return { ok: true, demo: true };
  const sb = await createClient();
  const { data: prev } = await sb.from("profiles").select("glp1,glp1_since").eq("id", v.id).maybeSingle();
  const { error } = await sb.from("profiles").update({
    glp1: input.on, glp1_med: input.on ? input.med : null, glp1_injection_dow: input.on ? input.dow : null,
    glp1_since: input.on ? (prev?.glp1 ? prev.glp1_since : new Date().toISOString().slice(0, 10)) : null,
  }).eq("id", v.id);
  if (error) return { ok: false, error: "No se pudo guardar." };
  revalidatePath("/app", "layout");
  return { ok: true };
}
