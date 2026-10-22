import Link from "next/link";
import { ArrowRight, Clock, Flame, Footprints, Moon, Timer } from "lucide-react";
import { Ring } from "@/components/ring";
import { getViewer } from "@/lib/supabase/server";
import { dashboard, getAthlete } from "@/lib/athlete";
import { DAY_NAMES } from "@/lib/engine";

export const metadata = { title: "Hoy" };

const fmtRest = (s: number) => (s >= 120 ? `${s / 60} min` : `${s} s`);

export default async function Hoy() {
  const v = (await getViewer())!;
  const a = await getAthlete(v);
  const d = dashboard(a);
  const { plan, t } = d;
  const dateLabel = d.today.date.toLocaleDateString("es-CR", { weekday: "long", day: "numeric", month: "long" });
  const training = !!plan.tpl;
  const unit = (u?: string) => (u === "s" ? " s" : u === "m" ? " m" : "");

  return (
    <div className="space-y-6 animate-rise">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-muted first-letter:uppercase">{dateLabel}</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">¡Pura vida, {a.name}! 🍌</h1>
        </div>
        <span className="chip shrink-0 whitespace-nowrap bg-white border border-line text-ink h-9 px-4 text-sm">🔥 Semana {d.week + 1}{d.deload && " · descarga"}</span>
      </header>

      {!a.complete && (
        <div className="card p-5 flex items-center justify-between gap-4 border-banana bg-banana-soft/50">
          <p className="font-semibold text-ink">Completa tu perfil para calcular tu plan exacto ✍️</p>
          <Link href="/app/progreso" className="btn-primary h-10 text-sm">Completar</Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr] [&>*]:min-w-0">
        {/* Rutina de hoy */}
        <section className={`rounded-[1.75rem] p-6 sm:p-7 ${training ? "bg-banana" : "card"}`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold uppercase tracking-wider text-ink/70">Hoy {DAY_NAMES[d.today.dow]} te toca</p>
            <span className="chip bg-ink/10 text-ink">{plan.tag}</span>
          </div>
          <h2 className="mt-2 text-4xl font-extrabold tracking-tight text-ink">{plan.emoji} {plan.name}</h2>
          <p className="mt-1 text-sm font-semibold text-ink/70 flex items-center gap-1.5"><Clock className="size-4" />{plan.mins ? `~${plan.mins} min` : training ? "~55 min" : "Día libre"} · tempo 3-1-1 · deja 1–2 reps en reserva</p>

          {training ? (
            <ol className="mt-6 space-y-2">
              {plan.exercises.map((e, i) => (
                <li key={e.id} className="flex items-center gap-4 rounded-2xl bg-white/70 backdrop-blur px-4 py-3">
                  <span className="grid place-items-center size-9 shrink-0 rounded-xl bg-ink text-white font-bold">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-ink truncate">{e.name}</p>
                    <p className="text-xs font-semibold text-ink/60">{e.muscle} · descanso {fmtRest(e.cfg.rest)}</p>
                  </div>
                  <p className="text-right font-extrabold text-ink tabular-nums">{e.cfg.sets}×{e.cfg.lo}–{e.cfg.hi}{unit(e.cfg.unit)}</p>
                </li>
              ))}
              {plan.cardio && <li className="rounded-2xl bg-white/50 px-4 py-3 text-sm font-semibold text-ink">🚶 {plan.cardio}</li>}
            </ol>
          ) : (
            <p className="mt-6 text-lg text-ink">🚶 {plan.cardio}. Tu músculo crece hoy — duerme bien y llega a tu proteína.</p>
          )}

          <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            {training && <Link href="/app/entrenar" className="btn-primary h-13 px-6">Empezar entreno <ArrowRight className="size-5" /></Link>}
            <p className="text-sm font-semibold text-ink/70">Ayer: {d.yesterday.emoji} {d.yesterday.name} · Mañana: {d.tomorrow.emoji} {d.tomorrow.name}</p>
          </div>
        </section>

        {/* Meta */}
        <section className="card p-6 flex flex-col items-center text-center">
          <p className="eyebrow">Tu meta</p>
          <div className="mt-4">
            <Ring value={d.progress} size={160}>
              <div><p className="text-3xl font-extrabold text-ink tabular-nums">{d.toGo.toLocaleString("es-CR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</p><p className="text-xs font-semibold text-muted">kg por bajar</p></div>
            </Ring>
          </div>
          <p className="mt-4 font-bold text-ink">{a.currentWeight} kg → {a.goalWeight} kg</p>
          <p className="text-sm text-muted">{d.daysLeft} días · necesitas −{d.needPerWeek.toLocaleString("es-CR")} kg/sem</p>
          <Link href="/app/progreso" className="btn-ghost h-10 mt-5 text-sm w-full">⚖️ Registrar peso de hoy</Link>
        </section>
      </div>

      {/* Objetivos diarios */}
      <section>
        <h3 className="font-bold text-ink mb-3">Objetivos de hoy</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { i: <Flame className="size-5 text-ember" />, v: t.kcal.toLocaleString("es-CR"), l: "kcal" },
            { i: <span className="text-lg">🥩</span>, v: `${t.protein} g`, l: "proteína" },
            { i: <span className="text-lg">🍚</span>, v: `${t.carbs} g`, l: "carbos (pre-entreno)" },
            { i: <span className="text-lg">🥑</span>, v: `${t.fat} g`, l: "grasa" },
            { i: <Footprints className="size-5 text-sky" />, v: "10.000", l: "pasos" },
            { i: <Moon className="size-5 text-banana-ink" />, v: "7–9 h", l: "sueño" },
          ].map((m) => (
            <div key={m.l} className="card p-4">
              {m.i}<p className="mt-2 text-xl font-extrabold text-ink tabular-nums">{m.v}</p><p className="text-xs font-semibold text-muted">{m.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Semana */}
      <section className="card p-5">
        <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-ink">Esta semana</h3><Link href="/app/entrenar" className="text-sm font-semibold text-muted hover:text-ink">Ver plan →</Link></div>
        <div className="grid grid-cols-7 gap-2">
          {d.weekPlan.map((p) => {
            const isToday = p.dow === d.today.dow;
            return (
              <div key={p.dow} className={`rounded-2xl py-3 text-center ${isToday ? "bg-ink text-white" : p.tpl ? "bg-cream" : "bg-white border border-dashed border-line"}`}>
                <p className={`text-[11px] font-bold uppercase ${isToday ? "text-banana" : "text-muted"}`}>{DAY_NAMES[p.dow].slice(0, 3)}</p>
                <p className="text-xl mt-1">{p.emoji}</p>
                <p className={`hidden sm:block text-[11px] font-semibold mt-1 px-1 truncate ${isToday ? "" : "text-ink"}`}>{p.name}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card p-5 flex gap-4 items-start">
        <span className="grid place-items-center size-11 shrink-0 rounded-2xl bg-banana-soft"><Timer className="size-5 text-ink" /></span>
        <div>
          <p className="font-bold text-ink">Consejo del coach</p>
          <p className="text-muted">Come tus carbos 60–90 min antes de entrenar (gallo pinto con huevo o plátano con yogurt griego) y pésate mañana al despertar, después del baño.</p>
        </div>
      </section>
    </div>
  );
}
