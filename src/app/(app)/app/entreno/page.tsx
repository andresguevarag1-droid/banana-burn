import { getViewer } from "@/lib/supabase/server";
import { dashboard, getAthlete } from "@/lib/athlete";
import { getHistory } from "@/lib/history";
import { getDaily } from "@/lib/daily";
import { ALTS, BARBELL, EX, SLOTS, e1rm, planDay, prescribe, type ExerciseId, type SlotCfg } from "@/lib/engine";
import { TECH } from "@/lib/engine/technique";
import { Player, type PlayerExercise } from "./player";

export const metadata = { title: "Entreno" };

export default async function Entreno({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const { dia } = await searchParams;
  const v = (await getViewer())!;
  const a = await getAthlete(v);
  const d = dashboard(a);
  const g = await getDaily(v, a.startWeight, a.currentWeight);
  const n = Number(dia);
  const plan = dia != null && n >= 0 && n <= 6 ? planDay(n, d.week, d.sched) : d.plan;

  const optionIds = plan.exercises.map((e) => {
    const pool = e.cfg.slot ? SLOTS[e.cfg.slot] : ALTS[e.id] ?? [];
    return [e.id, ...pool.filter((x) => x !== e.id)].filter((x, i, a) => a.indexOf(x) === i).slice(0, 4) as ExerciseId[];
  });
  const hist = await getHistory(v, [...new Set(optionIds.flat())]);
  const build = (id: ExerciseId, cfg: SlotCfg): PlayerExercise => {
    const h = hist[id] ?? [];
    const best = Math.max(0, ...h.flat().map((s) => (s.kg ? e1rm(s.kg, s.reps) : 0)));
    return { id, name: EX[id].n, muscle: EX[id].m, cfg, tech: TECH[id] ?? null, bw: EX[id].inc === 0, barbell: BARBELL.has(id), rx: prescribe(id, cfg, h, { deload: d.deload }), best, lastSets: h.at(-1) ?? null };
  };
  const options = plan.exercises.map((e, i) => optionIds[i].map((id) => build(id, e.cfg)));
  return <Player template={plan.tpl ?? "descanso"} title={plan.name} emoji={plan.emoji} cardio={plan.cardio} options={options} dateKey={d.today.iso} gam={{ xp: g.xp, streak: g.streak.days, todayDone: g.streak.todayDone }} />;
}
