import { getEntitlements } from "@/lib/entitlements";
import { betaLive } from "@/lib/plans";
import { canUpsellNutrition } from "@/lib/plan-access";
import { getViewer } from "@/lib/supabase/server";
import { dashboard, firstSessionPlan, getAthlete, nextSessionPlan } from "@/lib/athlete";
import { getHistory } from "@/lib/history";
import { getDaily, prefetchDaily } from "@/lib/daily";
import { ALTS, BARBELL, EX, HOME, PER_SIDE, SLOTS, e1rm, expressDay, forEquipment, isTrainingDay, nextTrainingDow, planDay, prescribe, DAY_NAMES, type ExerciseId, type PlannedDay, type Prescription, type SlotCfg } from "@/lib/engine";
import { TECH } from "@/lib/engine/technique";
import { MUSCLE, animFor, es as esLib, getLibEx, incFor, libraryAlternatives, similar, type LibEx } from "@/lib/library";
import { plannedFromSession } from "@/lib/programs";
import { coachArt, coachOf } from "@/lib/coaches";
import { exInfo } from "@/lib/programs-server";
import { cap, loadKindOf } from "@/components/workout/logic";
import { Player, type PlayerExercise } from "./player";
import { hasSavedWorkout, templatesDoneToday } from "./done-today";
import { getVoice } from "@/lib/voice-server";
import { modeNote, programTempoNote, rxNote } from "@/lib/voice";

export const metadata = { title: "Entreno" };

const isEngine = (id: string): id is ExerciseId => Object.hasOwn(EX, id);

export default async function Entreno({ searchParams }: { searchParams: Promise<{ dia?: string; modo?: string; expres?: string; repetir?: string; cambiar?: string; por?: string; sesion?: string; primera?: string }> }) {
  const { dia, modo, expres, repetir, cambiar, por, sesion, primera } = await searchParams;
  const v = (await getViewer())!;
  prefetchDaily(v); // el registro del día se lee en paralelo con el atleta (getDaily lo reutiliza)
  // Primer entreno corto: se decide aquí con los entrenos guardados (no con un dato del cliente). El exprés y ?dia= no cambian.
  const [a, voice, saved] = await Promise.all([getAthlete(v), getVoice(v), expres || dia != null ? Promise.resolve(true) : v.demo && primera === "1" ? Promise.resolve(false) : hasSavedWorkout(v)]);
  const ent = await getEntitlements(v);
  const nutritionUpsell = canUpsellNutrition(ent, betaLive()) ? { account: v.id, goal: a.glp1.on || a.goalWeight < a.currentWeight ? "protein" as const : "strength" as const } : undefined;
  const d = dashboard(a);
  const n = Number(dia);
  const prog = d.program;

  // Con un programa activo, el entreno sale del programa: la sesión de hoy, otra de esta semana (?sesion=2) o, en un
  // día de descanso, la próxima (adelantarla). El exprés y ?dia= (rutina normal) siguen disponibles.
  let plan: PlannedDay;
  const firstPlan = firstSessionPlan(d, saved ? 1 : 0);
  if (expres) plan = expressDay(Number(expres), d.week + d.today.dow);
  else if (dia != null && n >= 0 && n <= 6) plan = planDay(n, d.week, d.engineSched, d.opts);
  else if (firstPlan) plan = firstPlan;
  else if (prog) {
    const k = Number(sesion);
    const pick = sesion ? prog.run.weekSessions.find((w) => w.day === k) : null;
    const next = prog.run.next;
    plan = pick ? plannedFromSession(prog, prog.icon, pick.session, prog.run.week, d.today.dow, d.equipment, exInfo)
      : prog.plan.key ? prog.plan
      : next ? plannedFromSession(prog, prog.icon, next.session, next.week, d.today.dow, d.equipment, exInfo)
      : prog.plan;
  } else if (!isTrainingDay(d.plan)) {
    // Día de descanso sin programa: quien toca Empezar (el primer entreno, un recordatorio) adelanta la próxima sesión
    // en vez de llegar a una pantalla vacía.
    plan = nextSessionPlan(d) ?? d.plan;
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
    const pre = [s.tempo ? programTempoNote(voice, s.tempo) : "", s.note ?? ""].filter(Boolean).join(" ");
    return pre ? { ...rx, note: `${pre} ${rx.note}` } : rx;
  };
  const mode = (rx: Prescription): Prescription => {
    if (modo === "suave" && rx.type !== "deload") return { ...rx, sets: Math.max(2, rx.sets - 1), reps: rx.reps.slice(0, Math.max(2, rx.sets - 1)), note: `${modeNote(voice, "suave")} ${rx.note}` };
    if (modo === "fuerte" && rx.type !== "cal") return { ...rx, note: `${modeNote(voice, "fuerte")} ${rx.note}` };
    return rx;
  };
  /** La indicación del motor dicha en el registro de la persona (mismos números). */
  const voiced = (rx: Prescription, cfg: SlotCfg, inc: number): Prescription => ({ ...rx, note: rxNote(voice, rx, cfg, { weighted: inc > 0 }) });
  const build = (id: ExerciseId, cfg: SlotCfg, s: (typeof slots)[number]): PlayerExercise => {
    const h = hist[id] ?? [];
    const best = Math.max(0, ...h.flat().map((x) => (x.kg ? e1rm(x.kg, x.reps) : 0)));
    const rx = mode(withProgramNote(voiced(prescribe(id, cfg, h, { deload: d.deload }), cfg, EX[id].inc), s));
    return { id, name: EX[id].n, muscle: EX[id].m, cfg: PER_SIDE.has(id) && cfg.perSide == null ? { ...cfg, perSide: true } : cfg, tech: TECH[id] ?? null, bw: EX[id].inc === 0, barbell: BARBELL.has(id), load: loadKindOf(id, { inc: EX[id].inc }), rx, best, lastSets: h.at(-1) ?? null, ...(s.tempo ? { tempo: s.tempo } : {}) };
  };
  // Ejercicio de la biblioteca: solo su propia animación (nunca la del ejercicio del plan: una variante es otro movimiento).
  const buildLib = (x: LibEx, s: (typeof slots)[number]): PlayerExercise => {
    const id = `ds:${x.id}`, h = hist[id] ?? [], inc = incFor(x.eq);
    const best = Math.max(0, ...h.flat().map((r) => (r.kg ? e1rm(r.kg, r.reps) : 0)));
    return { id, name: x.n, muscle: s.muscle || cap(esLib(MUSCLE, x.t)), cfg: s.cfg, bw: inc === 0, barbell: x.eq === "barbell" || x.eq === "olympic barbell", load: loadKindOf(id, { inc, eq: x.eq }),
      rx: mode(withProgramNote(voiced(prescribe(id, s.cfg, h, { deload: d.deload, inc }), s.cfg, inc), s)), best, lastSets: h.at(-1) ?? null, ...(s.tempo ? { tempo: s.tempo } : {}),
      tech: { anim: animFor(x) ?? "", mus: cap([x.t, ...x.m2].map((m) => esLib(MUSCLE, m)).join(", ")), how: x.s, cues: [], err: [], mono: "" } };
  };
  const options = slots.map((s, i) => {
    const main = libMain[i];
    if (main) return [buildLib(main, s), ...libAlts[i].map((x) => buildLib(x, s))];
    return [...optionIds[i].map((id) => build(id, s.cfg, s)), ...libAlts[i].map((x) => buildLib(x, s))];
  });
  // "Cambiar por este" desde la biblioteca: ubica el ejercicio del plan y agrega la variante si no estaba entre las opciones.
  let preswap: { slot: number; option: number } | null = null;
  if (cambiar && por && cambiar.length <= 40 && por.length <= 40) {
    const slot = slots.findIndex((e, i) => e.id === cambiar || options[i].some((o) => o.id === cambiar));
    if (slot >= 0) {
      let option = options[slot].findIndex((o) => o.id === por);
      if (option < 0 && por.startsWith("ds:")) {
        const x = getLibEx(por.slice(3));
        if (x) { options[slot].push(buildLib(x, slots[slot])); option = options[slot].length - 1; }
      }
      if (option > 0) preswap = { slot, option };
    }
  }
  // Programa con su propia coach (Coach Platanita): mientras dura, ella presenta cada entreno (también el exprés) y
  // aparece haciendo cada ejercicio que tiene ilustración.
  const coach = prog ? coachOf(prog.meta.experience) : null;
  if (coach && coach.id !== "banana") for (const list of options) for (const o of list) o.art = coachArt(coach, o.id);
  // Coach Platanita presenta la sesión del programa antes de la primera serie (el motor no trae gancho para estas).
  const sess = plan.program && prog ? prog.run.weekSessions.find((w) => w.day === plan.program!.day)?.session : undefined;
  const intro = coach && coach.id !== "banana" && sess?.focus ? `${sess.focus.replace(/\.?$/, ".")} Son unos ${plan.mins ?? prog?.meta.sessionMinutes ?? 25} minutos, a tu ritmo.` : undefined;
  const template = plan.key ?? plan.tpl ?? (expres ? `expres${expres}` : "descanso");
  const title = plan.name;
  const doneToday = options.length > 0 && doneTemplates.includes(template);
  // Cierre del entreno: el próximo de la rutina (sin programa: el programa ya muestra su semana en Hoy).
  let upcoming: { when: string; name: string } | null = null;
  if (!prog && !expres && plan.tpl) {
    const from = plan.dow ?? d.today.dow;
    const nd = nextTrainingDow(d.engineSched, from);
    if (nd != null) {
      const ahead = ((nd - d.today.dow + 7) % 7) || 7;
      const np = planDay(nd, d.week, d.engineSched, d.opts);
      upcoming = { when: ahead === 1 ? "mañana" : `el ${DAY_NAMES[nd]}`, name: np.name };
    }
  }
  return <Player nutritionUpsell={nutritionUpsell} upcoming={upcoming} voice={voice} hook={plan.hook} intro={intro} mins={plan.mins ?? null} template={template} title={title} icon={plan.icon} cardio={plan.cardio} options={options} dateKey={d.today.iso} mode={modo === "suave" || modo === "fuerte" ? modo : "normal"}
    doneToday={doneToday} repeat={repetir === "1"} preswap={preswap} ballast={!(plan.program && prog && !prog.meta.adapt)} coach={coach && coach.id !== "banana" ? { name: coach.name, avatar: coach.avatar } : null} gam={{ xp: g.xp, streak: g.streak.days, todayDone: g.streak.todayDone, sex: a.sex }} />;
}
