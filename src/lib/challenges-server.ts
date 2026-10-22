import { createClient, type Viewer } from "@/lib/supabase/server";
import { crToday } from "@/lib/today";
import { CHALLENGE_BY_ID, challengeState, type Challenge } from "@/lib/challenges";

export type Metrics = { workout: boolean; steps: number; water: number; protein: number; proteinGoal: number };
export type MyChallenge = { ucId: string; c: Challenge; startedOn: string; state: ReturnType<typeof challengeState>; autoOk: boolean };

const addDays = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

export function metAuto(c: Challenge, m: Metrics) {
  switch (c.verify) {
    case "workout": return m.workout;
    case "steps": return m.steps >= 10000;
    case "water": return m.water >= 8;
    case "protein": return m.proteinGoal > 0 && m.protein >= m.proteinGoal * 0.95;
    default: return false;
  }
}

export async function getMyChallenges(v: Viewer, m: Metrics): Promise<{ active: MyChallenge[]; done: { c: Challenge; at: string }[] }> {
  const today = crToday().iso;
  if (v.demo) {
    const mk = (id: string, start: number, done: number[]) => {
      const c = CHALLENGE_BY_ID[id]; const startedOn = addDays(today, -start);
      return { ucId: `demo-${id}`, c, startedOn, state: challengeState(c, startedOn, done.map((i) => addDays(startedOn, i)), today), autoOk: metAuto(c, m) };
    };
    return { active: [mk("banana-30", 10, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), mk("flexiones-30", 2, [0, 1])], done: [{ c: CHALLENGE_BY_ID["agua-21"], at: addDays(today, -14) }] };
  }
  const sb = await createClient();
  const { data: rows } = await sb.from("user_challenges").select("id,challenge_id,started_on,status,completed_at").eq("user_id", v.id).in("status", ["activo", "completado"]).order("created_at");
  const active: MyChallenge[] = [], done: { c: Challenge; at: string }[] = [];
  for (const r of rows ?? []) {
    const c = CHALLENGE_BY_ID[r.challenge_id as string];
    if (!c) continue;
    if (r.status === "completado") { done.push({ c, at: String(r.completed_at ?? r.started_on).slice(0, 10) }); continue; }
    const { data: ck } = await sb.from("challenge_checkins").select("day").eq("user_challenge_id", r.id);
    let days = (ck ?? []).map((x) => x.day as string);
    const autoOk = metAuto(c, m);
    if (autoOk && !days.includes(today)) {
      const ins = await sb.from("challenge_checkins").upsert({ user_challenge_id: r.id, user_id: v.id, day: today }, { onConflict: "user_challenge_id,day", ignoreDuplicates: true });
      if (!ins.error) days = [...days, today];
    }
    const state = challengeState(c, r.started_on as string, days, today);
    if (state.finished) {
      await sb.from("user_challenges").update({ status: "completado", completed_at: new Date().toISOString() }).eq("id", r.id);
      await sb.from("xp_events").insert({ user_id: v.id, kind: "challenge", xp: c.xp });
    }
    active.push({ ucId: String(r.id), c, startedOn: r.started_on as string, state, autoOk });
  }
  return { active, done };
}
