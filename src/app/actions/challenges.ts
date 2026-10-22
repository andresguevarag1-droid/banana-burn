"use server";
import { revalidatePath } from "next/cache";
import { createClient, getViewer } from "@/lib/supabase/server";
import { crToday } from "@/lib/today";
import { CHALLENGE_BY_ID } from "@/lib/challenges";

export async function joinChallenge(id: string) {
  const v = await getViewer();
  if (!v || typeof id !== "string" || !Object.hasOwn(CHALLENGE_BY_ID, id)) return { ok: false };
  if (v.demo) return { ok: true, demo: true };
  const sb = await createClient();
  const { count } = await sb.from("user_challenges").select("*", { count: "exact", head: true }).eq("user_id", v.id).eq("status", "activo");
  if ((count ?? 0) >= 3) return { ok: false, error: "Máximo 3 retos a la vez. Termina uno para empezar otro." };
  const { error } = await sb.from("user_challenges").insert({ user_id: v.id, challenge_id: id, started_on: crToday().iso });
  revalidatePath("/app", "layout");
  return { ok: !error, error: error ? "Ya estás en este reto." : undefined };
}

export async function checkInChallenge(ucId: string) {
  const v = await getViewer();
  if (!v) return { ok: false };
  if (v.demo) return { ok: true, demo: true };
  const sb = await createClient();
  const { data: uc } = await sb.from("user_challenges").select("id,challenge_id").eq("id", Number(ucId)).eq("user_id", v.id).eq("status", "activo").maybeSingle();
  if (!uc || CHALLENGE_BY_ID[uc.challenge_id as string]?.verify !== "manual") return { ok: false };
  const { data: added, error } = await sb.from("challenge_checkins").upsert({ user_challenge_id: uc.id, user_id: v.id, day: crToday().iso }, { onConflict: "user_challenge_id,day", ignoreDuplicates: true }).select("day");
  // XP solo la primera vez del día (antes se sumaba en cada clic).
  if (!error && added?.length) await sb.from("xp_events").insert({ user_id: v.id, kind: "challenge_day", xp: 10 });
  revalidatePath("/app", "layout");
  return { ok: !error };
}

export async function leaveChallenge(ucId: string) {
  const v = await getViewer();
  if (!v || v.demo) return { ok: true };
  const sb = await createClient();
  await sb.from("user_challenges").update({ status: "abandonado" }).eq("id", Number(ucId)).eq("user_id", v.id);
  revalidatePath("/app", "layout");
  return { ok: true };
}
