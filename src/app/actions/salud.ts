"use server";
// Salud en la app nativa (HealthKit en iPhone, Health Connect en Android): el teléfono manda pasos, energía activa y
// pesajes recientes (src/lib/native/salud.ts) y aquí se guardan con las reglas de salud-sync.ts. Lo que la persona anota
// a mano manda sobre lo automático; un día pasado nunca se crea.
import { revalidatePath } from "next/cache";
import { creditChallenges } from "@/lib/challenges-server";
import { createClient, getViewer } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements";
import { APP_LOCKED_MSG } from "@/lib/plan-access";
import { todayFor } from "@/lib/today";
import { limitError } from "@/lib/security/limits";
import { STEP_DAYS, WEIGHT_DAYS, addDays, cleanHealth, planDailyRows, planWeights, type ExistingDay } from "@/lib/salud-sync";

export type HealthSyncResult =
  | { ok: true; days: number; weights: number; demo?: boolean }
  | { ok: false; reason: "sesion" | "otra-cuenta" | "plan" | "limite" | "error"; error?: string };

/**
 * `owner`: la cuenta que conectó Salud en este teléfono (Conexiones). Si ahora hay otra sesión, no se guarda nada: esa
 * persona no dio su permiso y el teléfono deja de sincronizar.
 */
export async function syncHealth(input: unknown, owner: unknown): Promise<HealthSyncResult> {
  const v = await getViewer();
  if (!v) return { ok: false, reason: "sesion" };
  if (v.demo) return { ok: true, demo: true, days: 0, weights: 0 };
  if (owner !== v.id) return { ok: false, reason: "otra-cuenta" };
  const lim = await limitError("salud:sincronizar", v.id);
  if (lim) return { ok: false, reason: "limite", error: lim };
  const ent = await getEntitlements(v);
  if (!ent.app) return { ok: false, reason: "plan", error: APP_LOCKED_MSG };
  const today = todayFor(v).iso;
  const p = cleanHealth(input, today);
  if (!p.days.length && !p.weights.length) return { ok: true, days: 0, weights: 0 };
  const sb = await createClient();
  let days = 0, weights = 0;

  if (p.days.length) {
    // Sin la columna active_kcal (0058 sin aplicar) se guardan solo los pasos.
    const since = addDays(today, -(STEP_DAYS - 1));
    const read = (cols: string) => sb.from("daily_logs").select(cols).eq("user_id", v.id).gte("day", since);
    let withKcal = true;
    let q = await read("day,steps,active_kcal");
    if (q.error) {
      withKcal = false;
      q = await read("day,steps");
    }
    if (q.error) return { ok: false, reason: "error", error: "No pudimos leer tu registro. Intenta de nuevo." };
    const { rows, createsToday } = planDailyRows(p, (q.data ?? []) as unknown as ExistingDay[], today, withKcal);
    if (rows.length) {
      const { error } = await sb.from("daily_logs").upsert(rows.map((r) => ({ user_id: v.id, ...r })), { onConflict: "user_id,day" });
      if (error) return { ok: false, reason: "error", error: "No pudimos guardar tus pasos. Intenta de nuevo." };
      days = rows.length;
      // Igual que anotarlo a mano (actions/daily.ts): el primer registro del día da su XP (la base lo cuenta una vez).
      if (createsToday) await sb.from("xp_events").insert({ user_id: v.id, kind: "checkin", xp: 15 });
    }
  }

  if (p.weights.length) {
    const { data: had } = await sb.from("weights").select("day").eq("user_id", v.id).gte("day", addDays(today, -(WEIGHT_DAYS - 1)));
    const missing = planWeights(p, (had ?? []).map((r) => r.day as string));
    if (missing.length) {
      // ignoreDuplicates: si la persona anota su peso mientras tanto, lo suyo se queda.
      const { error } = await sb.from("weights").upsert(missing.map((w) => ({ user_id: v.id, day: w.day, kg: w.kg })), { onConflict: "user_id,day", ignoreDuplicates: true });
      if (!error) {
        weights = missing.length;
        // El XP de pesaje es solo de hoy (la base rechaza otros días).
        if (missing.some((w) => w.day === today)) await sb.from("xp_events").insert({ user_id: v.id, kind: "weigh", xp: 10 });
      }
    }
  }

  if (days || weights) {
    await creditChallenges(v).catch(() => null);
    revalidatePath("/app", "layout");
  }
  return { ok: true, days, weights };
}
