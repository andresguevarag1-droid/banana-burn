import Link from "next/link";
import { ArrowRight, BananaFlame, BananaTrophy, CaretRight, Monkey, Scales } from "@/components/icons";
import { getViewer } from "@/lib/supabase/server";
import { dashboard, getAthlete } from "@/lib/athlete";
import { getDaily, greetingAt } from "@/lib/daily";
import { getMeals, sumMeals } from "@/lib/meals";
import { getEntitlements } from "@/lib/entitlements";
import { hoyTip } from "@/lib/plan-access";
import { DAY_NAMES, EX, isTrainingDay, prescribe, type SlotCfg } from "@/lib/engine";
import { getHistory } from "@/lib/history";
import { WorkoutHero } from "@/components/hoy/workout-hero";
import type { Viewer } from "@/lib/supabase/server";
import { getVoice } from "@/lib/voice-server";
import { lastTimeLine, type Voice } from "@/lib/voice";
import { ProgramHero } from "@/components/programas/program-hero";
import { ProgramHabits } from "@/components/programas/program-habits";
import { getProgramChecks } from "@/lib/programs-server";
import { habitsToday } from "@/lib/programs";
import { TodayPanel } from "@/components/hoy/today-panel";
import { hoyFood } from "@/lib/hoy-food";
import { localHour } from "@/lib/recipes";
import { WeekCard } from "@/components/hoy/week-card";
import { WeighIn } from "@/components/weigh-in";
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

const nf = (n: number, d = 1) => n.toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d });

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
  // Comida de hoy: lo que comió por tiempo de comida y la recomendación para el siguiente (solo con nutrición).
  const meal = ent.nutrition ? hoyFood({ meals: meals.today, hour: localHour(new Date(), v.tz), todayIso: d.today.iso, eaten: { kcal: eaten.kcal + g.log.kcal, protein: eaten.protein + g.log.protein }, target: { kcal: t.kcal, protein: t.protein } }) : null;
  const training = isTrainingDay(plan);
  const dateLabel = d.today.date.toLocaleDateString("es-419", { weekday: "long", day: "numeric", month: "long" });
  const mins = plan.mins ?? (training ? 55 : 0);
  const kgLost = a.startWeight - a.currentWeight;
  // "La última vez hiciste...": el primer ejercicio con peso de hoy que ya tiene historial, con la indicación del motor.
  const lastTime = training && !g.trainedToday ? await lastTimeFor(v, voice, (plan.program?.exercises ?? plan.exercises) as { id: string; name: string; cfg: SlotCfg }[], d.deload) : null;

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


      {/* Sin programa: el entreno de hoy va primero y a todo lo ancho (con imágenes de cada ejercicio). */}
      {!d.program && <WorkoutHero plan={plan} voice={voice} mins={mins} trainedToday={g.trainedToday} deload={d.deload} dayName={DAY_NAMES[d.today.dow]} yesterday={d.yesterday} tomorrow={d.tomorrow} lastTime={lastTime}
        readiness={{ initial: g.log.energy ?? 0, dateKey: d.today.iso, demo: v.demo, suggestSoft: d.glp1?.phase === "inyeccion" || d.glp1?.phase === "post" }} />}

      {/* Números de hoy: calorías y macros (solo con nutrición; en Entreno, la invitación a sumarla), más agua, pasos y sueño */}
      <div className="grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        <TodayPanel initial={g.log} nutrition={ent.nutrition ? { base: eaten, target: { kcal: t.kcal, protein: t.protein, carbs: t.carbs, fat: t.fat }, mode: d.mode, meal: meal! } : null} habits={{ steps: t.steps, sleep: t.sleep, water: d.glp1 ? Math.round(d.glp1.waterL * 4) : 8 }} dateKey={d.today.iso} demo={v.demo} />
        {/* Con un programa activo, su héroe reemplaza al entreno de hoy; sin programa, aquí va el exprés */}
        {d.program ? <ProgramHero p={d.program} trainedToday={g.trainedToday} energy={g.log.energy ?? 0} dateKey={d.today.iso} demo={v.demo} mins={mins} voice={voice} lastTime={lastTime} /> : !g.trainedToday && <ExpressCard program={false} compact />}
      </div>
      {d.program && !g.trainedToday && <ExpressCard program compact />}
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

/** Lo que hizo la última vez en el primer ejercicio con peso de hoy y lo que toca ahora (mismos números que el reproductor). */
async function lastTimeFor(v: Viewer, voice: Voice, exs: { id: string; name: string; cfg: SlotCfg }[], deload: boolean): Promise<string | null> {
  const weighted = exs.filter((e) => (EX[e.id as keyof typeof EX]?.inc ?? 0) > 0).slice(0, 4);
  if (!weighted.length) return null;
  try {
    const hist = await getHistory(v, weighted.map((e) => e.id));
    for (const e of weighted) {
      const h = hist[e.id];
      const last = h?.at(-1);
      if (!last?.length) continue;
      const top = last.reduce((a, b) => ((b.kg ?? 0) > (a.kg ?? 0) || ((b.kg ?? 0) === (a.kg ?? 0) && b.reps > a.reps) ? b : a));
      if (!top.kg) continue;
      const rx = prescribe(e.id, e.cfg, h, { deload });
      return lastTimeLine(voice, { name: e.name, lastKg: top.kg, lastReps: top.reps, kg: rx.kg, reps: rx.reps[0] ?? e.cfg.lo, type: rx.type });
    }
  } catch { /* sin historial: sin la línea */ }
  return null;
}
