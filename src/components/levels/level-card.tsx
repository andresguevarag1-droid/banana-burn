// Tarjeta de nivel de Hoy: nombre, XP que falta, lo ganado hoy, la racha multiplicadora y una acción rápida para sumar XP.
import Link from "next/link";
import { ArrowRight, BananaFlame, Barbell, BowlFood, CaretRight, Check, Scales } from "@/components/icons";
import { ProgressBar } from "@/components/progress-bar";
import { MEAL_XP, MEAL_XP_DAILY_MAX, SET_XP, WEIGH_XP } from "@/lib/gamify";
import type { XpSummary } from "@/lib/xp-server";
import { LevelBadge } from "./level-badge";

const DOW1 = ["D", "L", "M", "M", "J", "V", "S"];
const n = (x: number) => x.toLocaleString("es-419");
const mult = (m: number) => `x${m.toLocaleString("es-419", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;

export function quickAction(s: XpSummary, opts: { training: boolean; weighed: boolean }) {
  if (opts.training && !s.sources.workout) return { href: "/app/entreno", label: "Entrenar", xp: `+${SET_XP} XP por serie`, icon: Barbell };
  if (s.sources.meals < MEAL_XP_DAILY_MAX) return { href: "/app/nutricion", label: "Registrar comida", xp: `+${MEAL_XP} XP`, icon: BowlFood };
  if (!opts.weighed && !s.sources.weigh) return { href: "/app/progreso", label: "Pesarte", xp: `+${WEIGH_XP} XP`, icon: Scales };
  return null;
}

export function LevelCard({ s, week, todayIso, training, weighed }: { s: XpSummary; week: { d: string; active: boolean }[]; todayIso: string; training: boolean; weighed: boolean }) {
  const qa = quickAction(s, { training, weighed });
  return (
    <section className="card p-4 sm:p-5" aria-labelledby="nivel-t">
      <div className="flex items-center gap-3">
        <Link href="/app/niveles" className="pressable shrink-0 rounded-2xl" aria-label="Ver mis niveles"><LevelBadge idx={s.level.idx} /></Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-muted">Nivel {s.level.idx}</p>
          <h2 id="nivel-t" className="truncate text-lg font-extrabold leading-tight text-ink">{s.level.n}</h2>
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-lg font-extrabold leading-none tabular-nums ${s.today.xp > 0 ? "text-peel" : "text-ink"}`}>+{n(s.today.xp)}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-muted">XP hoy</p>
        </div>
      </div>

      <ProgressBar value={s.level.progress} min={0.04} className="mt-3 h-2.5" fill="bg-ember" label={`${n(s.total)} XP`} />
      <p className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
        {s.next ? <span className="font-semibold text-ink">Te faltan <b className="tabular-nums">{n(s.next.xpLeft)} XP</b> para {s.next.name}</span> : <span className="font-semibold text-ink">Nivel máximo alcanzado</span>}
        <span className="text-xs font-semibold text-muted tabular-nums">{n(s.total)} XP</span>
      </p>
      {s.next && <p className="mt-0.5 text-xs text-muted">Desbloqueas: {s.next.perk.text.charAt(0).toLowerCase() + s.next.perk.text.slice(1)}.</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {s.multiplier > 1 ? (
          <span className="chip h-8 bg-ember/10 text-ember-ink text-xs"><BananaFlame className="size-4" />Racha {mult(s.multiplier)}{s.bonusDue > 0 ? `: +${n(s.bonusDue)} XP hoy` : ""}</span>
        ) : s.nextTier ? (
          <span className="chip h-8 bg-cream text-muted text-xs"><BananaFlame className="size-4" />{s.nextTier.left === 1 ? "1 día más" : `${s.nextTier.left} días más`} de racha: {mult(s.nextTier.mult)} XP</span>
        ) : null}
        {qa && (
          <Link href={qa.href} className="pressable ml-auto inline-flex h-11 items-center gap-2 rounded-full bg-ink pl-3.5 pr-3 text-sm font-bold text-white hover:bg-black">
            <qa.icon weight="duotone" className="size-4 text-banana" />{qa.label}<span className="text-banana tabular-nums">{qa.xp}</span><CaretRight weight="bold" className="size-3.5" />
          </Link>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
        <ol className="flex gap-1" aria-label="Actividad de esta semana">
          {week.map((w) => {
            const dw = new Date(w.d + "T12:00:00").getDay();
            const isToday = w.d === todayIso;
            return (
              <li key={w.d} className={`grid size-7 place-items-center rounded-full text-[11px] font-bold ${w.active ? "bg-ember text-ink" : isToday ? "border-2 border-dashed border-ember text-ember" : "bg-cream text-faint"}`}>
                {w.active ? <Check weight="bold" className="size-3.5" aria-hidden /> : DOW1[dw]}<span className="sr-only">{DOW1[dw]} {w.active ? "activo" : "sin actividad"}</span>
              </li>
            );
          })}
        </ol>
        <Link href="/app/niveles" className="tap inline-flex shrink-0 items-center gap-1 text-sm font-bold text-muted hover:text-ink">Niveles <ArrowRight weight="bold" className="size-3.5" /></Link>
      </div>
    </section>
  );
}
