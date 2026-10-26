// Estado de los primeros pasos y del curso (0047) más las señales reales que marcan pasos solos. Solo servidor.
import "server-only";
import { cache } from "react";
import { createClient, type Viewer } from "@/lib/supabase/server";
import { isLearnKey } from "@/lib/primeros-pasos";

export type LearnState = {
  keys: string[];
  workouts: number;
  weights: number;
  coachMessages: number;
  push: boolean;
  /** ¿Se guarda en el servidor? En demo o sin 0046, el cliente recuerda en este dispositivo. */
  persisted: boolean;
};

const EMPTY: LearnState = { keys: [], workouts: 0, weights: 0, coachMessages: 0, push: false, persisted: false };

/** Una lectura por request. Conteos baratos (head + count) limitados a lo propio por RLS y por user_id. */
export const getLearnState = cache(async (v: Viewer): Promise<LearnState> => {
  if (v.demo) return EMPTY;
  const sb = await createClient();
  const count = (t: string, extra?: (q: ReturnType<typeof sb.from>) => unknown) => {
    let q = sb.from(t).select("id", { count: "exact", head: true }).eq("user_id", v.id);
    if (extra) q = extra(q as never) as typeof q;
    return q.limit(1);
  };
  const [p, w, kg, c, push, phone] = await Promise.all([
    sb.from("profiles").select("learn_keys").eq("id", v.id).maybeSingle(),
    count("workouts"),
    count("weights"),
    sb.from("coach_messages").select("id", { count: "exact", head: true }).eq("user_id", v.id).eq("role", "user").limit(1),
    sb.from("push_subscriptions").select("endpoint", { count: "exact", head: true }).eq("user_id", v.id).limit(1),
    // Avisos en la app nativa (0057). Sin la tabla, cuenta como cero.
    sb.from("native_push_tokens").select("id", { count: "exact", head: true }).eq("user_id", v.id).limit(1),
  ]);
  const keys = !p.error && Array.isArray(p.data?.learn_keys) ? (p.data!.learn_keys as unknown[]).filter(isLearnKey) : [];
  return { keys, workouts: w.count ?? 0, weights: kg.count ?? 0, coachMessages: c.count ?? 0, push: (push.count ?? 0) + (phone.error ? 0 : phone.count ?? 0) > 0, persisted: !p.error };
});
