// Entreno de hoy en Hoy (sin programa activo): nombre que da ganas, qué hace por ti en tu registro, Coach Banana,
// minutos y series reales, lo que hiciste la última vez, los ejercicios con imagen, el check-in de energía y el
// botón para empezar. Servidor; solo el check-in y las imágenes con respaldo son de cliente.
import Image from "next/image";
import { BananaFlame, BrandIcon, CheckCircle, PersonSimpleWalk, Timer, TreePalm, TrendUp, Barbell } from "@/components/icons";
import { SafeImage } from "@/components/safe-image";
import { Readiness } from "@/components/readiness";
import { ExerciseTiles } from "@/components/hoy/exercise-tiles";
import { hookLine, isTrainingDay, type PlannedDay } from "@/lib/engine";
import { poseForTag } from "@/lib/coach-poses";
import { dayTag, sessionBenefit, setsLegend, t, type Voice } from "@/lib/voice";

type Mini = Pick<PlannedDay, "name" | "icon" | "tpl" | "key">;

export function WorkoutHero({ plan, voice, mins, trainedToday, deload, dayName, yesterday, tomorrow, lastTime, readiness, first = false }: {
  plan: PlannedDay; voice: Voice; mins: number; trainedToday: boolean; deload: boolean; dayName: string; yesterday: Mini; tomorrow: Mini;
  /** Nunca ha entrenado: el entreno se presenta como "Tu primer entreno" (en un día de descanso, la próxima sesión adelantada). */
  first?: boolean;
  /** "La última vez hiciste..." con números reales del historial, o null. */
  lastTime: string | null;
  readiness: { initial: number; dateKey: string; demo: boolean; suggestSoft: boolean; she?: boolean };
}) {
  const training = isTrainingDay(plan);
  const sets = plan.exercises.reduce((a, e) => a + e.cfg.sets, 0);
  const benefit = sessionBenefit(voice, plan.tpl);
  const hook = hookLine(plan.hook, null);
  const legend = setsLegend(voice);
  const tomorrowTraining = isTrainingDay(tomorrow);

  if (!training) {
    return (
      <section aria-labelledby="hoy-entreno" className="card relative overflow-hidden p-5 sm:p-6">
        <div className="flex items-center gap-3.5">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-banana-soft text-banana-ink"><TreePalm weight="duotone" className="size-8" /></span>
          <div className="min-w-0"><p className="text-sm font-semibold text-muted first-letter:uppercase">Hoy {dayName}</p><h2 id="hoy-entreno" className="text-[26px] font-extrabold leading-tight tracking-tight text-ink">{plan.name}</h2></div>
        </div>
        <p className="mt-3 flex items-start gap-2 text-body"><PersonSimpleWalk weight="duotone" className="mt-0.5 size-5 shrink-0 text-banana-ink" /><span>{plan.cardio}. {t(voice, { basico: "Hoy tu músculo se recupera y crece: descansar también es parte del plan.", intermedio: "Tu músculo crece hoy.", tecnico: "Recuperación activa: el músculo se adapta en el descanso." })}</span></p>
        {tomorrowTraining && <p className="mt-3 rounded-2xl bg-cream px-3 py-2.5 text-sm text-ink"><b>Mañana te espera:</b> {tomorrow.name}</p>}
      </section>
    );
  }

  return (
    <section aria-labelledby="hoy-entreno" className={`relative overflow-hidden rounded-[1.75rem] p-5 sm:p-6 ${trainedToday ? "border border-banana bg-banana-soft" : "bg-banana"}`}>
      <div className="relative lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-7">
        <div className="min-w-0">
          {/* Encabezado: Coach Banana posa según el día */}
          <div className="relative pr-28 sm:pr-36">
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-bold text-ink/80">
              <span className="first-letter:uppercase">{first && !trainedToday ? `Tu primer entreno, ${dayTag(voice, plan.tag)}` : `Hoy ${dayName}, ${dayTag(voice, plan.tag)}`}</span>
              {deload && <span className="inline-flex items-center gap-1 rounded-full bg-white/75 px-2 py-0.5 text-xs font-bold text-ink"><TreePalm weight="duotone" className="size-3.5" />{t(voice, { basico: "Semana suave", intermedio: "Semana de descarga", tecnico: "Descarga" })}</span>}
            </p>
            <h2 id="hoy-entreno" className="mt-1 text-[30px] font-extrabold leading-[1.02] tracking-tight text-ink text-balance sm:text-[36px]">{plan.name}</h2>
            <span aria-hidden className="pointer-events-none absolute -right-3 -top-4 block size-32 select-none sm:size-40">
              <SafeImage src={poseForTag(plan.tag)} alt="" fill sizes="160px" priority className="object-contain drop-shadow-[0_8px_14px_rgb(27_21_5/.25)]" fallbackClassName="object-contain" />
            </span>
            {benefit && !trainedToday && <p className="relative mt-3 -mr-28 sm:mr-0 max-w-[52ch] text-[15px] font-semibold leading-snug text-ink text-pretty">{benefit}</p>}
          </div>

          {/* Números reales del día */}
          <ul className="relative mt-4 grid grid-cols-3 gap-2" aria-label="Resumen del entreno">
            {[
              { I: Timer, big: `${mins}`, small: t(voice, { basico: "minutos", intermedio: "min", tecnico: "min aprox." }) },
              { I: Barbell, big: `${plan.exercises.length}`, small: "ejercicios" },
              { I: BananaFlame, big: `${sets}`, small: t(voice, { basico: "series (tandas)", intermedio: "series", tecnico: "series totales" }) },
            ].map(({ I, big, small }) => (
              <li key={small} className="flex flex-col items-start rounded-2xl bg-white/70 px-3 py-2.5">
                <I weight="duotone" className="size-5 text-ink/80" aria-hidden />
                <span className="mt-1 text-2xl font-extrabold leading-none text-ink tabular-nums">{big}</span>
                <span className="mt-0.5 text-xs font-semibold text-ink/75">{small}</span>
              </li>
            ))}
          </ul>

          {/* Lo más importante, arriba: empezar (o que ya está hecho). */}
          {trainedToday ? (
            <p className="relative mt-4 flex items-center gap-2 font-extrabold text-ink"><CheckCircle weight="fill" className="size-5 shrink-0 text-peel" />{t(voice, { basico: "Entreno de hoy listo. Ahora descansa y come bien: así crece el músculo.", intermedio: "Entreno de hoy completado. Descansa y come bien.", tecnico: "Sesión completada. Prioriza proteína y sueño para la recuperación." })}</p>
          ) : (
            <div className="relative mt-4"><Readiness first={first} voice={voice} she={readiness.she} suggestSoft={readiness.suggestSoft} initial={readiness.initial} dateKey={readiness.dateKey} demo={readiness.demo} mins={mins} /></div>
          )}

          {/* Coach Banana: el gancho y lo que hiciste la última vez */}
          {!trainedToday && (hook || lastTime) && (
            <div className="relative mt-4 flex items-start gap-3 rounded-2xl bg-ink p-3 pr-4 text-white shadow-lift">
              <span aria-hidden className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-banana">
                <Image src="/brand/mascota-sola.webp" alt="" fill sizes="128px" className="origin-[52%_4%] scale-[2.5] object-cover" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-extrabold uppercase tracking-[.12em] text-banana">Coach Banana</p>
                {hook && <p className="text-[15px] font-bold leading-snug text-pretty">{hook}</p>}
                {lastTime && <p className="mt-1.5 flex items-start gap-1.5 text-sm font-semibold leading-snug text-banana"><TrendUp weight="bold" className="mt-0.5 size-4 shrink-0" aria-hidden />{lastTime}</p>}
              </div>
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="mt-5 flex items-baseline justify-between gap-2 lg:mt-0">
            <h3 className="text-base font-extrabold text-ink">{t(voice, { basico: "Lo que vas a hacer", intermedio: "Tus ejercicios de hoy", tecnico: "Sesión" })}</h3>
            <span className="text-xs font-semibold text-ink/70 lg:hidden">{t(voice, { basico: "Desliza para ver todos", intermedio: "Desliza", tecnico: "Desliza" })}</span>
          </div>
          <div className="mt-2"><ExerciseTiles exercises={plan.exercises} voice={voice} /></div>
          {legend && !trainedToday && <p className="mt-2 text-xs font-semibold text-ink/75">{legend}</p>}
          {plan.cardio && <p className="mt-2 flex items-start gap-1.5 text-sm font-semibold text-ink/80"><PersonSimpleWalk weight="duotone" className="mt-0.5 size-4 shrink-0" aria-hidden />{t(voice, { basico: "Y al final: ", intermedio: "Al final: ", tecnico: "Cierre: " })}{plan.cardio}</p>}
        </div>
      </div>


      {/* Ayer y mañana, en palabras */}
      <div className="relative mt-4 grid gap-2 sm:grid-cols-2">
        <p className="flex items-center gap-2 rounded-2xl bg-white/55 px-3 py-2 text-sm text-ink"><BrandIcon name={yesterday.icon} className="size-5 shrink-0 text-ink/80" aria-hidden /><span className="min-w-0"><span className="block text-xs font-bold text-ink/70">{isTrainingDay(yesterday) ? "Ayer tocó" : "Ayer"}</span><span className="block truncate font-bold">{yesterday.name}</span></span></p>
        <p className="flex items-center gap-2 rounded-2xl bg-white/55 px-3 py-2 text-sm text-ink"><BrandIcon name={tomorrow.icon} className="size-5 shrink-0 text-ink/80" aria-hidden /><span className="min-w-0"><span className="block text-xs font-bold text-ink/70">{tomorrowTraining ? "Mañana te espera" : "Mañana descansas"}</span><span className="block truncate font-bold">{tomorrow.name}</span></span></p>
      </div>
    </section>
  );
}
