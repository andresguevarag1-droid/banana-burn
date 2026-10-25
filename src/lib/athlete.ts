import { cache } from "react";
import { ageOn, goalPace, planDay, planWeek, scheduleFor, targets, weekIndex, isDeloadWeek, type Mode, type Sex, type Equipment, type Level } from "@/lib/engine";
import { mondayOf, todayFor } from "@/lib/today";
import { DEMO_NOW_KG, DEMO_START_KG, demoStartDate } from "@/lib/demo-story";
import { glp1Targets, injectionPhase, type Glp1, type Glp1Med } from "@/lib/glp1";
import { createClient, type Viewer } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements";
import { programNutrition, withProgramProtein, type ProgramNutrition } from "@/lib/programs";
import { getActiveProgram, programContext, type AthleteProgram } from "@/lib/programs-server";
import { getVoice } from "@/lib/voice-server";
import type { Voice } from "@/lib/voice";
import { DEMO_GIRL, demoState } from "@/lib/demo-persona";

export type Athlete = {
  name: string; dob: string; heightCm: number; startWeight: number; currentWeight: number; goalWeight: number; goalDate: string; startDate: string; mode: Mode; complete: boolean; trainDays: number; sex: Sex; equipment: Equipment; level: Level; minutes: number | null; glp1: Glp1;
  /** Zona horaria del usuario para calcular "hoy". */
  tz?: string;
  /** País del usuario (ISO 2 letras). */
  country?: string | null;
  /** Programa activo (0024): reemplaza la rutina del motor. Solo con acceso a la app (`ent.app`). */
  program?: AthleteProgram | null;
  /** Ajuste de nutrición del programa: solo si la persona tiene nutrición (`ent.nutrition`). Un programa nunca la da. */
  programNutrition?: ProgramNutrition | null;
  /** "Cómo te hablo" (0035): registro del lenguaje del entreno y del coach. */
  voice?: Voice;
};

const DEMO: Athlete = { name: "Andrés", dob: "1999-01-27", heightCm: 182, startWeight: 94.9, currentWeight: 93.1, goalWeight: 85, goalDate: "2026-12-31", startDate: "2026-10-19", mode: "acelerada", complete: true, trainDays: 6, sex: "m", equipment: "gym", level: "intermedio", minutes: null, glp1: { on: false, med: "semaglutida", injectionDow: null, since: null } };

/** Solo el sexo de la persona (para ordenar la tienda o el texto en femenino) sin cargar todo el atleta. */
export const getSex = cache(async (v: Viewer): Promise<Sex> => {
  if (v.demo) return (await demoState()).girl ? "f" : "m";
  const { data } = await (await createClient()).from("profiles").select("sex").eq("id", v.id).maybeSingle();
  return data?.sex === "f" ? "f" : "m";
});

/** Una lectura por request (React cache): página, layout y componentes comparten el resultado. */
export const getAthlete = cache(async function getAthlete(v: Viewer): Promise<Athlete> {
  if (v.demo) {
    // Demo de chica (?programa=pilates-casa-30 o ?persona=chica): Sofía, mujer; en Pilates entrena en casa.
    const ds = await demoState();
    const girl: Partial<Athlete> = ds.girl ? { name: DEMO_GIRL.name, sex: "f", heightCm: DEMO_GIRL.heightCm, goalWeight: DEMO_GIRL.goalWeight, trainDays: 5, ...(ds.program === "pilates-casa-30" ? { equipment: "casa" as Equipment, level: "principiante" as Level } : {}) } : {};
    return withProgram(v, { ...DEMO, ...girl, voice: await getVoice(v), tz: v.tz, country: v.country, startWeight: DEMO_START_KG, currentWeight: DEMO_NOW_KG, startDate: demoStartDate(todayFor(v).iso) });
  }
  const sb = await createClient();
  const [{ data: p }, { data: g }, { data: w }, ent, voice] = await Promise.all([
    sb.from("profiles").select("full_name,dob,height_cm,train_days,sex,onboarded,equipment,level,session_minutes,glp1,glp1_med,glp1_injection_dow,glp1_since").eq("id", v.id).maybeSingle(),
    sb.from("goals").select("*").eq("user_id", v.id).eq("active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("weights").select("kg").eq("user_id", v.id).order("day", { ascending: false }).limit(1).maybeSingle(),
    getEntitlements(v),
    getVoice(v),
  ]);
  const complete = Boolean(p?.onboarded && p?.dob && p?.height_cm && g);
  return withProgram(v, {
    name: p?.full_name?.split(" ")[0] || v.name,
    dob: p?.dob ?? "1995-01-01", heightCm: Number(p?.height_cm ?? 170),
    startWeight: Number(g?.start_weight ?? 80), currentWeight: Number(w?.kg ?? g?.start_weight ?? 80),
    goalWeight: Number(g?.goal_weight ?? 75), goalDate: g?.goal_date ?? "2026-12-31",
    startDate: g?.start_date ?? mondayOf(todayFor(v).iso), mode: (g?.mode as Mode) ?? "acelerada", complete, trainDays: Number(p?.train_days ?? 6), sex: (p?.sex as Sex) ?? "m", equipment: (p?.equipment as Equipment) ?? "gym", level: (p?.level as Level) ?? "intermedio", minutes: p?.session_minutes ?? null,
    tz: v.tz, country: v.country, voice,
    // Banana Shield es de Entreno + Nutrición: sin nutrición se apaga en todas las pantallas (el perfil guarda la configuración).
    glp1: { on: Boolean(p?.glp1) && ent.nutrition, med: ((p?.glp1_med as Glp1Med) ?? "otro"), injectionDow: p?.glp1_injection_dow ?? null, since: p?.glp1_since ?? null },
  });
});

/**
 * Programa activo (0024): toma el control del entreno del día y, si hay nutrición, puede ajustar calorías y proteína.
 * Sin acceso a la app no se aplica (queda guardado y vuelve al renovar). Nunca bloquea la pantalla si falla.
 */
async function withProgram(v: Viewer, a: Athlete): Promise<Athlete> {
  try {
    const [ent, p] = await Promise.all([getEntitlements(v), getActiveProgram(v)]);
    if (!p || !ent.app) return { ...a, program: null, programNutrition: null };
    return { ...a, program: programContext(p, a.equipment, todayFor(a)), programNutrition: programNutrition(p.c.program, ent) };
  } catch (e) {
    console.warn("[programas] no se pudo cargar el programa activo", e instanceof Error ? e.message : e);
    return { ...a, program: null, programNutrition: null };
  }
}

export function dashboard(a: Athlete) {
  const today = todayFor(a);
  const week = weekIndex(mondayOf(a.startDate), today.date);
  const age = ageOn(a.dob, today.date);
  // El programa puede pedir otro modo de calorías y otra proteína (solo llega si la persona tiene nutrición).
  const pn = a.programNutrition ?? null;
  const base = withProgramProtein(targets({ kg: a.currentWeight, heightCm: a.heightCm, age, mode: pn?.mode ?? a.mode, sex: a.sex }), pn, a.currentWeight);
  const g = a.glp1.on ? glp1Targets({ kg: a.currentWeight, goalKg: a.goalWeight, heightCm: a.heightCm, age, sex: a.sex }) : null;
  const t = g ? { ...base, kcal: g.kcal, protein: g.protein, fat: g.fat, carbs: g.carbs, steps: 8000 } : base;
  const sched = scheduleFor(a.trainDays);
  const opts = { equipment: a.equipment, level: a.level, minutes: a.minutes ?? undefined, sex: a.sex };
  const pr = a.program ?? null;
  const toGo = a.mode === "fuerza" ? Math.max(0, a.goalWeight - a.currentWeight) : Math.max(0, a.currentWeight - a.goalWeight);
  const { daysLeft, needPerWeek, goalPassed } = goalPace(a.goalDate, today.date, toGo);
  const total = Math.max(0.1, a.startWeight - a.goalWeight);
  return {
    glp1: g ? { ...g, phase: injectionPhase(a.glp1.injectionDow, today.dow) } : null,
    today, week, deload: pr ? pr.run.phase.phase.deload === true : isDeloadWeek(week), t,
    plan: pr ? pr.plan : planDay(today.dow, week, sched, opts),
    yesterday: pr ? pr.yesterday : planDay((today.dow + 6) % 7, week, sched, opts),
    tomorrow: pr ? pr.tomorrow : planDay((today.dow + 1) % 7, week, sched, opts),
    /** Días con entreno por día de la semana (0 = domingo). Con programa: su calendario de esta semana. */
    sched: (pr ? pr.sched : sched) as Record<number, unknown>, engineSched: sched, equipment: a.equipment, opts,
    weekPlan: pr ? pr.weekPlan : planWeek(week, sched, opts), daysLeft, toGo, needPerWeek, goalPassed,
    program: pr, mode: pn?.mode ?? a.mode,
    progress: Math.min(1, Math.max(0, (a.startWeight - a.currentWeight) / total)),
  };
}
