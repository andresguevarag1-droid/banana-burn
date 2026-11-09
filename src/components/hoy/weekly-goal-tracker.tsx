"use client";
// Meta semanal (#288) en funnel_events: weekly_goal_view cada vez que Hoy la muestra y weekly_goal_done una vez por semana
// en este navegador (localStorage por lunes local) cuando ya la cumplió. El embudo cuenta cuentas distintas.
import { useEffect } from "react";
import { track } from "@/components/analytics";

export const weeklyDoneKey = (monday: string) => `bb_meta_semanal_${monday}`;

export function WeeklyGoalTracker({ count, goal, monday, weekStreak }: { count: number; goal: number; monday: string; weekStreak: number }) {
  useEffect(() => {
    const props = { count, goal, week_streak: weekStreak };
    track("weekly_goal_view", props);
    if (count < goal) return;
    try {
      if (localStorage.getItem(weeklyDoneKey(monday))) return;
      localStorage.setItem(weeklyDoneKey(monday), "1");
    } catch { /* sin almacenamiento: se manda igual */ }
    track("weekly_goal_done", props);
  }, [count, goal, monday, weekStreak]);
  return null;
}
