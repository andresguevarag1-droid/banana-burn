import { getViewer } from "@/lib/supabase/server";
import { dashboard, getAthlete } from "@/lib/athlete";
import { getHistory } from "@/lib/history";
import { EX, e1rm, planDay, prescribe } from "@/lib/engine";
import { TECH } from "@/lib/engine/technique";
import { Player, type PlayerExercise } from "./player";

export const metadata = { title: "Entreno" };

export default async function Entreno({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const { dia } = await searchParams;
  const v = (await getViewer())!;
  const d = dashboard(await getAthlete(v));
  const n = Number(dia);
  const plan = dia != null && n >= 0 && n <= 6 ? planDay(n, d.week) : d.plan;
  const hist = await getHistory(v, plan.exercises.map((e) => e.id));
  const exercises: PlayerExercise[] = plan.exercises.map((e) => {
    const h = hist[e.id] ?? [];
    const best = Math.max(0, ...h.flat().map((s) => (s.kg ? e1rm(s.kg, s.reps) : 0)));
    const last = h.at(-1);
    return { tech: TECH[e.id] ?? null, bw: EX[e.id].inc === 0, id: e.id, name: e.name, muscle: e.muscle, cfg: e.cfg, rx: prescribe(e.id, e.cfg, h, { deload: d.deload }), best, last: last ? last.map((s) => `${s.kg ?? "—"}×${s.reps}`).join(" · ") : null };
  });
  return <Player template={plan.tpl ?? "descanso"} title={`${plan.emoji} ${plan.name}`} cardio={plan.cardio} exercises={exercises} dateKey={d.today.iso} />;
}
