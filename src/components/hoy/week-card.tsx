// "Tu semana" en Hoy (#316): una sola tarjeta con la meta semanal de #288 (bananas y racha semanal), los días de lunes a
// domingo y el nivel con su XP (secundario, pero visible). La meta es una sola: los días con rutina del programa se muestran
// como "plan", nunca como otra meta. La racha diaria va solo en el saludo.
import Link from "next/link";
import { ArrowRight, Barbell, CaretRight, Check } from "@/components/icons";
import { rich } from "@/lib/i18n/rich";
import { ProgressBar } from "@/components/progress-bar";
import { LevelBadge } from "@/components/levels/level-badge";
import { quickAction } from "@/components/levels/level-card";
import type { XpSummary } from "@/lib/xp-server";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";
import { tr } from "@/lib/i18n/t";
import { WeekLine, type WeekGoal } from "./week-line";

const DOW1 = ["D", "L", "M", "M", "J", "V", "S"];
const DOW1_EN = ["S", "M", "T", "W", "T", "F", "S"];
const n = (x: number) => x.toLocaleString("es-419");

/** Lo que falta para la meta de la semana y, si su programa trae otra cantidad de días, cuántos tiene el plan. */
export function weekGoalNote(count: number, goal: number, planned: number, locale: Locale = DEFAULT_LOCALE) {
  const tx = tr(locale);
  const left = goal - count;
  const main = left <= 0 ? tx("Meta de la semana cumplida. Así se ven los resultados.") : tx(left === 1 ? "Te falta 1 entreno para tu meta de la semana." : "Te faltan {n} entrenos para tu meta de la semana.", { n: left });
  return planned > 0 && planned !== goal ? `${main} ${tx(planned === 1 ? "Tu plan trae {n} día con rutina." : "Tu plan trae {n} días con rutina.", { n: planned })}` : main;
}

export function WeekCard({ s, goal, week, sched, todayIso, training, weighed, nutrition, locale = DEFAULT_LOCALE }: {
  s: XpSummary;
  /** La meta semanal de #288: la única que se muestra como meta. */
  goal: WeekGoal;
  week: { d: string; active: boolean; trained?: boolean }[];
  /** Plan por día de la semana (0 = domingo): con rutina o descanso. */
  sched: Record<number, unknown>;
  todayIso: string; training: boolean; weighed: boolean;
  /** Con nutrición puede sugerir registrar comida; en Entreno no. */
  nutrition: boolean;
  locale?: Locale;
}) {
  const tx = tr(locale);
  const dow1 = locale === DEFAULT_LOCALE ? DOW1 : DOW1_EN;
  const days = week.map((w) => {
    const dow = new Date(w.d + "T12:00:00").getDay();
    const planned = !!sched[dow];
    return { ...w, dow, planned, past: w.d < todayIso, today: w.d === todayIso };
  });
  const planned = days.filter((d) => d.planned).length;
  const qa = quickAction(s, { training, weighed, nutrition });

  return (
    <section className="card p-4 sm:p-5" aria-labelledby="semana-t">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="semana-t" className="text-lg font-extrabold text-ink">{tx("Tu semana")}</h2>
        <Link href="/app/entrenar" className="tap inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">{tx("Ver plan")} <ArrowRight weight="bold" className="size-3.5" /></Link>
      </div>

      <WeekLine {...goal} locale={locale} />

      <ol className="mt-2 grid grid-cols-7 gap-1" aria-label={tx("Entrenos de esta semana")}>
        {days.map((d) => {
          const state = tx(d.trained ? "hecho" : !d.planned ? "descanso" : d.past ? "pendiente" : d.today ? "hoy" : "por venir");
          const box = d.trained ? "bg-ink text-banana" : !d.planned ? "bg-cream text-faint" : d.past ? "border-2 border-line bg-white text-muted" : d.today ? "border-2 border-ink bg-banana text-ink" : "border-2 border-dashed border-banana-ink/40 bg-white text-banana-ink";
          return (
            <li key={d.d} className="flex flex-col items-center gap-1">
              <span className={`text-[11px] font-bold ${d.today ? "text-ink" : "text-muted"}`}>{dow1[d.dow]}</span>
              <span className={`grid size-9 place-items-center rounded-xl ${box}`} title={state}>
                {d.trained ? <Check weight="bold" className="size-4" /> : d.planned ? <Barbell weight="duotone" className="size-4" /> : <span className="text-[11px] font-bold">-</span>}
              </span>
              <span className="sr-only">{state}</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-xs text-muted">{weekGoalNote(goal.count, goal.goal, planned, locale)}</p>

      <div className="mt-4 border-t border-line pt-4">
        <div className="flex items-center gap-3">
          <Link href="/app/niveles" className="tap pressable shrink-0 rounded-xl" aria-label={tx("Ver mis niveles")}><LevelBadge idx={s.level.idx} size="sm" /></Link>
          <div className="min-w-0 flex-1">
            <p className="flex items-baseline justify-between gap-2 text-sm"><span className="truncate font-extrabold text-ink">{tx("Nivel {idx}: {name}", { idx: s.level.idx, name: tx(s.level.n) })}</span><span className="shrink-0 text-xs font-bold tabular-nums text-muted">{tx("+{xp} XP hoy", { xp: n(s.today.xp) })}</span></p>
            <ProgressBar value={s.level.progress} min={0.04} className="mt-1.5 h-2" fill="bg-banana" track="bg-banana-soft" label={`${n(s.total)} XP`} />
            <p className="mt-1 text-xs text-muted">{s.next ? rich(tx("Te faltan {xp} para {name}"), { xp: <b className="tabular-nums text-ink">{n(s.next.xpLeft)} XP</b>, name: tx(s.next.name) }) : tx("Nivel máximo alcanzado")}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="chip h-8 bg-cream text-xs text-muted tabular-nums">{tx("{xp} XP esta semana", { xp: n(s.week.xp) })}</span>
          {qa && (
            <Link href={qa.href} className="pressable ml-auto inline-flex h-11 items-center gap-2 rounded-full bg-ink pl-3.5 pr-3 text-sm font-bold text-white hover:bg-black">
              <qa.icon weight="duotone" className="size-4 text-banana" />{tx(qa.label)}<span className="tabular-nums text-banana">{tx(qa.xp)}</span><CaretRight weight="bold" className="size-3.5" />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
