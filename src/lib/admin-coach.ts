// Uso de Coach Banana para el panel (solo conteos, nunca el contenido de las conversaciones). Solo servidor.
import "server-only";
import { createClient, type Viewer } from "@/lib/supabase/server";
import { parseQuota, type CoachQuota } from "@/lib/coach-quota";

/** Costo típico estimado por pregunta en USD (ver la cuenta en src/lib/coach-quota.ts). Solo para orientar. */
export const COACH_COST_PER_Q = 0.007;

export type CoachTotals = { dayTotal: number; monthTotal: number; usersToday: number; usersMonth: number; atLimitToday: number };

const MISSING = new Set(["PGRST202", "42883"]);
const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : Number(x) || 0);

/** Uso de una persona hoy y en el mes. null si falta 0032 o no hay permiso. */
export async function getCoachUsage(v: Viewer, userId: string): Promise<CoachQuota | null | "missing"> {
  if (v.demo) return parseQuota({ tier: "completo", day_used: 4, month_used: 37, ok: true });
  const { data, error } = await (await createClient()).rpc("admin_coach_usage", { p_user: userId });
  if (error) return MISSING.has(error.code ?? "") ? "missing" : null;
  return parseQuota(data);
}

/** Totales de hoy y del mes. null si falta 0032 o no hay permiso. */
export async function getCoachTotals(v: Viewer): Promise<CoachTotals | null> {
  if (v.demo) return { dayTotal: 63, monthTotal: 1184, usersToday: 21, usersMonth: 140, atLimitToday: 2 };
  const { data, error } = await (await createClient()).rpc("admin_coach_usage", { p_user: null });
  if (error || !data || typeof data !== "object") return null;
  const r = data as Record<string, unknown>;
  return { dayTotal: n(r.day_total), monthTotal: n(r.month_total), usersToday: n(r.users_today), usersMonth: n(r.users_month), atLimitToday: n(r.at_limit_today) };
}
