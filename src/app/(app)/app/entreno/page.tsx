import { getViewer } from "@/lib/supabase/server";
import { dashboard, getAthlete } from "@/lib/athlete";
import { getHistory } from "@/lib/history";
import { getDaily } from "@/lib/daily";
import { ALTS, BARBELL, EX, HOME, SLOTS, e1rm, expressDay, forEquipment, planDay, prescribe, type ExerciseId, type SlotCfg } from "@/lib/engine";
import { TECH } from "@/lib/engine/technique";
import { MUSCLE, es as esLib, getLibEx, incFor, libraryAlternatives } from "@/lib/library";
import { cap, loadKindOf } from "@/components/workout/logic";
import { Player, type PlayerExercise } from "./player";
import { templatesDoneToday } from "./done-today";

export const metadata = { title: "Entreno" };

export default async function Entreno({ searchParams }: { searchParams: Promise<{ dia?: string; modo?: string; expres?: string; repetir?: string; cambiar?: string; por?: string }> }) {
  const { dia, modo, expres, repetir, cambiar, por } = await searchParams;
  const v = (await getViewer())!;
  const a = await getAthlete(v);
  const d = dashboard(a);
  const n = Number(dia);
  const plan = expres ? expressDay(Number(expres), d.week + d.today.dow) : dia != null && n >= 0 && n <= 6 ? planDay(n, d.week, d.sched, d.opts) : d.plan;

  const optionIds = plan.exercises.map((e) => {
    const pool = (e.cfg.slot ? SLOTS[e.cfg.slot] : ALTS[e.id] ?? []).map((x) => forEquipment(x, d.equipment, d.opts.level));
    const home = d.equipment === "gym" || d.equipment === "mixto" ? HOME[e.id] : undefined; // opción "en casa / sin máquina" también en el gym
    return [e.id, ...pool.filter((x) => x !== e.id), ...(home ? [home] : [])].filter((x, i, a) => a.indexOf(x) === i).slice(0, 5) as ExerciseId[];
  });
  const libAlts = plan.exercises.map((e) => libraryAlternatives(e.id, d.equipment));
  const template = plan.tpl ?? (expres ? `expres${expres}` : "descanso");
  // Todo lo que no depende entre sí se pide en paralelo (antes eran cuatro viajes seguidos a la base).
  const [g, hist, libHist, doneTemplates] = await Promise.all([
    getDaily(v, a.startWeight, a.currentWeight),
    getHistory(v, [...new Set(optionIds.flat())]),
    getHistory(v, libAlts.flat().map((x) => `ds:${x.id}`)),
    plan.exercises.length ? templatesDoneToday(v) : Promise.resolve([] as string[]),
  ]);
  const build = (id: ExerciseId, cfg: SlotCfg): PlayerExercise => {
    const h = hist[id] ?? [];
    const best = Math.max(0, ...h.flat().map((s) => (s.kg ? e1rm(s.kg, s.reps) : 0)));
    let rx = prescribe(id, cfg, h, { deload: d.deload });
    if (modo === "suave" && rx.type !== "deload") rx = { ...rx, sets: Math.max(2, rx.sets - 1), reps: rx.reps.slice(0, Math.max(2, rx.sets - 1)), note: `Modo suave: una serie menos y 3 reps en reserva. ${rx.note}` };
    if (modo === "fuerte" && rx.type !== "cal") rx = { ...rx, note: `Día fuerte: busca 1 rep extra en la última serie. ${rx.note}` };
    return { id, name: EX[id].n, muscle: EX[id].m, cfg, tech: TECH[id] ?? null, bw: EX[id].inc === 0, barbell: BARBELL.has(id), load: loadKindOf(id, { inc: EX[id].inc }), rx, best, lastSets: h.at(-1) ?? null };
  };
  // Variante de la biblioteca: mismo patrón y músculo que el ejercicio del plan, así que hereda su animación y su nombre de músculo.
  const buildLib = (x: NonNullable<ReturnType<typeof getLibEx>>, slot: { id: ExerciseId; muscle: string; cfg: SlotCfg }): PlayerExercise => {
    const id = `ds:${x.id}`, h = libHist[id] ?? [], inc = incFor(x.eq);
    const best = Math.max(0, ...h.flat().map((s) => (s.kg ? e1rm(s.kg, s.reps) : 0)));
    return { id, name: x.n, muscle: slot.muscle, cfg: slot.cfg, bw: inc === 0, barbell: x.eq === "barbell" || x.eq === "olympic barbell", load: loadKindOf(id, { inc, eq: x.eq }),
      rx: prescribe(id, slot.cfg, h, { deload: d.deload, inc }), best, lastSets: h.at(-1) ?? null,
      tech: { anim: TECH[slot.id]?.anim ?? "", mus: cap([x.t, ...x.m2].map((m) => esLib(MUSCLE, m)).join(", ")), how: x.s, cues: [], err: [], mono: "" } };
  };
  const options = plan.exercises.map((e, i) => [...optionIds[i].map((id) => build(id, e.cfg)), ...libAlts[i].map((x) => buildLib(x, e))]);
  // "Cambiar por este" desde la biblioteca: ubica el ejercicio del plan y agrega la variante si no estaba entre las opciones.
  let preswap: { slot: number; option: number } | null = null;
  if (cambiar && por && cambiar.length <= 40 && por.length <= 40) {
    const slot = plan.exercises.findIndex((e, i) => e.id === cambiar || optionIds[i].includes(cambiar as ExerciseId));
    if (slot >= 0) {
      let option = options[slot].findIndex((o) => o.id === por);
      if (option < 0 && por.startsWith("ds:")) {
        const x = getLibEx(por.slice(3));
        if (x) { options[slot].push(buildLib(x, plan.exercises[slot])); option = options[slot].length - 1; }
      }
      if (option > 0) preswap = { slot, option };
    }
  }
  const doneToday = options.length > 0 && doneTemplates.includes(template);
  return <Player template={template} title={plan.name} icon={plan.icon} cardio={plan.cardio} options={options} dateKey={d.today.iso} mode={modo === "suave" || modo === "fuerte" ? modo : "normal"}
    doneToday={doneToday} repeat={repetir === "1"} preswap={preswap} gam={{ xp: g.xp, streak: g.streak.days, todayDone: g.streak.todayDone }} />;
}
