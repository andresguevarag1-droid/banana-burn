"use server";
import { revalidatePath } from "next/cache";
import { createClient, getViewer } from "@/lib/supabase/server";

export async function updateTraining(input: { days: number; equipment: "gym" | "casa" | "mixto"; mode: "acelerada" | "recomp" }) {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Inicia sesión." };
  if (![3, 4, 5, 6].includes(input.days) || !["gym", "casa", "mixto"].includes(input.equipment) || !["acelerada", "recomp"].includes(input.mode)) return { ok: false, error: "Datos inválidos." };
  if (v.demo) return { ok: true, demo: true };
  const sb = await createClient();
  const a = await sb.from("profiles").update({ train_days: input.days, equipment: input.equipment }).eq("id", v.id);
  const b = await sb.from("goals").update({ mode: input.mode }).eq("user_id", v.id).eq("active", true);
  if (a.error || b.error) return { ok: false, error: "No se pudo guardar." };
  revalidatePath("/app", "layout");
  return { ok: true };
}
