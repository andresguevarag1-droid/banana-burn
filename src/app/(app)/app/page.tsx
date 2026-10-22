import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import { getViewer } from "@/lib/supabase/server";
import { dashboard, getAthlete } from "@/lib/athlete";
import { getDaily } from "@/lib/daily";
import { getMeals, sumMeals } from "@/lib/meals";
import { DAY_NAMES } from "@/lib/engine";
import { DayTracker } from "@/components/day-tracker";
import { WeighIn } from "@/components/weigh-in";
import { Readiness } from "@/components/readiness";
import { ExpressChips } from "@/components/express-chips";
import { NotificationBell } from "@/components/notifications/bell";
import { EnablePush } from "@/components/notifications/enable-push";
import { AnnouncementBanner } from "@/components/admin/announcement-banner";
import { Glp1Card } from "@/components/glp1-card";
import { ChallengeCard } from "@/components/challenge-card";
import { getMyChallenges } from "@/lib/challenges-server";
import { toView } from "@/lib/challenge-view";

export const metadata = { title: "Hoy" };

const nf = (n: number, d = 1) => n.toLocaleString("es-CR", { minimumFractionDigits: d, maximumFractionDigits: d });
const DOW1 = ["D", "L", "M", "M", "J", "V", "S"];

function tipFor(dow: number, training: boolean, proteinLeft: number) {
  if (!training) return "Hoy el músculo crece. Camina, estira 10 min y llega a tu proteína. Mañana vuelves con todo 💪";
  if (proteinLeft > 100) return "Come tus carbos 60–90 min antes de entrenar: gallo pinto con huevo o plátano con yogurt griego 🍌";
  if (dow === 5) return "Viernes: después del gym, casado con pechuga y doble ensalada. Guarda el fresco para el finde 😉";
  return "Tempo 3-1-1 en cada rep. Bajar lento es donde se construye el músculo.";
}

export default async function Hoy() {
  const v = (await getViewer())!;
  const a = await getAthlete(v);
  const d = dashboard(a);
  const [g, meals] = await Promise.all([getDaily(v, a.startWeight, a.currentWeight), getMeals(v)]);
  const eaten = sumMeals(meals.today);
  const ch = await getMyChallenges(v, { workout: g.trainedToday, steps: g.log.steps, water: g.log.water, protein: g.log.protein + eaten.protein, proteinGoal: d.t.protein });
  const { plan, t } = d;
  const training = !!plan.tpl;
  const dateLabel = d.today.date.toLocaleDateString("es-CR", { weekday: "long", day: "numeric", month: "long" });
  const mins = plan.mins ?? (training ? 55 : 0);
  const kgLost = a.startWeight - a.currentWeight;

  return (
    <div className="space-y-5 animate-rise">
      {/* Encabezado + motivación */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-muted first-letter:uppercase">{dateLabel}</p>
          <h1 className="text-[28px] sm:text-4xl font-extrabold tracking-tight text-ink leading-tight">¡Pura vida, {a.name}!</h1>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <NotificationBell className="lg:hidden" />
          <Link href="/app/progreso#logros" className="pressable flex flex-col items-center rounded-2xl bg-white border border-line px-3 py-1.5 hover:border-ink/25" aria-label={`Racha de ${g.streak.days} días`}>
            <span className={`text-2xl leading-none ${g.streak.todayDone ? "" : "grayscale-[.6] opacity-80"}`}>🔥</span>
            <span className="text-sm font-extrabold text-ink tabular-nums">{g.streak.days}</span>
          </Link>
          <Link href="/app/perfil" className="pressable lg:hidden grid place-items-center size-12 rounded-2xl bg-banana text-lg font-extrabold text-ink hover:brightness-95" aria-label="Mi perfil">{a.name[0]?.toUpperCase()}</Link>
        </div>
      </header>

      <AnnouncementBanner />
      <EnablePush hideWhenSnoozed />

      <Link href="/app/progreso#logros" className="block card p-3.5">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center size-10 rounded-xl bg-banana text-lg">{g.level.e}</span>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between text-xs font-bold"><span className="text-ink">Nivel {g.level.idx} · {g.level.n}</span><span className="text-muted tabular-nums">{g.xp.toLocaleString("es-CR")} XP</span></div>
            <div className="mt-1.5 h-2 rounded-full bg-line overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-banana to-ember" style={{ width: `${Math.max(4, g.level.progress * 100)}%` }} /></div>
          </div>
          <div className="hidden sm:flex gap-1.5 pl-3 border-l border-line">
            {g.week.map((w) => {
              const dw = new Date(w.d + "T12:00:00").getDay();
              const isToday = w.d === d.today.iso;
              return <span key={w.d} className={`grid place-items-center size-7 rounded-full text-[11px] font-bold ${w.active ? "bg-ember text-white" : isToday ? "border-2 border-dashed border-ember text-ember" : "bg-cream text-faint"}`}>{w.active ? "✓" : DOW1[dw]}</span>;
            })}
          </div>
        </div>
        <div className="sm:hidden mt-3 flex justify-between">
          {g.week.map((w) => {
            const dw = new Date(w.d + "T12:00:00").getDay();
            const isToday = w.d === d.today.iso;
            return (
              <span key={w.d} className="flex flex-col items-center gap-1">
                <span className={`grid place-items-center size-8 rounded-full text-xs font-bold ${w.active ? "bg-ember text-white" : isToday ? "border-2 border-dashed border-ember text-ember" : "bg-cream text-faint"}`}>{w.active ? "✓" : ""}</span>
                <span className={`text-[10px] font-bold ${isToday ? "text-ink" : "text-faint"}`}>{DOW1[dw]}</span>
              </span>
            );
          })}
        </div>
        {!g.streak.todayDone && g.streak.days > 0 && <p className="mt-2.5 text-xs font-semibold text-ember-ink">Entrena o registra algo hoy para mantener tu racha de {g.streak.days} días 🔥</p>}
      </Link>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr] [&>*]:min-w-0">
        {/* Rutina de hoy */}
        <section className={`relative overflow-hidden rounded-[1.75rem] p-5 sm:p-6 ${g.trainedToday ? "bg-peel/10 border border-peel/30" : training ? "bg-banana" : "card"}`}>
          {training && !g.trainedToday && <span aria-hidden className="absolute -right-6 -top-8 text-[140px] leading-none opacity-[.13] rotate-12 select-none">{plan.emoji}</span>}
          <p className="relative text-xs font-bold uppercase tracking-wider text-ink/75">Hoy {DAY_NAMES[d.today.dow]} · {plan.tag}{d.deload && " · descarga 🌴"}</p>
          <h2 className="relative mt-1 text-[32px] leading-none font-extrabold tracking-tight text-ink">{plan.emoji} {plan.name}</h2>
          {training ? (
            <>
              <p className="relative mt-2 text-sm font-semibold text-ink/70">{plan.exercises.length} ejercicios · ~{mins} min{plan.cardio ? " · + cardio" : ""}</p>
              <ul className="relative mt-4 flex flex-wrap gap-1.5">
                {plan.exercises.map((e) => <li key={e.id} className="chip h-8 bg-white/70 text-ink text-[13px]">{e.name} <span className="text-ink/70">{e.cfg.sets}×{e.cfg.lo}–{e.cfg.hi}</span></li>)}
              </ul>
              {g.trainedToday ? (
                <p className="relative mt-5 font-extrabold text-peel">✅ ¡Entreno de hoy completado! Descansa y come bien.</p>
              ) : (
                <div className="relative mt-5"><Readiness suggestSoft={d.glp1?.phase === "inyeccion" || d.glp1?.phase === "post"} initial={g.log.energy ?? 0} dateKey={d.today.iso} demo={v.demo} mins={mins} /></div>
              )}
            </>
          ) : (
            <p className="relative mt-3 text-ink/80">🚶 {plan.cardio}. Tu músculo crece hoy.</p>
          )}
          {!g.trainedToday && <div className="relative mt-4"><ExpressChips /></div>}
          <p className="relative mt-4 text-xs font-semibold text-ink/75">Ayer {d.yesterday.emoji} {d.yesterday.name} · Mañana {d.tomorrow.emoji} {d.tomorrow.name}</p>
        </section>

        {/* Peso y meta */}
        <section className="card p-5 flex flex-col">
          <div className="flex items-baseline justify-between">
            <p className="font-bold text-ink">⚖️ {g.weighedToday ? "Peso de hoy" : "¿Ya te pesaste?"}</p>
            <Link href="/app/progreso" className="tap text-xs font-semibold text-muted hover:text-ink">Ver curva →</Link>
          </div>
          <p className="text-xs text-muted">Al despertar, después del baño, antes de comer.</p>
          <div className="mt-3"><WeighIn last={a.currentWeight} /></div>
          <div className="mt-4 pt-4 border-t border-line grid grid-cols-3 text-center">
            <div><p className="text-lg font-extrabold text-peel tabular-nums">−{nf(Math.max(0, kgLost))}</p><p className="text-[11px] font-semibold text-muted">kg perdidos</p></div>
            <div><p className="text-lg font-extrabold text-ink tabular-nums">{nf(d.toGo)}</p><p className="text-[11px] font-semibold text-muted">kg a la meta</p></div>
            <div><p className="text-lg font-extrabold text-ink tabular-nums">{d.daysLeft}</p><p className="text-[11px] font-semibold text-muted">días</p></div>
          </div>
        </section>
      </div>

      {d.glp1 && <Glp1Card g={d.glp1} nausea0={g.log.nausea ?? 0} demo={v.demo} />}

      {/* Tu día */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-lg font-extrabold text-ink">Tu día</h3>
          <Link href="/app/nutricion" className="tap text-sm font-semibold text-muted hover:text-ink">Registrar comida →</Link>
        </div>
        <DayTracker initial={g.log} base={{ kcal: eaten.kcal, protein: eaten.protein }} target={{ kcal: t.kcal, protein: t.protein, steps: t.steps, sleep: t.sleep, water: d.glp1 ? Math.round(d.glp1.waterL * 4) : 8 }} dateKey={d.today.iso} demo={v.demo} />
      </section>

      {/* Retos */}
      <section>
        <div className="flex items-baseline justify-between mb-3"><h3 className="text-lg font-extrabold text-ink">Tus retos</h3><Link href="/app/retos" className="tap text-sm font-semibold text-muted hover:text-ink">{ch.active.length ? "Ver todos →" : "Explorar retos →"}</Link></div>
        {ch.active.length ? (
          <div className="grid gap-3 lg:grid-cols-2">{ch.active.slice(0, 2).map((m) => <ChallengeCard key={m.ucId} v={toView(m)} compact />)}</div>
        ) : (
          <Link href="/app/retos" className="card p-4 flex items-center gap-3"><span className="text-3xl">🏆</span><span className="flex-1"><span className="block font-extrabold text-ink">Únete a un reto de 30 días</span><span className="block text-sm text-muted">Flexiones, plancha, 10.000 pasos… y gana tu medalla.</span></span><ChevronRight className="size-5 text-faint" /></Link>
        )}
      </section>

      {/* Coach */}
      <Link href="/app/coach" className="card p-4 flex gap-3 items-center hover:shadow-lift transition">
        <span className="grid place-items-center size-11 shrink-0 rounded-2xl bg-ink text-banana"><Sparkles className="size-5" /></span>
        <div className="flex-1 min-w-0"><p className="text-xs font-bold text-muted">Coach Banana</p><p className="text-[15px] text-ink leading-snug">{tipFor(d.today.dow, training, t.protein - g.log.protein - eaten.protein)}</p></div>
        <ChevronRight className="size-5 text-faint shrink-0" />
      </Link>
    </div>
  );
}
