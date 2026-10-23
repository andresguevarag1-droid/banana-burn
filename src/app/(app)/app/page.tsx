import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BananaFlame, BananaTrophy, BrandIcon, CaretRight, CheckCircle, Monkey, PersonSimpleWalk, Scales, TreePalm } from "@/components/icons";
import { getViewer } from "@/lib/supabase/server";
import { dashboard, getAthlete } from "@/lib/athlete";
import { getDaily, greetingAt } from "@/lib/daily";
import { getMeals, sumMeals } from "@/lib/meals";
import { getEntitlements } from "@/lib/entitlements";
import { hoyTip } from "@/lib/plan-access";
import { DAY_NAMES, hookLine, isTrainingDay } from "@/lib/engine";
import { getVoice } from "@/lib/voice-server";
import { sessionLine, setsReps, setsLegend, whyItMatters } from "@/lib/voice";
import { ProgramHero } from "@/components/programas/program-hero";
import { ProgramHabits } from "@/components/programas/program-habits";
import { getProgramChecks } from "@/lib/programs-server";
import { habitsToday } from "@/lib/programs";
import { TodayPanel } from "@/components/hoy/today-panel";
import { WeekCard } from "@/components/hoy/week-card";
import { WeighIn } from "@/components/weigh-in";
import { Readiness } from "@/components/readiness";
import { ExpressCard } from "@/components/express-chips";
import { NotificationBell } from "@/components/notifications/bell";
import { EnablePush } from "@/components/notifications/enable-push";
import { AnnouncementBanner } from "@/components/admin/announcement-banner";
import { Glp1Card } from "@/components/glp1-card";
import { ChallengeCard } from "@/components/challenge-card";
import { getMyChallenges } from "@/lib/challenges-server";
import { getXpSummary } from "@/lib/xp-server";
import { toView } from "@/lib/challenge-view";
import { TesterCard } from "@/components/testers/tester-card";
import { getMyTester } from "@/lib/testers-server";

export const metadata = { title: "Hoy" };

const nf = (n: number, d = 1) => n.toLocaleString("es-419", { minimumFractionDigits: d, maximumFractionDigits: d });

export default async function Hoy({ searchParams }: { searchParams: Promise<{ tester?: string }> }) {
  const v = (await getViewer())!;
  // Demo: ?tester=demo (recién asignado), activo, pronto o fin muestran la experiencia de tester de ejemplo.
  const demoTester = v.demo ? (await searchParams).tester ?? null : null;
  // Lo independiente va en paralelo; solo el registro del día espera al atleta y los retos esperan al registro.
  const [a, meals, ent, xs, tester, voice] = await Promise.all([getAthlete(v), getMeals(v), getEntitlements(v), getXpSummary(v), getMyTester(v, demoTester).catch(() => null), getVoice(v)]);
  const d = dashboard(a);
  const g = await getDaily(v, a.startWeight, a.currentWeight);
  const eaten = sumMeals(meals.today);
  const px = d.program?.meta.experience ?? null;
  const [ch, checks] = await Promise.all([
    getMyChallenges(v, { workout: g.trainedToday, steps: g.log.steps, water: g.log.water, protein: g.log.protein + eaten.protein, proteinGoal: d.t.protein }),
    px ? getProgramChecks(v, d.today.iso) : Promise.resolve([] as string[]),
  ]);
  // Programa con experiencia (0027): sus hábitos del día y una línea de comida que cambia cada día.
  const habits = px && d.program ? habitsToday(px, { ...g.log, protein: g.log.protein + eaten.protein }, { checks, proteinTarget: ent.nutrition ? d.t.protein : null, trainedToday: g.trainedToday || d.program.run.today === "hecho", sessionDay: d.program.run.today === "entreno" }) : null;
  const food = px?.food.length ? px.food[d.program!.run.effectiveDay % px.food.length] : null;
  const { plan, t } = d;
  const training = isTrainingDay(plan);
  const dateLabel = d.today.date.toLocaleDateString("es-419", { weekday: "long", day: "numeric", month: "long" });
  const mins = plan.mins ?? (training ? 55 : 0);
  const kgLost = a.startWeight - a.currentWeight;
  const hook = hookLine(plan.hook, training ? mins : null);
  const legend = setsLegend(voice);

  return (
    <div className="space-y-5 animate-enter">
      {/* Encabezado + motivación */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-muted first-letter:uppercase">{dateLabel}</p>
          <h1 className="text-[28px] sm:text-4xl font-extrabold tracking-tight text-ink leading-tight">{greetingAt(v.tz)}{a.name.trim() ? `, ${a.name.trim().split(/\s+/)[0]}` : ""}</h1>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <NotificationBell className="lg:hidden" />
          <Link href="/app/progreso#logros" className={`pressable flex items-center gap-1.5 h-12 rounded-2xl border px-3 ${g.streak.todayDone ? "bg-banana border-banana hover:brightness-95" : "bg-white border-line hover:border-ink/25"}`} aria-label={`Racha de ${g.streak.days} días${g.streak.todayDone ? "" : ", aún sin registrar hoy"}`}>
            <BananaFlame weight={g.streak.todayDone ? "fill" : "duotone"} className={`size-6 ${g.streak.todayDone ? "text-ink" : "text-banana-ink"}`} />
            <span className="text-lg font-extrabold text-ink tabular-nums leading-none">{g.streak.days}</span>
          </Link>
          <Link href="/app/perfil" className="pressable lg:hidden grid place-items-center size-12 rounded-2xl bg-banana text-lg font-extrabold text-ink hover:brightness-95" aria-label="Mi perfil">{a.name[0]?.toUpperCase()}</Link>
        </div>
      </header>

      <AnnouncementBanner />
      <EnablePush hideWhenSnoozed />
      {tester && tester.phase !== "ninguno" && <TesterCard phase={tester.phase} until={tester.until} daysLeft={tester.daysLeft} used={tester.used} tz={v.tz} />}


      {/* Números de hoy: calorías y macros (solo con nutrición; en Entreno, la invitación a sumarla), más agua, pasos y sueño */}
      <div className="grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        <TodayPanel initial={g.log} nutrition={ent.nutrition ? { base: eaten, target: { kcal: t.kcal, protein: t.protein, carbs: t.carbs, fat: t.fat }, mode: d.mode } : null} habits={{ steps: t.steps, sleep: t.sleep, water: d.glp1 ? Math.round(d.glp1.waterL * 4) : 8 }} dateKey={d.today.iso} demo={v.demo} />
        {/* Rutina de hoy: con un programa activo, su héroe la reemplaza */}
        {d.program ? <ProgramHero p={d.program} trainedToday={g.trainedToday} energy={g.log.energy ?? 0} dateKey={d.today.iso} demo={v.demo} mins={mins} /> : <section className={`relative overflow-hidden rounded-[1.75rem] p-5 sm:p-6 ${g.trainedToday ? "bg-banana-soft border border-banana" : training ? "bg-banana" : "card"}`}>
          {training && !g.trainedToday && <BrandIcon name={plan.icon} aria-hidden className="absolute -right-8 -top-8 size-44 text-ink opacity-[.09] rotate-12 select-none pointer-events-none" />}
          <div className="relative flex items-center gap-3.5">
            <span className={`grid place-items-center size-14 sm:size-16 shrink-0 rounded-2xl ${g.trainedToday ? "bg-ink text-banana" : training ? "bg-ink text-banana shadow-lift" : "bg-banana-soft text-banana-ink"}`}>
              {g.trainedToday ? <CheckCircle weight="duotone" className="size-8 sm:size-9" /> : <BrandIcon name={plan.icon} className="size-8 sm:size-9" />}
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-semibold text-ink/75">
                <span>Hoy {DAY_NAMES[d.today.dow]}, {/^(fuerza|volumen)$/i.test(plan.tag) ? `día de ${plan.tag.toLowerCase()}` : plan.tag.toLowerCase()}</span>
                {d.deload && <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold text-ink"><TreePalm weight="duotone" className="size-3.5" />Semana de descarga</span>}
              </p>
              <h2 className="mt-1 text-[28px] sm:text-[32px] leading-[1.05] font-extrabold tracking-tight text-ink text-balance">{plan.name}</h2>
            </div>
          </div>
          {/* Coach Banana presenta el día: una línea que da ganas de entrenar */}
          {hook && !g.trainedToday && (
            <div className="relative mt-4 flex items-center gap-3 rounded-2xl bg-ink p-3 pr-4 text-white shadow-lift">
              <span aria-hidden className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-banana">
                <Image src="/brand/mascota-sola.webp" alt="" fill sizes="128px" className="object-cover origin-[52%_4%] scale-[2.5]" />
              </span>
              <p className="min-w-0"><span className="block text-[11px] font-extrabold uppercase tracking-[.12em] text-banana">Coach Banana</span><span className="block text-[15px] font-bold leading-snug text-pretty">{hook}</span></p>
            </div>
          )}
          {training ? (
            <>
              {!g.trainedToday && <p className="relative mt-3 rounded-2xl bg-white/60 px-3 py-2 text-sm text-ink"><b>Por qué importa:</b> {whyItMatters(voice)[0].toLowerCase()}{whyItMatters(voice).slice(1)}</p>}
              <p className="relative mt-2 text-sm font-semibold text-ink/70 tabular-nums">{sessionLine(voice, { exercises: plan.exercises.length, mins, cardio: !!plan.cardio })}</p>
              <ul className="relative mt-4 flex flex-wrap gap-1.5">
                {plan.exercises.map((e) => <li key={e.id} className="chip min-h-8 h-auto py-1 bg-white/70 text-ink text-[13px]">{e.name} <span className="text-ink/70 tabular-nums">{setsReps(voice, e.cfg.sets, e.cfg.lo, e.cfg.hi, e.cfg.unit)}</span></li>)}
              </ul>
              {legend && !g.trainedToday && <p className="relative mt-2 text-xs font-semibold text-ink/70">{legend}</p>}
              {g.trainedToday ? (
                <p className="relative mt-5 flex items-center gap-2 font-extrabold text-ink"><CheckCircle weight="fill" className="size-5 shrink-0" />Entreno de hoy completado. Descansa y come bien.</p>
              ) : (
                <div className="relative mt-5"><Readiness voice={voice} suggestSoft={d.glp1?.phase === "inyeccion" || d.glp1?.phase === "post"} initial={g.log.energy ?? 0} dateKey={d.today.iso} demo={v.demo} mins={mins} /></div>
              )}
            </>
          ) : (
            <p className="relative mt-4 flex items-start gap-2 text-ink/80"><PersonSimpleWalk weight="duotone" className="size-5 shrink-0 mt-0.5 text-banana-ink" /><span>{plan.cardio}. Tu músculo crece hoy.</span></p>
          )}
          <div className="relative mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-semibold text-ink/75">
            <span className="inline-flex items-center gap-1.5">Ayer <BrandIcon name={d.yesterday.icon} className="size-4" /> {d.yesterday.name}</span>
            <span className="inline-flex items-center gap-1.5">Mañana <BrandIcon name={d.tomorrow.icon} className="size-4" /> {d.tomorrow.name}</span>
          </div>
        </section>}

      </div>
      {!g.trainedToday && <ExpressCard program={!!d.program} compact />}
      {px && habits && d.program && <ProgramHabits mode={px.mode} icon={d.program.icon} habits={habits} food={food} nutrition={ent.nutrition} />}
      {!g.streak.todayDone && g.streak.days > 0 && <p className="-mt-2 flex items-center gap-1.5 px-1 text-xs font-semibold text-ember-ink"><BananaFlame className="size-4 shrink-0" />Entrena o registra algo hoy para mantener tu racha de {g.streak.days} días.</p>}


      {/* Semana y retos */}
      <div className="grid items-start gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        <WeekCard s={xs} week={g.week} sched={d.sched} todayIso={d.today.iso} training={training} weighed={g.weighedToday} streak={g.streak.days} nutrition={ent.nutrition} />
        <section>
          <div className="flex items-baseline justify-between mb-3"><h3 className="text-lg font-extrabold text-ink">Tus retos</h3><Link href="/app/retos" className="tap inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">{ch.active.length ? "Tienda de retos" : "Explorar retos"} <ArrowRight weight="bold" className="size-3.5" /></Link></div>
          {ch.active.length ? (
            <div className="grid gap-3">{ch.active.slice(0, 2).map((m) => <ChallengeCard key={m.ucId} v={toView(m)} compact />)}</div>
          ) : (
            <Link href="/app/retos" className="card p-4 flex items-center gap-3"><span className="grid place-items-center size-12 shrink-0 rounded-xl bg-banana-soft text-banana-ink"><BananaTrophy className="size-7" /></span><span className="flex-1"><span className="block font-extrabold text-ink">Elige tu próximo reto</span><span className="block text-sm text-muted">Retos gratis y Premium de 7 a 42 días, con plan diario, hitos y medalla al final.</span></span><CaretRight weight="bold" className="size-5 text-faint" /></Link>
          )}
        </section>

      </div>

      <div className="grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        {/* Peso y meta */}
        <section className="card p-5 flex flex-col" aria-label="Peso y meta">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 font-bold text-ink"><span className="grid place-items-center size-8 rounded-lg bg-banana-soft text-banana-ink"><Scales weight="duotone" className="size-5" /></span>{g.weighedToday ? "Peso de hoy" : "¿Ya te pesaste?"}</p>
            <Link href="/app/progreso" className="tap inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink">Ver curva <ArrowRight weight="bold" className="size-3.5" /></Link>
          </div>
          <p className="mt-1 text-xs text-muted">Al despertar, después del baño, antes de comer.</p>
          <div className="mt-3"><WeighIn last={a.currentWeight} /></div>
          <div className="mt-4 pt-4 border-t border-line grid grid-cols-3 text-center">
            <div><p className="text-lg font-extrabold tabular-nums text-ink">{kgLost >= 0.05 ? `−${nf(kgLost)}` : kgLost <= -0.05 ? `+${nf(-kgLost)}` : nf(0)}</p><p className="text-[11px] font-semibold text-muted">{kgLost <= -0.05 ? "kg desde el inicio" : "kg perdidos"}</p></div>
            <div><p className="text-lg font-extrabold text-ink tabular-nums">{nf(d.toGo)}</p><p className="text-[11px] font-semibold text-muted">kg a la meta</p></div>
            <div><p className="text-lg font-extrabold text-ink tabular-nums">{d.goalPassed ? "0" : d.daysLeft}</p><p className="text-[11px] font-semibold text-muted">{d.goalPassed ? "fecha meta vencida" : d.daysLeft === 1 ? "día" : "días"}</p></div>
          </div>
        </section>
      {/* Coach */}
        <Link href="/app/coach" className="card p-4 flex gap-3 items-center self-start">
        <span className="grid place-items-center size-12 shrink-0 rounded-2xl bg-ink text-banana"><Monkey className="size-7" /></span>
        <div className="flex-1 min-w-0"><p className="text-xs font-bold text-muted">Coach Banana</p><p className="text-[15px] text-ink leading-snug">{hoyTip({ dow: d.today.dow, training, proteinLeft: t.protein - g.log.protein - eaten.protein, trained: g.trainedToday, nutrition: ent.nutrition })}</p></div>
        <CaretRight weight="bold" className="size-5 text-faint shrink-0" />
      </Link>
      </div>

      {d.glp1 && <Glp1Card g={d.glp1} nausea0={g.log.nausea ?? 0} demo={v.demo} />}

    </div>
  );
}
