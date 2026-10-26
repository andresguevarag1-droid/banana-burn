// Km por semana (últimas 8): en Correr y en Progreso.
import { longDate } from "@/lib/seasons";

export function WeeklyKm({ weeks, title = "Km por semana" }: { weeks: { weekStart: string; km: number }[]; title?: string }) {
  const max = Math.max(1, ...weeks.map((w) => w.km));
  const now = weeks[weeks.length - 1];
  return (
    <section className="card p-5 space-y-3" aria-labelledby="km-sem">
      <div className="flex items-baseline justify-between gap-3"><h2 id="km-sem" className="text-xl font-extrabold text-ink">{title}</h2><p className="text-sm font-semibold text-muted tabular-nums">Esta semana: {now?.km ?? 0} km</p></div>
      <ol className="grid grid-cols-8 items-end gap-2 h-32" aria-label={title}>
        {weeks.map((w, i) => (
          <li key={w.weekStart} className="flex h-full flex-col items-center justify-end gap-1" aria-label={`Semana del ${longDate(w.weekStart)}: ${w.km} km`}>
            <span className="text-[11px] tabular-nums text-muted">{w.km ? w.km : ""}</span>
            <span className={`w-full rounded-t-md ${i === weeks.length - 1 ? "bg-[var(--run)]" : "bg-ink/80"}`} style={{ height: `${Math.max(w.km ? 6 : 2, (w.km / max) * 88)}px` }} />
            <span className="text-[11px] text-muted">{Number(w.weekStart.slice(8))}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
