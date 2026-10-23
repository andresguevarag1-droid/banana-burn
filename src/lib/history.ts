import { createClient, type Viewer } from "@/lib/supabase/server";
import type { SetLog } from "@/lib/engine";

/** Historial por ejercicio: sesiones (antigua→reciente) con sus series. */
export type History = Record<string, SetLog[][]>;

const DEMO: History = {
  squat: [[{ kg: 90, reps: 6 }, { kg: 90, reps: 6 }, { kg: 90, reps: 5 }, { kg: 90, reps: 5 }]],
  bench: [[{ kg: 80, reps: 10 }, { kg: 80, reps: 10 }, { kg: 80, reps: 10 }, { kg: 80, reps: 10 }]],
  ohp: [[{ kg: 45, reps: 7 }, { kg: 45, reps: 7 }, { kg: 45, reps: 6 }]],
  deadlift: [[{ kg: 120, reps: 5 }, { kg: 120, reps: 5 }, { kg: 120, reps: 4 }]],
  row: [[{ kg: 60, reps: 8 }, { kg: 60, reps: 8 }, { kg: 60, reps: 7 }]],
  rdl: [[{ kg: 70, reps: 10 }, { kg: 70, reps: 10 }, { kg: 70, reps: 10 }]],
  dbrow: [[{ kg: 24, reps: 10 }, { kg: 24, reps: 9 }, { kg: 24, reps: 9 }]],
};

export async function getHistory(v: Viewer, ids: string[]): Promise<History> {
  if (v.demo) return Object.fromEntries(ids.filter((i) => DEMO[i]).map((i) => [i, DEMO[i]]));
  if (!ids.length) return {};
  const sb = await createClient();
  const { data } = await sb
    .from("workout_sets")
    .select("exercise,set_no,kg,reps,rir,workout_id,workouts!inner(day,created_at)")
    .eq("user_id", v.id)
    .in("exercise", ids)
    .order("id", { ascending: false })
    .limit(400);
  const out: History = {};
  const byEx: Record<string, Map<string, SetLog[]>> = {};
  for (const r of data ?? []) {
    const m = (byEx[r.exercise] ??= new Map());
    if (!m.has(r.workout_id) && m.size >= 3) continue;
    const arr = m.get(r.workout_id) ?? [];
    arr[r.set_no - 1] = { kg: r.kg == null ? null : Number(r.kg), reps: r.reps ?? 0, rir: r.rir };
    m.set(r.workout_id, arr);
  }
  for (const [ex, m] of Object.entries(byEx)) out[ex] = [...m.values()].map((s) => s.filter(Boolean)).reverse();
  return out;
}
