// Carreras con GPS (0047): lectura desde el servidor. Privadas: siempre con el cliente de la persona (RLS).
import "server-only";
import { cache } from "react";
import { createClient, type Viewer } from "@/lib/supabase/server";
import { todayFor } from "@/lib/today";
import { addDaysIso } from "@/lib/seasons";
import type { Split, Track } from "@/lib/runs";

export type RunRow = { id: string; day: string; startedAt: string; distanceM: number; movingS: number; paceSKm: number | null; splits: Split[] };
export type RunFull = RunRow & { track: Track };

const map = (r: Record<string, unknown>): RunRow => ({ id: String(r.id), day: String(r.day), startedAt: String(r.started_at), distanceM: Number(r.distance_m), movingS: Number(r.moving_s), paceSKm: r.pace_s_km == null ? null : Number(r.pace_s_km), splits: Array.isArray(r.splits) ? (r.splits as Split[]) : [] });

/** Carreras de ejemplo para el modo demo (sin ubicación real). */
function demoRuns(today: string): RunRow[] {
  return [[1, 5.2, 1610], [3, 8.1, 2650], [6, 4.0, 1260], [9, 12.4, 4210], [13, 6.0, 1850], [17, 5.5, 1720]].map(([d, km, s], i) => ({
    id: `demo-${i}`, day: addDaysIso(today, -d), startedAt: `${addDaysIso(today, -d)}T11:30:00Z`, distanceM: Math.round(km * 1000), movingS: s, paceSKm: Math.round(s / km),
    splits: Array.from({ length: Math.floor(km) }, (_, k) => ({ km: k + 1, seconds: Math.round(s / km) + (k % 3) * 4 - 4 })),
  }));
}

export const listRuns = cache(async (v: Viewer, days = 120): Promise<RunRow[]> => {
  const today = todayFor(v).iso;
  if (v.demo) return demoRuns(today);
  const { data, error } = await (await createClient()).from("runs").select("id,day,started_at,distance_m,moving_s,pace_s_km,splits").eq("user_id", v.id).gte("day", addDaysIso(today, -days)).order("started_at", { ascending: false }).limit(200);
  return error ? [] : ((data ?? []) as Record<string, unknown>[]).map(map);
});

export async function getRun(v: Viewer, id: string): Promise<RunFull | null> {
  if (v.demo) {
    const r = demoRuns(todayFor(v).iso).find((x) => x.id === id);
    if (!r) return null;
    // Recorrido inventado (un circuito), solo para ver la pantalla.
    const pts = Array.from({ length: 120 }, (_, k) => { const a = (k / 120) * Math.PI * 2; return { t: k * 15000, lat: 9.935 + 0.006 * Math.sin(a), lng: -84.09 + 0.008 * Math.cos(a), acc: 6 }; });
    return { ...r, track: [pts] };
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await (await createClient()).from("runs").select("id,day,started_at,distance_m,moving_s,pace_s_km,splits,track").eq("id", id).eq("user_id", v.id).maybeSingle();
  return data ? { ...map(data), track: Array.isArray(data.track) ? (data.track as Track) : [] } : null;
}
