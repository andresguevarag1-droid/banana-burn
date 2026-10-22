import { ageOn, planDay, planWeek, scheduleFor, targets, weekIndex, isDeloadWeek, type Mode, type Sex, type Equipment, type Level } from "@/lib/engine";
import { crToday, mondayOf } from "@/lib/today";
import { createClient, type Viewer } from "@/lib/supabase/server";

export type Athlete = {
  name: string; dob: string; heightCm: number; startWeight: number; currentWeight: number; goalWeight: number; goalDate: string; startDate: string; mode: Mode; complete: boolean; trainDays: number; sex: Sex; equipment: Equipment; level: Level; minutes: number | null;
};

const DEMO: Athlete = { name: "Andrés", dob: "1999-01-27", heightCm: 182, startWeight: 96.7, currentWeight: 93.1, goalWeight: 85, goalDate: "2026-12-31", startDate: "2026-10-19", mode: "acelerada", complete: true, trainDays: 6, sex: "m", equipment: "gym", level: "intermedio", minutes: null };

export async function getAthlete(v: Viewer): Promise<Athlete> {
  if (v.demo) return DEMO;
  const sb = await createClient();
  const [{ data: p }, { data: g }, { data: w }] = await Promise.all([
    sb.from("profiles").select("full_name,dob,height_cm,train_days,sex,onboarded,equipment,level,session_minutes").eq("id", v.id).maybeSingle(),
    sb.from("goals").select("*").eq("user_id", v.id).eq("active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("weights").select("kg").eq("user_id", v.id).order("day", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const complete = Boolean(p?.onboarded && p?.dob && p?.height_cm && g);
  return {
    name: p?.full_name?.split(" ")[0] || v.name,
    dob: p?.dob ?? "1995-01-01", heightCm: Number(p?.height_cm ?? 170),
    startWeight: Number(g?.start_weight ?? 80), currentWeight: Number(w?.kg ?? g?.start_weight ?? 80),
    goalWeight: Number(g?.goal_weight ?? 75), goalDate: g?.goal_date ?? "2026-12-31",
    startDate: g?.start_date ?? mondayOf(crToday().iso), mode: (g?.mode as Mode) ?? "acelerada", complete, trainDays: Number(p?.train_days ?? 6), sex: (p?.sex as Sex) ?? "m", equipment: (p?.equipment as Equipment) ?? "gym", level: (p?.level as Level) ?? "intermedio", minutes: p?.session_minutes ?? null,
  };
}

export function dashboard(a: Athlete) {
  const today = crToday();
  const week = weekIndex(mondayOf(a.startDate), today.date);
  const t = targets({ kg: a.currentWeight, heightCm: a.heightCm, age: ageOn(a.dob, today.date), mode: a.mode, sex: a.sex });
  const sched = scheduleFor(a.trainDays);
  const opts = { equipment: a.equipment, level: a.level, minutes: a.minutes ?? undefined };
  const daysLeft = Math.max(1, Math.round((new Date(a.goalDate + "T12:00:00").getTime() - today.date.getTime()) / 864e5));
  const toGo = Math.max(0, a.currentWeight - a.goalWeight);
  const total = Math.max(0.1, a.startWeight - a.goalWeight);
  return {
    today, week, deload: isDeloadWeek(week), t,
    plan: planDay(today.dow, week, sched, opts), yesterday: planDay((today.dow + 6) % 7, week, sched, opts), tomorrow: planDay((today.dow + 1) % 7, week, sched, opts), sched, equipment: a.equipment, opts,
    weekPlan: planWeek(week, sched, opts), daysLeft, toGo, needPerWeek: Math.round((toGo / (daysLeft / 7)) * 100) / 100,
    progress: Math.min(1, Math.max(0, (a.startWeight - a.currentWeight) / total)),
  };
}
