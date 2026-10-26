// Hoy: cómo vas, en una sola línea que se entiende sin números raros. "Esta semana: 2 de 4 entrenos" con una barra
// corta y la racha. Los mismos cálculos que la tarjeta de semana (week-card.tsx), sin repetir el detalle de cada día.
import Link from "next/link";
import { BananaFlame, CaretRight } from "@/components/icons";

export function WeekLine({ week, sched, todayIso, streak, todayDone }: {
  week: { d: string; trained: boolean }[]; sched: Record<number, unknown>; todayIso: string; streak: number; todayDone: boolean;
}) {
  const days = week.map((w) => ({ ...w, planned: !!sched[new Date(w.d + "T12:00:00").getDay()] }));
  const planned = days.filter((d) => d.planned).length;
  const done = days.filter((d) => d.trained).length;
  const pct = planned ? Math.min(1, done / planned) : 0;
  const left = Math.max(0, planned - done);
  const pendingToday = days.some((d) => d.d === todayIso && d.planned && !d.trained);
  const line = planned === 0 ? `Esta semana llevas ${done} ${done === 1 ? "entreno" : "entrenos"}`
    : left === 0 ? (done > planned ? `Semana cumplida: ${done} entrenos` : `Semana cumplida: ${done} de ${planned} entrenos`)
    : `Esta semana: ${done} de ${planned} entrenos`;
  return (
    <Link href="/app/progreso" className="pressable flex items-center gap-3 rounded-[1.25rem] bg-white border border-line/70 px-4 py-3 hover:border-ink/25">
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-extrabold leading-snug text-ink tabular-nums">{line}</span>
        <span aria-hidden className="mt-1.5 block h-2 overflow-hidden rounded-full bg-cream"><span className="block h-full rounded-full bg-ink" style={{ width: `${Math.max(pct, 0.04) * 100}%` }} /></span>
        <span className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-muted tabular-nums">
          <BananaFlame weight={todayDone ? "fill" : "duotone"} className="size-4 shrink-0 text-ember-ink" aria-hidden />
          {streak > 0 ? `Racha de ${streak} ${streak === 1 ? "día" : "días"}${todayDone ? "" : pendingToday ? ". Entrena hoy para cuidarla" : ". Registra algo hoy para cuidarla"}` : "Empieza tu racha hoy"}
        </span>
      </span>
      <span className="sr-only">Ver mi progreso</span>
      <CaretRight weight="bold" className="size-5 shrink-0 text-faint" aria-hidden />
    </Link>
  );
}
