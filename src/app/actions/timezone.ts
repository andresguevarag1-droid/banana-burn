"use server";
import { createClient, getViewer } from "@/lib/supabase/server";
import { DEFAULT_TZ, validTz } from "@/lib/today";

/** Guarda la zona horaria del navegador en las preferencias de avisos si el usuario no eligió otra. */
export async function syncTimezone(tz: string) {
  const v = await getViewer();
  if (!v || v.demo || !validTz(tz)) return;
  const sb = await createClient();
  const { data } = await sb.from("notification_prefs").select("timezone").eq("user_id", v.id).maybeSingle();
  if (data && data.timezone && data.timezone !== DEFAULT_TZ) return;
  await sb.from("notification_prefs").upsert({ user_id: v.id, timezone: tz }, { onConflict: "user_id" });
}
