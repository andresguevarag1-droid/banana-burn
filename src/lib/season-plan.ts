// Una temporada a la medida de la persona: toma el programa de la temporada y su cuestionario y devuelve el programa que
// ve (solo las sesiones que eligió, en los días que no chocan con su deporte, sin lo que le molesta, con los ejercicios
// que caben en sus minutos y con descarga antes de su evento). PURO y probado en season-plan.test.ts.
import type { Equipment } from "./engine";
import type { ProgramDef, ProgramExercise, ProgramMeta, ProgramSession } from "./programs";
import {
  AVOID_SWAPS, EX_PER_MINUTES, INJURY_SWAPS, SESSION_DAY, SESSION_ORDER, SEASON_WEEKS, planWeek, taperWeeks,
  type Area, type SeasonInfo, type SeasonIntake, type SessionKind, type SportId, type WeekPlan,
} from "./seasons";

/** Sin cuestionario todavía: 3 sesiones lunes, miércoles y viernes, en gimnasio, 45 minutos. */
export const DEFAULT_INTAKE: SeasonIntake = {
  level: "recreativo", years: 0, trainDays: [0, 2, 4], time: "tarde", sessions: 3, minutes: 45, place: "gym", equipment: [], injuries: [], goal: "", eventDate: null, eventType: null,
};

/** Zonas que cuentan como molestia en raquetas (las molestias típicas del deporte también cambian ejercicios). */
const RACKET_AREA: Record<string, Area> = { codo: "codo", hombro: "hombro", muneca: "muneca", rodilla: "rodilla", tobillo: "tobillo" };

/** Equipo del motor según el lugar: el gimnasio usa la versión de gimnasio; la casa, las alternativas `home`. */
export const equipmentFor = (i: Pick<SeasonIntake, "place">): Equipment => (i.place === "casa" ? "casa" : "gym");

/** Cambios por molestias (y en Cross Training, lo que no puede o no quiere hacer). */
export function swapsFor(sport: SportId, i: SeasonIntake): Record<string, string | null> {
  const areas = new Set<Area>(i.injuries);
  if (sport === "raquetas") for (const p of i.raquetas?.pains ?? []) areas.add(RACKET_AREA[p]);
  const out: Record<string, string | null> = {};
  for (const a of areas) Object.assign(out, INJURY_SWAPS[a]);
  if (sport === "cross") for (const a of i.cross?.avoid ?? []) Object.assign(out, AVOID_SWAPS[a]);
  return out;
}

/** Aplica los cambios a una sesión: reemplaza (sin repetir un ejercicio) o quita. Recorta a lo que cabe en los minutos. */
export function adaptExercises(list: ProgramExercise[], swaps: Record<string, string | null>, max: number): ProgramExercise[] {
  const out: ProgramExercise[] = [];
  for (const e of list) {
    if (!(e.id in swaps)) { if (!out.some((x) => x.id === e.id)) out.push(e); continue; }
    const to = swaps[e.id];
    if (!to || out.some((x) => x.id === to) || list.some((x) => x.id === to && !(x.id in swaps))) continue;
    out.push({ ...e, id: to, home: e.home && !(e.home in swaps) ? e.home : undefined, note: "Cambiado por lo que nos contaste en tu cuestionario." });
  }
  return out.slice(0, max);
}

/**
 * Fases de la persona: las de la temporada, con las semanas de afinamiento antes de su evento convertidas en descarga.
 * Devuelve fases y un mapa (fase nueva → fase original) para copiar sus sesiones.
 */
export function personalPhases(base: ProgramMeta["phases"], taper: number[]): { phases: ProgramMeta["phases"]; from: number[] } {
  const weekPhase: number[] = [];
  base.forEach((p, i) => { for (let k = 0; k < p.weeks; k++) weekPhase.push(i); });
  const phases: ProgramMeta["phases"] = [], from: number[] = [];
  for (let w = 1; w <= weekPhase.length; w++) {
    const src = weekPhase[w - 1];
    const deload = !!base[src].deload || taper.includes(w);
    const last = phases.at(-1);
    if (last && from.at(-1) === src && !!last.deload === deload) { last.weeks++; continue; }
    const extra = deload && !base[src].deload;
    phases.push({ name: extra ? "Afinar para tu evento" : base[src].name, weeks: 1, ...(deload ? { deload: true } : {}), focus: extra ? "Volumen bajo para llegar fresco a tu evento. Mantén la técnica y la intensidad, con menos series." : base[src].focus });
    from.push(src);
  }
  return { phases, from: from.map((x) => x + 1) };
}

export type PersonalSeason = { def: ProgramDef; plan: WeekPlan; eq: Equipment; taper: number[]; kinds: SessionKind[] };

/**
 * El programa de la temporada para esta persona. Las sesiones elegidas se renumeran en el orden de sus días de la semana
 * (el motor de programas las espera en orden) y `slots` dice qué día de la semana (0 = lunes, el día de inicio) va cada una.
 */
export function personalSeason(def: ProgramDef, season: Pick<SeasonInfo, "sport" | "startsOn" | "endsOn">, intake: SeasonIntake | null): PersonalSeason {
  const i = intake ?? DEFAULT_INTAKE;
  const plan = planWeek(season.sport, i);
  const slots = [...plan.slots].sort((a, b) => a.dow - b.dow);
  const kinds = slots.map((s) => s.kind);
  const swaps = swapsFor(season.sport, i);
  const max = EX_PER_MINUTES[i.minutes];
  const taper = taperWeeks(season, i.eventDate);
  const { phases, from } = personalPhases(def.meta.phases, taper);
  const sessions: ProgramSession[] = [];
  from.forEach((src, k) => {
    slots.forEach((slot, j) => {
      const s = def.sessions.find((x) => x.phase === src && x.day === SESSION_DAY[slot.kind]);
      if (s) sessions.push({ ...s, phase: k + 1, day: j + 1, optional: false, exercises: adaptExercises(s.exercises, swaps, max) });
    });
  });
  const meta: ProgramMeta = { ...def.meta, phases, daysPerWeek: Math.max(1, slots.length), sessionMinutes: i.minutes };
  return { def: { ...def, meta, sessions, slots: slots.map((s) => s.dow) }, plan, eq: equipmentFor(i), taper, kinds };
}

/** Número de semanas (siempre 8) para comprobar que el calendario no cambió. */
export const personalWeeks = (p: PersonalSeason) => p.def.meta.phases.reduce((a, x) => a + x.weeks, 0) === SEASON_WEEKS;
export { SESSION_ORDER };
