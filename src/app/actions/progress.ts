"use server";
import { revalidatePath } from "next/cache";
import { createClient, getViewer } from "@/lib/supabase/server";
import { crToday } from "@/lib/today";

const FIELDS = ["waist", "neck", "chest", "arm", "thigh", "hip"] as const;

export async function saveMeasures(input: Partial<Record<(typeof FIELDS)[number], number | null>>) {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Inicia sesión." };
  const row: Record<string, number | null> = {};
  for (const f of FIELDS) {
    const x = input[f];
    if (x == null || x === 0) continue;
    if (!(x >= 15 && x <= 250)) return { ok: false, error: "Revisa las medidas (cm)." };
    row[f] = Math.round(x * 10) / 10;
  }
  if (!Object.keys(row).length) return { ok: false, error: "Anota al menos una medida." };
  if (v.demo) return { ok: true, demo: true };
  const sb = await createClient();
  const { error } = await sb.from("measurements").upsert({ user_id: v.id, day: crToday().iso, ...row }, { onConflict: "user_id,day" });
  if (error) return { ok: false, error: "No pudimos guardar tus medidas. Intenta de nuevo." };
  await sb.from("xp_events").insert({ user_id: v.id, kind: "measure", xp: 15 });
  revalidatePath("/app/progreso");
  return { ok: true };
}

export async function addPhoto(path: string, pose: string) {
  const v = await getViewer();
  if (!v || v.demo) return { ok: false };
  if (!path.startsWith(`${v.id}/`) || !["frente", "lado", "espalda"].includes(pose)) return { ok: false };
  const sb = await createClient();
  const { error } = await sb.from("progress_photos").insert({ user_id: v.id, day: crToday().iso, pose, path });
  if (!error) await sb.from("xp_events").insert({ user_id: v.id, kind: "photo", xp: 20 });
  revalidatePath("/app/progreso");
  return { ok: !error };
}

export async function deletePhoto(id: string) {
  const v = await getViewer();
  if (!v || v.demo) return { ok: false };
  const sb = await createClient();
  const { data } = await sb.from("progress_photos").select("path").eq("id", Number(id)).eq("user_id", v.id).maybeSingle();
  if (!data) return { ok: false };
  await sb.storage.from("progreso").remove([data.path as string]);
  await sb.from("progress_photos").delete().eq("id", Number(id)).eq("user_id", v.id);
  revalidatePath("/app/progreso");
  return { ok: true };
}
