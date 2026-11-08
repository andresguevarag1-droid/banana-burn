// Hoy: la meta de la semana al frente (#288). "Esta semana: 1 de 3 entrenos" con una banana por entreno, la racha semanal
// ("2 semanas cumpliendo tu meta") y, debajo y más chica, la racha diaria. La meta y los conteos salen de meta-semanal.ts.
import Link from "next/link";
import { Banana, BananaFlame, BananaTrophy, CaretRight } from "@/components/icons";
import { weeklyStreakLine } from "@/lib/meta-semanal";
import { WeeklyGoalTracker } from "./weekly-goal-tracker";

/** Línea principal de la tarjeta: cuántos lleva de su meta. */
export const weeklyGoalLine = (count: number, goal: number) =>
  count >= goal ? `Meta cumplida: ${count} de ${goal} ${goal === 1 ? "entreno" : "entrenos"}` : `Esta semana: ${count} de ${goal} ${goal === 1 ? "entreno" : "entrenos"}`;

export function WeekLine({ count, goal, monday, weekStreak, streak, todayDone }: {
  /** Días con entreno esta semana (lunes a hoy, en su zona horaria). */
  count: number; goal: number;
  /** Lunes de la semana local: identifica la semana en weekly_goal_done. */
  monday: string;
  /** Semanas seguidas cumpliendo la meta. */
  weekStreak: number;
  /** Racha diaria (secundaria). */
  streak: number; todayDone: boolean;
}) {
  const done = count >= goal;
  return (
    <Link href="/app/progreso" data-cta="hoy-meta-semanal" className="pressable flex items-center gap-3 rounded-[1.25rem] bg-white border border-line/70 px-4 py-3 hover:border-ink/25">
      <WeeklyGoalTracker count={count} goal={goal} monday={monday} weekStreak={weekStreak} />
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-extrabold leading-snug text-ink tabular-nums">{weeklyGoalLine(count, goal)}</span>
        <span className="mt-1.5 flex gap-1.5" role="img" aria-label={`${Math.min(count, goal)} de ${goal} entrenos de tu meta semanal`}>
          {Array.from({ length: goal }, (_, i) => (
            <span key={i} aria-hidden className={`relative inline-grid size-7 ${i < count ? "" : "opacity-30"}`}>
              <Banana weight="fill" className="col-start-1 row-start-1 size-full text-banana" />
              <Banana weight="regular" className="col-start-1 row-start-1 size-full text-ink" />
            </span>
          ))}
        </span>
        <span className="mt-1.5 flex items-center gap-1.5 text-sm font-bold text-ink tabular-nums">
          <BananaTrophy weight={done ? "fill" : "duotone"} className="size-4 shrink-0 text-banana-ink" aria-hidden />
          {weekStreak > 0 ? weeklyStreakLine(weekStreak) : `Tu meta: ${goal} ${goal === 1 ? "entreno" : "entrenos"} por semana`}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-muted tabular-nums">
          <BananaFlame weight={todayDone ? "fill" : "duotone"} className="size-3.5 shrink-0 text-ember-ink" aria-hidden />
          {streak > 0 ? `Racha diaria: ${streak} ${streak === 1 ? "día" : "días"}` : "Racha diaria: empieza hoy"}
        </span>
      </span>
      <span className="sr-only">Ver mi progreso</span>
      <CaretRight weight="bold" className="size-5 shrink-0 text-faint" aria-hidden />
    </Link>
  );
}
