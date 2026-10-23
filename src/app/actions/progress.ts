"use server";
import { revalidatePath } from "next/cache";
import { createClient, getViewer } from "@/lib/supabase/server";
import { accessError } from "@/lib/entitlements";
import { todayFor } from "@/lib/today";

const PHOTO_PATH = /^[0-9a-f-]{36}\/[A-Za-z0-9_-][A-Za-z0-9._-]{0,119}$/;
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
  const denied = await accessError(v, "app");
  if (denied) return { ok: false, error: denied };
  const sb = await createClient();
  const day = todayFor(v).iso;
  const { data: had } = await sb.from("measurements").select("day").eq("user_id", v.id).eq("day", day).maybeSingle();
  const { error } = await sb.from("measurements").upsert({ user_id: v.id, day, ...row }, { onConflict: "user_id,day" });
  if (error) return { ok: false, error: "No pudimos guardar tus medidas. Intenta de nuevo." };
  if (!had) await sb.from("xp_events").insert({ user_id: v.id, kind: "measure", xp: 15 }); // XP una vez por día
  revalidatePath("/app/progreso");
  return { ok: true };
}

export async function addPhoto(path: string, pose: string) {
  const v = await getViewer();
  if (!v || v.demo) return { ok: false };
  // Ruta dentro de la carpeta del usuario, sin subcarpetas ni "..": igual que el CHECK de 0012.
  if (typeof path !== "string" || !PHOTO_PATH.test(path) || path.includes("..") || !path.startsWith(`${v.id}/`) || !["frente", "lado", "espalda"].includes(pose)) return { ok: false };
  if (await accessError(v, "app")) return { ok: false };
  const sb = await createClient();
  const day = todayFor(v).iso;
  const { count: before } = await sb.from("progress_photos").select("*", { count: "exact", head: true }).eq("user_id", v.id).eq("day", day);
  const { error } = await sb.from("progress_photos").insert({ user_id: v.id, day, pose, path });
  if (!error && !before) await sb.from("xp_events").insert({ user_id: v.id, kind: "photo", xp: 20 }); // XP con la primera foto del día
  revalidatePath("/app/progreso");
  return { ok: !error };
}

export async function deletePhoto(id: string) {
  const v = await getViewer();
  if (!v || v.demo) return { ok: false };
  const sb = await createClient();
  if (!/^[0-9]{1,18}$/.test(String(id))) return { ok: false };
  const { data } = await sb.from("progress_photos").select("path").eq("id", Number(id)).eq("user_id", v.id).maybeSingle();
  if (!data) return { ok: false };
  // Primero el registro (lo que se ve); el archivo después. Si el archivo falla, queda privado y sin enlace.
  const { error } = await sb.from("progress_photos").delete().eq("id", Number(id)).eq("user_id", v.id);
  if (error) return { ok: false };
  await sb.storage.from("progreso").remove([data.path as string]).catch(() => null);
  revalidatePath("/app/progreso");
  return { ok: true };
}
