// XP total del usuario. SOLO SERVIDOR.
import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, type Viewer } from "@/lib/supabase/server";
import { todayFor } from "@/lib/today";
import { demoXp } from "@/lib/demo-story";

/** Igual al tope de filas por respuesta de Supabase (max-rows). */
const PAGE = 1000;

/**
 * Suma de xp_events por páginas (id ascendente). Una sola consulta devolvería como mucho 1000 filas,
 * y alguien que entrena y registra comidas a diario pasa de eso en pocos meses: su XP y su nivel se congelarían.
 */
export async function sumXp(sb: Pick<SupabaseClient, "from">, userId: string): Promise<number> {
  let total = 0;
  let last = 0;
  for (let i = 0; i < 200; i++) {
    const { data, error } = await sb.from("xp_events").select("id,xp").eq("user_id", userId).gt("id", last).order("id").limit(PAGE);
    if (error) throw Object.assign(new Error("No se pudo leer el XP"), { code: error.code });
    const rows = (data ?? []) as { id: number; xp: number | null }[];
    for (const r of rows) total += Number(r.xp ?? 0);
    if (rows.length < PAGE) break;
    last = rows[rows.length - 1].id;
  }
  return total;
}

/** XP total (una lectura por request; la comparten el layout, Hoy y la tienda). */
export const getXpTotal = cache(async (v: Viewer): Promise<number> => {
  if (v.demo) return demoXp(todayFor(v).iso);
  return sumXp(await createClient(), v.id);
});
