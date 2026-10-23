"use client";
import { BrandIcon } from "@/components/icons";
import { ProgressBar } from "@/components/progress-bar";
import { mealStreak, nutritionBadges, weeklyBalance } from "@/lib/foods-gamify";
import { MEAL_XP, MEAL_XP_DAILY_MAX } from "@/lib/gamify";

const n0 = (n: number) => Math.round(n).toLocaleString("es-CO");
const DOW = ["L", "M", "M", "J", "V", "S", "D"];

/** Registrar es lo que cuenta: XP de comidas de hoy, racha de registro, logro Honesto y balance de la semana. */
export function NutriProgress({ today, todayKcal, hasToday, xpCount, mealDays, week, targetKcal }: {
  today: string; todayKcal: number; hasToday: boolean; xpCount: number; mealDays: string[]; week: { day: string; kcal: number }[]; targetKcal: number;
}) {
  const streak = mealStreak(hasToday ? [...mealDays, today] : mealDays, today);
  const daysLogged = new Set(hasToday ? [...mealDays, today] : mealDays).size;
  const honesto = nutritionBadges({ streak: streak.days, daysLogged }).find((b) => b.id === "honesto")!;
  const bal = weeklyBalance(todayKcal > 0 ? [...week, { day: today, kcal: todayKcal }] : week, targetKcal, today);
  const max = Math.max(1, targetKcal * 1.4, ...bal.week.map((d) => d.kcal));
  const xpLeft = MEAL_XP_DAILY_MAX - Math.min(MEAL_XP_DAILY_MAX, xpCount);

  return (
    <section className="card p-5 space-y-4" aria-labelledby="nutri-progress-t">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-56">
          <h2 id="nutri-progress-t" className="font-extrabold text-ink">Registrar es lo que cuenta</h2>
          <p className="text-sm text-muted">Fit o no, cada comida registrada suma XP y cuida tu racha.</p>
        </div>
        <span className="chip h-8 shrink-0 gap-1.5 bg-banana-soft text-banana-ink tabular-nums"><BrandIcon name="xp" className="size-4" />+{xpCount * MEAL_XP} XP hoy</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-cream p-3">
          <p className="text-xs font-bold text-muted">XP de comidas hoy</p>
          <div className="mt-2 flex gap-1.5" role="img" aria-label={`${Math.min(xpCount, MEAL_XP_DAILY_MAX)} de ${MEAL_XP_DAILY_MAX} registros con XP hoy`}>
            {Array.from({ length: MEAL_XP_DAILY_MAX }, (_, i) => <span key={i} className={`h-2.5 flex-1 rounded-full transition-colors duration-(--dur-fast) ease-out ${i < xpCount ? "bg-banana" : "bg-line"}`} />)}
          </div>
          <p className="mt-2 text-xs text-muted">{xpLeft > 0 ? `${xpLeft} ${xpLeft === 1 ? "registro más da" : "registros más dan"} +${MEAL_XP} XP cada uno.` : "Ya sumaste el XP de comidas de hoy. Registrar igual cuida tu racha y tu balance."}</p>
        </div>
        <div className="rounded-2xl bg-cream p-3">
          <p className="flex items-center justify-between gap-2 text-xs font-bold text-muted"><span className="flex items-center gap-1.5"><BrandIcon name="medal" className="size-4 text-banana-ink" />Logro Honesto</span><span className="tabular-nums">{Math.min(streak.days, 7)} de 7 días</span></p>
          <ProgressBar value={honesto.progress} className="mt-2 h-2.5" fill={honesto.got ? "bg-peel" : "bg-banana"} />
          <p className="mt-2 text-xs text-muted">{honesto.got ? `Desbloqueado: ${streak.days} días seguidos registrando.` : streak.days > 0 ? `${streak.days} ${streak.days === 1 ? "día seguido" : "días seguidos"} registrando. Aunque sea comida rápida, cuenta.` : "Registra 7 días seguidos, aunque sea comida rápida."}</p>
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-bold text-ink">Tu semana</p>
          <p className="text-xs font-semibold text-muted tabular-nums">{bal.logged ? `${bal.logged} ${bal.logged === 1 ? "día registrado" : "días registrados"}` : "Sin registros aún"}</p>
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1.5 h-20 items-end" role="img" aria-label={`Calorías por día de esta semana. Meta diaria ${n0(targetKcal)} kcal.`}>
          {bal.week.map((d, i) => {
            const h = d.kcal ? Math.max(0.06, d.kcal / max) : 0;
            const over = d.kcal > targetKcal;
            return (
              <div key={d.day} className="relative flex h-full flex-col justify-end">
                <span className="absolute inset-x-0 border-t border-dashed border-ink/25" style={{ bottom: `${(targetKcal / max) * 100}%` }} aria-hidden />
                <span className={`w-full rounded-md ${d.day === today ? "bg-ink" : over ? "bg-banana" : "bg-peel/70"}`} style={{ height: `${h * 100}%` }} />
                <span className={`mt-1 text-center text-[11px] font-bold ${d.day === today ? "text-ink" : "text-faint"}`}>{DOW[i]}</span>
              </div>
            );
          })}
        </div>
        {bal.logged > 0 && (
          <p className="mt-2 text-sm text-muted">
            {bal.diff >= 0
              ? <>Vas <b className="text-ink tabular-nums">{n0(bal.diff)} kcal</b> por debajo de tu meta de la semana. Así se baja de peso sin sufrir.</>
              : <>Vas <b className="text-ink tabular-nums">{n0(-bal.diff)} kcal</b> por encima en la semana. Un par de cenas ligeras y más pasos lo equilibran.</>}
          </p>
        )}
      </div>
    </section>
  );
}
