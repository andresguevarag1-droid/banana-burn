import { getViewer } from "@/lib/supabase/server";
import { dashboard, getAthlete } from "@/lib/athlete";
import { getHistory } from "@/lib/history";
import { getDaily } from "@/lib/daily";
import { ALTS, BARBELL, EX, HOME, SLOTS, e1rm, expressDay, forEquipment, planDay, prescribe, type ExerciseId, type PlannedDay, type Prescription, type SlotCfg } from "@/lib/engine";
import { TECH } from "@/lib/engine/technique";
import { MUSCLE, animFor, es as esLib, getLibEx, incFor, libraryAlternatives, similar, type LibEx } from "@/lib/library";
import { plannedFromSession } from "@/lib/programs";
import { exInfo } from "@/lib/programs-server";
import { cap, loadKindOf } from "@/components/workout/logic";
import { Player, type PlayerExercise } from "./player";
import { templatesDoneToday } from "./done-today";

export const metadata = { title: "Entreno" };

const isEngine = (id: string): id is ExerciseId => Object.hasOwn(EX, id);

export default async function Entreno({ searchParams }: { searchParams: Promise<{ dia?: string; modo?: string; expres?: string; repetir?: string; cambiar?: string; por?: string; sesion?: string }> }) {
  const { dia, modo, expres, repetir, cambiar, por, sesion } = await searchParams;
  const v = (await getViewer())!;
  const a = await getAthlete(v);
  const d = dashboard(a);
  const n = Number(dia);
  const prog = d.program;

  // Con un programa activo, el entreno sale del programa: la sesión de hoy, otra de esta semana (?sesion=2) o, en un
  // día de descanso, la próxima (adelantarla). El exprés y ?dia= (rutina normal) siguen disponibles.
  let plan: PlannedDay;
  if (expres) plan = expressDay(Number(expres), d.week + d.today.dow);
  else if (dia != null && n >= 0 && n <= 6) plan = planDay(n, d.week, d.engineSched, d.opts);
  else if (prog) {
    const k = Number(sesion);
    const pick = sesion ? prog.run.weekSessions.find((w) => w.day === k) : null;
    const next = prog.run.next;
    plan = pick ? plannedFromSession(prog, prog.icon, pick.session, prog.run.week, d.today.dow, d.equipment, exInfo)
      : prog.plan.key ? prog.plan
      : next ? plannedFromSession(prog, prog.icon, next.session, next.week, d.today.dow, d.equipment, exInfo)
      : prog.plan;
  } else plan = d.plan;

  // Ejercicios del día con su configuración, tempo y nota (los de un programa pueden ser de la biblioteca).
  const slots = (plan.program?.exercises ?? plan.exercises).map((e) => ({ id: e.id as string, cfg: e.cfg, muscle: e.muscle, slot: (e.cfg as SlotCfg).slot, tempo: e.tempo, note: e.note }));

  const optionIds = slots.map((e) => {
    if (!isEngine(e.id)) return [] as ExerciseId[];
    const pool = (e.slot ? SLOTS[e.slot] : ALTS[e.id] ?? []).map((x) => forEquipment(x, d.equipment, d.opts.level));
    const home = d.equipment === "gym" || d.equipment === "mixto" ? HOME[e.id] : undefined; // opción "en casa / sin máquina" también en el gym
    return [e.id, ...pool.filter((x) => x !== e.id), ...(home ? [home] : [])].filter((x, i, arr) => arr.indexOf(x) === i).slice(0, 5) as ExerciseId[];
  });
  // Ejercicios de la biblioteca: el del programa y alternativas del mismo patrón con el equipo de la persona.
  const libMain = slots.map((e) => (e.id.startsWith("ds:") ? getLibEx(e.id.slice(3)) : null));
  const libAlts = slots.map((e, i) => (libMain[i] ? similar(libMain[i]!, d.equipment, 3) : isEngine(e.id) ? libraryAlternatives(e.id, d.equipment) : []));
  // Todo lo que no depende entre sí se pide en paralelo.
  const [g, hist, doneTemplates] = await Promise.all([
    getDaily(v, a.startWeight, a.currentWeight),
    getHistory(v, [...new Set([...optionIds.flat(), ...libMain.filter(Boolean).map((x) => `ds:${x!.id}`), ...libAlts.flat().map((x) => `ds:${x.id}`)])]),
    slots.length ? templatesDoneToday(v) : Promise.resolve([] as string[]),
  ]);

  /** Tempo y nota del programa delante de la indicación del motor. */
  const withProgramNote = (rx: Prescription, s: (typeof slots)[number]): Prescription => {
    const pre = [s.tempo ? `Tempo ${s.tempo}.` : "", s.note ?? ""].filter(Boolean).join(" ");
    return pre ? { ...rx, note: `${pre} ${rx.note}` } : rx;
  };
  const mode = (rx: Prescription): Prescription => {
    if (modo === "suave" && rx.type !== "deload") return { ...rx, sets: Math.max(2, rx.sets - 1), reps: rx.reps.slice(0, Math.max(2, rx.sets - 1)), note: `Modo suave: una serie menos y 3 reps en reserva. ${rx.note}` };
    if (modo === "fuerte" && rx.type !== "cal") return { ...rx, note: `Día fuerte: busca 1 rep extra en la última serie. ${rx.note}` };
    return rx;
  };
  const build = (id: ExerciseId, cfg: SlotCfg, s: (typeof slots)[number]): PlayerExercise => {
    const h = hist[id] ?? [];
    const best = Math.max(0, ...h.flat().map((x) => (x.kg ? e1rm(x.kg, x.reps) : 0)));
    const rx = mode(withProgramNote(prescribe(id, cfg, h, { deload: d.deload }), s));
    return { id, name: EX[id].n, muscle: EX[id].m, cfg, tech: TECH[id] ?? null, bw: EX[id].inc === 0, barbell: BARBELL.has(id), load: loadKindOf(id, { inc: EX[id].inc }), rx, best, lastSets: h.at(-1) ?? null };
  };
  // Ejercicio de la biblioteca: hereda la animación del ejercicio del plan si es una variante, o la del patrón.
  const buildLib = (x: LibEx, s: (typeof slots)[number], fallbackAnim: string | null): PlayerExercise => {
    const id = `ds:${x.id}`, h = hist[id] ?? [], inc = incFor(x.eq);
    const best = Math.max(0, ...h.flat().map((r) => (r.kg ? e1rm(r.kg, r.reps) : 0)));
    return { id, name: x.n, muscle: s.muscle || cap(esLib(MUSCLE, x.t)), cfg: s.cfg, bw: inc === 0, barbell: x.eq === "barbell" || x.eq === "olympic barbell", load: loadKindOf(id, { inc, eq: x.eq }),
      rx: mode(withProgramNote(prescribe(id, s.cfg, h, { deload: d.deload, inc }), s)), best, lastSets: h.at(-1) ?? null,
      tech: { anim: fallbackAnim ?? animFor(x) ?? "", mus: cap([x.t, ...x.m2].map((m) => esLib(MUSCLE, m)).join(", ")), how: x.s, cues: [], err: [], mono: "" } };
  };
  const options = slots.map((s, i) => {
    const main = libMain[i];
    if (main) return [buildLib(main, s, null), ...libAlts[i].map((x) => buildLib(x, s, animFor(main)))];
    return [...optionIds[i].map((id) => build(id, s.cfg, s)), ...libAlts[i].map((x) => buildLib(x, s, TECH[s.id]?.anim ?? null))];
  });
  // "Cambiar por este" desde la biblioteca: ubica el ejercicio del plan y agrega la variante si no estaba entre las opciones.
  let preswap: { slot: number; option: number } | null = null;
  if (cambiar && por && cambiar.length <= 40 && por.length <= 40) {
    const slot = slots.findIndex((e, i) => e.id === cambiar || options[i].some((o) => o.id === cambiar));
    if (slot >= 0) {
      let option = options[slot].findIndex((o) => o.id === por);
      if (option < 0 && por.startsWith("ds:")) {
        const x = getLibEx(por.slice(3));
        if (x) { options[slot].push(buildLib(x, slots[slot], TECH[slots[slot].id]?.anim ?? null)); option = options[slot].length - 1; }
      }
      if (option > 0) preswap = { slot, option };
    }
  }
  const template = plan.key ?? plan.tpl ?? (expres ? `expres${expres}` : "descanso");
  const title = plan.name;
  const doneToday = options.length > 0 && doneTemplates.includes(template);
  return <Player template={template} title={title} icon={plan.icon} cardio={plan.cardio} options={options} dateKey={d.today.iso} mode={modo === "suave" || modo === "fuerte" ? modo : "normal"}
    doneToday={doneToday} repeat={repetir === "1"} preswap={preswap} gam={{ xp: g.xp, streak: g.streak.days, todayDone: g.streak.todayDone }} />;
}
