// Programas en el servidor: estado de la persona, sesiones (con la RLS de 0024), sesiones hechas y la rutina del día.
// La lógica pura (semana, día, pausas, nutrición) vive en programs.ts y está probada en programs.test.ts.
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient, type Viewer } from "@/lib/supabase/server";
import { mondayOf, todayFor } from "@/lib/today";
import { EX, e1rm, isTrainingDay, type Equipment, type ExerciseId, type PlannedDay } from "@/lib/engine";
import { TECH } from "@/lib/engine/technique";
import { animFor, es, getLibEx, MUSCLE } from "@/lib/library";
import { getCatalog, getOwned } from "@/lib/challenges-server";
import { isProgram, type Challenge, type CoverStyle } from "@/lib/challenges";
import { PROGRAM_SEED_BY_SLUG } from "@/lib/program-seed";
import { SEASON_SEED_BY_SLUG } from "@/lib/season-content";
import { intakeForCoach, isSeasonSlug, parseSeasonSlug, type SportId, type WeekPlan } from "@/lib/seasons";
import { seasonCoachId } from "@/lib/coaches";
import { demoState, isDemoGirlProgram, type DemoState } from "@/lib/demo-persona";
import { es419Deep } from "./num";
import {
  addDays, calendarSlot, parseProgramTemplate, parseSession, plannedFromSession, resolveProgram, restDay, restLabel, setsLabel,
  type DoneSession, type ExInfo, type ProgramDef, type ProgramMeta, type ProgramRun, type ProgramSession, type ProgramState, type ProgramStatus,
} from "@/lib/programs";

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Nombre, músculo y equipo de un ejercicio del motor o de la biblioteca. */
export function exInfo(id: string): ExInfo | null {
  if (id.startsWith("ds:")) {
    const x = getLibEx(id.slice(3));
    return x ? { name: x.n, muscle: cap(es(MUSCLE, x.t)), eq: x.eq } : null;
  }
  const e = EX[id as ExerciseId];
  return e ? { name: e.n, muscle: e.m } : null;
}
/** ¿Existe el ejercicio? (validación del panel). */
export const knownExercise = (id: string) => exInfo(id) !== null;
/** Animación de técnica del mono para un ejercicio (null si no hay una que se parezca). */
export function exAnim(id: string): string | null {
  if (id.startsWith("ds:")) { const x = getLibEx(id.slice(3)); return x ? animFor(x) : null; }
  return TECH[id]?.anim || null;
}

// ───────────── Estado ─────────────

type UpRow = { slug: string; status: string; started_on: string; paused_on: string | null; paused_days: number | null; completed_at: string | null };
const STATUSES: ProgramStatus[] = ["activo", "pausado", "abandonado", "completado"];
const toState = (r: UpRow): ProgramState => ({
  slug: r.slug, status: STATUSES.includes(r.status as ProgramStatus) ? (r.status as ProgramStatus) : "abandonado", startedOn: String(r.started_on).slice(0, 10),
  pausedOn: r.paused_on ? String(r.paused_on).slice(0, 10) : null, pausedDays: Number(r.paused_days ?? 0), completedAt: r.completed_at,
});

/** Demo: Andrés empezó el programa insignia hace 9 días (semana 2) y lleva 4 sesiones hechas. */
export const DEMO_PROGRAM = "reconstruccion-8-semanas";
const demoStart = (today: string) => addDays(today, -9);
function demoDone(today: string): DoneSession[] {
  const s = demoStart(today);
  return [[1, 1, 0], [1, 2, 1], [1, 3, 3], [2, 1, 7]].map(([week, day, off]) => ({ week, day, on: addDays(s, off) }));
}

/**
 * Demo de chica (?programa=pilates-casa-30&dia=12): Sofía va por el día `day` y no se saltó ninguna sesión.
 * En pausa, la pausó hace 3 días en ese mismo día; completado, lo cerró ayer.
 */
export function girlDemoState(d: DemoState, today: string): ProgramState {
  const slug = d.program;
  const back = d.day - 1;
  if (d.status === "pausado") return { slug, status: "pausado", startedOn: addDays(today, -back - 3), pausedOn: addDays(today, -3), pausedDays: 0, completedAt: null };
  if (d.status === "completado") return { slug, status: "completado", startedOn: addDays(today, -back), pausedOn: null, pausedDays: 0, completedAt: `${addDays(today, -1)}T19:00:00.000Z` };
  return { slug, status: "activo", startedOn: addDays(today, -back), pausedOn: null, pausedDays: 0, completedAt: null };
}
/** Sesiones hechas del demo de chica: todas las que el calendario puso antes de hoy. */
export function girlDemoDone(st: ProgramState, today: string): DoneSession[] {
  const seed = PROGRAM_SEED_BY_SLUG[st.slug];
  if (!seed) return [];
  const def = { meta: seed.meta, sessions: seed.sessions };
  const active = { ...st, status: "activo" as const };
  const out: DoneSession[] = [];
  const last = st.status === "pausado" && st.pausedOn ? addDays(st.pausedOn, -1) : addDays(today, -1);
  for (let on = st.startedOn; on <= last; on = addDays(on, 1)) {
    const slot = calendarSlot(def, active, today, on);
    if (slot) out.push({ week: slot.week, day: slot.day, on });
  }
  return out;
}

/** Programas de la persona (todos los estados). Sin la migración 0024: ninguno. */
export const getProgramStates = cache(async (v: Viewer): Promise<ProgramState[]> => {
  if (v.demo) {
    const today = todayFor(v).iso;
    // Demo: ?programa=no muestra la rutina normal del motor (sin programa activo) para revisar Hoy y Entrenar.
    const ds = await demoState();
    // Demo de temporada (?temporada=running|raquetas|cross): empezó hace 9 días (semana 2), sin esperar la fecha oficial.
    if (ds.season) return [{ slug: `temporada-${ds.season}-1`, status: "activo", startedOn: addDays(today, -9), pausedOn: null, pausedDays: 0, completedAt: null }];
    if (isDemoGirlProgram(ds.program)) return [girlDemoState(ds, today)];
    if ((await cookies()).get("bb_demo_programa")?.value === "no") return [{ slug: "abdomen-marcado", status: "completado", startedOn: addDays(today, -55), pausedOn: null, pausedDays: 0, completedAt: `${addDays(today, -12)}T19:00:00.000Z` }];
    // Antes del programa insignia, Andrés completó Abdomen marcado (6 semanas): su certificado sale en Retos y en su perfil.
    return [
      { slug: DEMO_PROGRAM, status: "activo", startedOn: demoStart(today), pausedOn: null, pausedDays: 0, completedAt: null },
      { slug: "abdomen-marcado", status: "completado", startedOn: addDays(today, -55), pausedOn: null, pausedDays: 0, completedAt: `${addDays(today, -12)}T19:00:00.000Z` },
    ];
  }
  const { data, error } = await (await createClient()).from("user_programs").select("slug,status,started_on,paused_on,paused_days,completed_at").eq("user_id", v.id).order("updated_at", { ascending: false });
  if (error) return [];
  return ((data ?? []) as UpRow[]).map(toState);
});

/** Sesiones que quien mira puede leer (RLS: la fase 1 para todos; todo con la compra, si lo empezó o si es staff). */
export const getProgramSessions = cache(async (v: Viewer, slug: string): Promise<ProgramSession[]> => {
  if (v.demo) {
    const seed = PROGRAM_SEED_BY_SLUG[slug] ?? SEASON_SEED_BY_SLUG[slug];
    if (!seed) return [];
    const full = (await getOwned(v)).has(slug) || seed.priceUsd === 0 || (isSeasonSlug(slug) && (await demoState()).season !== null);
    return es419Deep(seed.sessions.filter((s) => full || s.phase === 1));
  }
  const { data, error } = await (await createClient()).from("program_sessions").select("phase,day,title,focus,optional,exercises").eq("slug", slug).order("phase").order("day");
  if (error) return [];
  return es419Deep((data ?? []).map(parseSession).filter((s): s is ProgramSession => !!s));
});

/** Sesiones hechas desde `since` (entrenos guardados con la plantilla del programa). */
export async function getProgramDone(v: Viewer, slug: string, since: string): Promise<DoneSession[]> {
  if (v.demo) {
    const today = todayFor(v).iso;
    if (slug === DEMO_PROGRAM) return demoDone(today);
    // Demo de temporada: la semana 1 completa (lunes, miércoles y viernes de su calendario).
    if (isSeasonSlug(slug)) return [1, 2, 3].map((day, k) => ({ week: 1, day, on: addDays(today, -9 + k * 2) }));
    const st = (await getProgramStates(v)).find((s) => s.slug === slug);
    return st && isDemoGirlProgram(slug) ? girlDemoDone(st, today) : [];
  }
  const { data } = await (await createClient()).from("workouts").select("day,template").eq("user_id", v.id).like("template", `p:${slug}:%`).gte("day", since).order("day").limit(500);
  const out: DoneSession[] = [];
  for (const r of (data ?? []) as { day: string; template: string }[]) {
    const t = parseProgramTemplate(String(r.template ?? ""));
    if (t && t.slug === slug) out.push({ week: t.week, day: t.day, on: String(r.day).slice(0, 10) });
  }
  return out;
}

export type ProgramChallenge = Challenge & { kind: "programa"; program: ProgramMeta };
export type LoadedProgram = {
  c: ProgramChallenge; def: ProgramDef; state: ProgramState; done: DoneSession[]; run: ProgramRun;
  /** Temporada: el equipo que eligió en su cuestionario manda sobre el de su perfil. */
  eq?: Equipment;
  /** Temporada: su semana armada alrededor del deporte (avisos incluidos). */
  season?: { sport: SportId; plan: WeekPlan; taper: number[]; note: string | null };
};

/** Carga un programa de la persona con su estado y qué toca hoy. Null si ya no existe o no tiene sesiones visibles. */
export async function loadProgram(v: Viewer, st: ProgramState): Promise<LoadedProgram | null> {
  const c = (await getCatalog(v.demo)).get(st.slug);
  if (!c || !isProgram(c)) return null;
  const sessions = await getProgramSessions(v, st.slug);
  if (!sessions.length) return null;
  const done = await getProgramDone(v, st.slug, st.startedOn);
  const def: ProgramDef = { slug: c.id, title: c.title, meta: c.program, sessions };
  const sm = parseSeasonSlug(st.slug);
  if (sm) {
    // Temporada: el programa a la medida de su cuestionario y con la coach con la ropa del deporte.
    const { personalize, getIntake } = await import("@/lib/seasons-server");
    const { getSex } = await import("@/lib/athlete");
    const { listRuns } = await import("@/lib/runs-server");
    const { runsForCoach } = await import("@/lib/runs");
    const [ps, sex, intake, runs, runNote] = await Promise.all([personalize(v, def), getSex(v), getIntake(v, st.slug), listRuns(v, 14).catch(() => []), sm.sport === "running" ? runningCoachNote(v).catch(() => null) : Promise.resolve(null)]);
    if (ps) {
      const exp = c.program.experience ? { ...c.program.experience, coach: seasonCoachId(sm.sport, sex) } : undefined;
      const meta: ProgramMeta = { ...ps.def.meta, ...(exp ? { experience: exp } : {}) };
      const pdef = { ...ps.def, meta };
      return { c: { ...c, program: meta }, def: pdef, state: st, done, run: resolveProgram(pdef, st, done, todayFor(v).iso), eq: ps.eq, season: { sport: sm.sport, plan: ps.plan, taper: ps.taper, note: [intake ? intakeForCoach(sm.sport, intake.answers, todayFor(v).iso) : null, runNote, runsForCoach(runs)].filter(Boolean).join(" ") || null } };
    }
  }
  return { c, def, state: st, done, run: resolveProgram(def, st, done, todayFor(v).iso) };
}

/** Hábitos marcados a mano hoy en el programa (0027). Sin la columna todavía: ninguno, sin romper Hoy. */
export async function getProgramChecks(v: Viewer, day: string): Promise<string[]> {
  if (v.demo) return ["activacion"];
  const { data, error } = await (await createClient()).from("daily_logs").select("program_checks").eq("user_id", v.id).eq("day", day).maybeSingle();
  if (error) return [];
  return ((data?.program_checks as string[] | null) ?? []).filter((k) => typeof k === "string");
}

/** El programa activo (uno como máximo). */
export const getActiveProgram = cache(async (v: Viewer): Promise<LoadedProgram | null> => {
  const st = (await getProgramStates(v)).find((s) => s.status === "activo");
  if (!st) return null;
  // Una temporada en preventa todavía no toma la app: hasta su fecha oficial sigue la rutina normal.
  if (!v.demo && isSeasonSlug(st.slug) && todayFor(v).iso < st.startedOn) return null;
  return loadProgram(v, st);
});

// ───────────── Rutina del día para el resto de la app ─────────────

/** Lo que el programa activo le pone a Hoy, Entrenar, el reproductor y el coach. Datos planos (viajan al cliente). */
export type AthleteProgram = {
  slug: string; title: string; cover: CoverStyle; icon: string; meta: ProgramMeta; state: ProgramState; run: ProgramRun;
  /** Temporada deportiva: deporte y sus respuestas en una línea para la coach. */
  season?: { sport: SportId; note: string | null };
  plan: PlannedDay; weekPlan: PlannedDay[]; sched: Record<number, boolean>; yesterday: PlannedDay; tomorrow: PlannedDay;
};

export function programContext(p: LoadedProgram, eq0: Equipment, today: { iso: string; dow: number }): AthleteProgram {
  const { c, def, state, run } = p;
  const eq = p.eq ?? eq0;
  const dowOf = (iso: string) => new Date(iso + "T12:00:00").getDay();
  const at = (iso: string): PlannedDay => {
    const slot = calendarSlot(def, state, today.iso, iso);
    return slot ? plannedFromSession(def, c.icon, slot.session, slot.week, dowOf(iso), eq, exInfo) : restDay(dowOf(iso));
  };
  let plan: PlannedDay;
  if (run.today === "entreno" && run.next) plan = plannedFromSession(def, c.icon, run.next.session, run.next.week, today.dow, eq, exInfo);
  else if (run.today === "hecho") {
    const d = p.done.filter((x) => x.on === today.iso).at(-1);
    const s = d ? def.sessions.find((x) => x.phase === run.phase.index && x.day === d.day) : undefined;
    plan = s && d ? plannedFromSession(def, c.icon, s, d.week, today.dow, eq, exInfo) : restDay(today.dow);
  } else plan = restDay(today.dow, run.today === "semana-completa" ? "Semana del programa completa. Camina y estira" : "Camina 8-12k pasos y estira 10 min");
  const mon = mondayOf(today.iso);
  const weekPlan = [0, 1, 2, 3, 4, 5, 6].map((i) => at(addDays(mon, i)));
  return {
    slug: c.id, title: c.title, cover: c.cover, icon: c.icon, meta: c.program, state, run, plan, weekPlan, ...(p.season ? { season: { sport: p.season.sport, note: p.season.note } } : {}),
    sched: Object.fromEntries(weekPlan.map((d) => [d.dow, isTrainingDay(d)])), yesterday: at(addDays(today.iso, -1)), tomorrow: at(addDays(today.iso, 1)),
  };
}

// ───────────── Progreso del programa ─────────────

export type LiftGain = { id: string; name: string; unit: "kg" | "reps" | "s"; first: number; last: number; firstOn: string; lastOn: string };

/**
 * Fuerza en los ejercicios clave desde que empezó el programa: la mejor serie de la primera sesión contra la de la
 * última. Con carga, 1RM estimado (kg); sin carga, repeticiones o segundos.
 */
export async function getLiftGains(v: Viewer, ids: string[], since: string, units: Record<string, "kg" | "reps" | "s">): Promise<LiftGain[]> {
  if (!ids.length) return [];
  let rows: { exercise: string; kg: number | null; reps: number; day: string }[] = [];
  if (v.demo) {
    // Demo: la misma historia que demo-story (subidas pequeñas y constantes), solo para ver la pantalla.
    const base: Record<string, number> = { bench: 88, rdl: 96, dbrow: 32, "ds:1409": 90 };
    const t = todayFor(v).iso;
    rows = ids.filter((id) => base[id]).flatMap((id) => [{ exercise: id, kg: base[id], reps: 10, day: addDays(t, -9) }, { exercise: id, kg: Math.round(base[id] * 1.04 * 2) / 2, reps: 10, day: addDays(t, -2) }]);
  } else {
    const { data } = await (await createClient()).from("workout_sets").select("exercise,kg,reps,workouts!inner(day)").eq("user_id", v.id).in("exercise", ids).gte("workouts.day", since).limit(2000);
    rows = ((data ?? []) as unknown as { exercise: string; kg: number | null; reps: number | null; workouts: { day: string } }[]).map((r) => ({ exercise: r.exercise, kg: r.kg == null ? null : Number(r.kg), reps: Number(r.reps ?? 0), day: r.workouts.day }));
  }
  const out: LiftGain[] = [];
  for (const id of ids) {
    const unit = units[id] ?? "kg";
    const byDay = new Map<string, number>();
    for (const r of rows.filter((x) => x.exercise === id)) {
      const val = unit === "kg" ? (r.kg && r.reps ? e1rm(r.kg, r.reps) : 0) : r.reps;
      if (val > 0) byDay.set(r.day, Math.max(byDay.get(r.day) ?? 0, val));
    }
    const days = [...byDay.keys()].sort();
    if (!days.length) continue;
    out.push({ id, name: exInfo(id)?.name ?? id, unit, first: byDay.get(days[0])!, last: byDay.get(days.at(-1)!)!, firstOn: days[0], lastOn: days.at(-1)! });
  }
  return out;
}

/** Sesiones listas para mostrar (Entrenar y la vista previa de la tienda), ya adaptadas al equipo de la persona. */
export function sessionViews(def: Pick<ProgramDef, "slug" | "title" | "meta">, icon: string, sessions: ProgramSession[], week: number, eq: Equipment, done: (day: number) => boolean, href: (day: number) => string | null) {
  return sessions.map((s) => {
    const p = plannedFromSession(def, icon, s, week, 0, eq, exInfo);
    return {
      day: s.day, title: s.title, focus: s.focus, optional: !!s.optional, done: done(s.day), mins: p.mins ?? 45, href: href(s.day),
      exercises: (p.program?.exercises ?? []).map((e) => ({ id: e.id, name: e.name, muscle: e.muscle, sets: setsLabel(e.cfg), cfg: { sets: e.cfg.sets, lo: e.cfg.lo, hi: e.cfg.hi, unit: e.cfg.unit, ...(e.cfg.perSide ? { perSide: true } : {}) }, rest: restLabel(e.cfg.rest), tempo: e.tempo, note: e.note })),
    };
  });
}

/** Running para la coach: carrera objetivo, fase del plan, ritmos y marcas (solo números, sin lugares). */
async function runningCoachNote(v: Viewer): Promise<string | null> {
  const { getRunningView } = await import("@/lib/running-server");
  const { planForCoach } = await import("@/lib/run-plan");
  const { fmtTime } = await import("@/lib/run-fitness");
  const r = await getRunningView(v);
  const parts: string[] = [];
  if (r.goal && r.plan) parts.push(planForCoach(r.plan, r.today, r.goal.name));
  else if (r.goal) parts.push(`Prepara una carrera de ${Math.round(r.goal.distanceM / 100) / 10} km el ${r.goal.raceDate}${r.goal.ownPlan ? " con su propio plan de carrera" : ""}.`);
  if (r.goal?.goalS) parts.push(`Meta: ${fmtTime(r.goal.goalS)}${r.check ? ` (estimado hoy ${fmtTime(r.check.now)})` : ""}.`);
  const b = r.bests;
  const pb = [b.km5 ? `5 km en ${fmtTime(b.km5.seconds)}` : null, b.km10 ? `10 km en ${fmtTime(b.km10.seconds)}` : null, b.longest ? `la más larga ${Math.round(b.longest.distanceM / 100) / 10} km` : null].filter(Boolean);
  if (pb.length) parts.push(`Marcas: ${pb.join(", ")}.`);
  return parts.join(" ") || null;
}
