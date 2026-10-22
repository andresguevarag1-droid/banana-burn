import { getViewer } from "@/lib/supabase/server";
import { dashboard, getAthlete } from "@/lib/athlete";
import { getHistory } from "@/lib/history";
import { getDaily } from "@/lib/daily";
import { ALTS, BARBELL, EX, HOME, SLOTS, e1rm, expressDay, forEquipment, planDay, prescribe, type ExerciseId, type SlotCfg } from "@/lib/engine";
import { TECH } from "@/lib/engine/technique";
import { MUSCLE, es as esLib, getLibEx, incFor, libraryAlternatives } from "@/lib/library";
import { Player, type PlayerExercise } from "./player";

export const metadata = { title: "Entreno" };

export default async function Entreno({ searchParams }: { searchParams: Promise<{ dia?: string; modo?: string; expres?: string }> }) {
  const { dia, modo, expres } = await searchParams;
  const v = (await getViewer())!;
  const a = await getAthlete(v);
  const d = dashboard(a);
  const g = await getDaily(v, a.startWeight, a.currentWeight);
  const n = Number(dia);
  const plan = expres ? expressDay(Number(expres), d.week + d.today.dow) : dia != null && n >= 0 && n <= 6 ? planDay(n, d.week, d.sched, d.opts) : d.plan;

  const optionIds = plan.exercises.map((e) => {
    const pool = (e.cfg.slot ? SLOTS[e.cfg.slot] : ALTS[e.id] ?? []).map((x) => forEquipment(x, d.equipment, d.opts.level));
    const home = d.equipment === "gym" || d.equipment === "mixto" ? HOME[e.id] : undefined; // opción "en casa / sin máquina" también en el gym
    return [e.id, ...pool.filter((x) => x !== e.id), ...(home ? [home] : [])].filter((x, i, a) => a.indexOf(x) === i).slice(0, 5) as ExerciseId[];
  });
  const hist = await getHistory(v, [...new Set(optionIds.flat())]);
  const build = (id: ExerciseId, cfg: SlotCfg): PlayerExercise => {
    const h = hist[id] ?? [];
    const best = Math.max(0, ...h.flat().map((s) => (s.kg ? e1rm(s.kg, s.reps) : 0)));
    let rx = prescribe(id, cfg, h, { deload: d.deload });
    if (modo === "suave" && rx.type !== "deload") rx = { ...rx, sets: Math.max(2, rx.sets - 1), reps: rx.reps.slice(0, Math.max(2, rx.sets - 1)), note: `😴 Modo suave: una serie menos y 3 reps en reserva. ${rx.note}` };
    if (modo === "fuerte" && rx.type !== "cal") rx = { ...rx, note: `🔥 Día fuerte: busca 1 rep extra en la última serie. ${rx.note}` };
    return { id, name: EX[id].n, muscle: EX[id].m, cfg, tech: TECH[id] ?? null, bw: EX[id].inc === 0, barbell: BARBELL.has(id), rx, best, lastSets: h.at(-1) ?? null };
  };
  const libAlts = plan.exercises.map((e) => libraryAlternatives(e.id, d.equipment));
  const libHist = await getHistory(v, libAlts.flat().map((x) => `ds:${x.id}`));
  const buildLib = (x: NonNullable<ReturnType<typeof getLibEx>>, cfg: SlotCfg): PlayerExercise => {
    const id = `ds:${x.id}`, h = libHist[id] ?? [], inc = incFor(x.eq);
    const best = Math.max(0, ...h.flat().map((s) => (s.kg ? e1rm(s.kg, s.reps) : 0)));
    return { id, name: x.n, muscle: esLib(MUSCLE, x.t), cfg, bw: inc === 0, barbell: x.eq === "barbell", rx: prescribe(id, cfg, h, { deload: d.deload, inc }), best, lastSets: h.at(-1) ?? null,
      tech: { anim: "", mus: [x.t, ...x.m2].map((m) => esLib(MUSCLE, m)).join(" · "), how: x.s, cues: [], err: [], mono: "" } };
  };
  const options = plan.exercises.map((e, i) => [...optionIds[i].map((id) => build(id, e.cfg)), ...libAlts[i].map((x) => buildLib(x, e.cfg))]);
  return <Player template={plan.tpl ?? (expres ? `expres${expres}` : "descanso")} title={plan.name} emoji={plan.emoji} cardio={plan.cardio} options={options} dateKey={`${d.today.iso}${modo === "suave" ? "-suave" : ""}`} gam={{ xp: g.xp, streak: g.streak.days, todayDone: g.streak.todayDone }} />;
}
