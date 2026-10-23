// Héroe del programa activo en Hoy: reemplaza la tarjeta genérica de "Rutina de hoy" mientras hay un programa.
// Portada del programa, "Semana 2 de 8, día 2", la sesión de hoy, el avance y el próximo hito. Servidor.
import Link from "next/link";
import { ArrowRight, BrandIcon, CalendarCheck, CheckCircle, Flag, Monkey, Pause, TreePalm } from "@/components/icons";
import { ChallengeCover, coverInk } from "@/components/retos/cover";
import { ProgressBar } from "@/components/progress-bar";
import { Readiness } from "@/components/readiness";
import { ExpressChips } from "@/components/express-chips";
import { DAY_NAMES } from "@/lib/engine";
import type { AthleteProgram } from "@/lib/programs-server";
import { setsLabel, tipFor } from "@/lib/programs";

const fmtDay = (iso: string) => {
  const d = new Date(iso + "T12:00:00");
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()}`;
};
const n = (x: number) => x.toLocaleString("es-419");

/** "Semana 2 de 8, día 2" (el día es la sesión que toca dentro de la semana). */
export function weekLabel(p: Pick<AthleteProgram, "run">) {
  const r = p.run;
  const day = r.next?.day ?? r.weekSessions.filter((w) => w.done).length;
  return `Semana ${r.week} de ${r.weeks}${day ? `, día ${day}` : ""}`;
}

export function ProgramHero({ p, trainedToday, energy, dateKey, demo, mins }: { p: AthleteProgram; trainedToday: boolean; energy: number; dateKey: string; demo: boolean; mins: number }) {
  const ink = coverInk(p.cover);
  const r = p.run;
  const plan = p.plan;
  const session = r.today === "entreno" && plan.program;
  const x = p.meta.experience;
  // Primer día: la bienvenida del programa; después, el consejo de Coach Banana de esa semana.
  const first = r.sessionsDone === 0 && r.week === 1 && !!x?.welcome;
  const tip = first ? x!.welcome : tipFor(x, r.week);
  return (
    <section aria-labelledby="prog-hoy" className="overflow-hidden rounded-[1.75rem] shadow-soft">
      <ChallengeCover c={{ cover: p.cover, icon: p.icon }} chip={false} className="p-5 sm:p-6">
        <div className={`relative ${ink}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-ink px-2.5 text-[11px] font-extrabold uppercase tracking-[.1em] text-banana"><BrandIcon name={p.icon} className="size-3.5" />{x?.mode ?? "Programa activo"}</span>
            {r.phase.phase.deload && <span className="inline-flex h-7 items-center gap-1 rounded-full bg-white/85 px-2.5 text-[11px] font-extrabold text-ink"><TreePalm weight="duotone" className="size-3.5" />Semana de descarga</span>}
          </div>
          <h2 id="prog-hoy" className="mt-3 text-[26px] sm:text-[30px] font-extrabold leading-tight tracking-tight text-balance">{p.title}</h2>
          <p className="mt-1 text-sm font-bold opacity-85">{weekLabel(p)}. Fase {r.phase.index}: {r.phase.phase.name}</p>
          <div className="mt-3">
            <ProgressBar value={r.pct} min={0.03} className="h-2.5" track="bg-white/25" fill={p.cover === "noche" ? "bg-banana" : "bg-ink"} label={`Programa: ${r.sessionsDone} de ${r.sessionsTotal} sesiones`} />
            <p className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-xs font-bold tabular-nums opacity-85"><span>{n(r.sessionsDone)} de {n(r.sessionsTotal)} sesiones</span><span>{Math.round(r.pct * 100)} % del programa</span></p>
          </div>
        </div>
      </ChallengeCover>

      <div className="bg-cream p-5 sm:p-6">
        {tip && r.today !== "terminado" && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl bg-white p-3 shadow-[0_1px_0_var(--color-line)]">
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-banana text-ink"><Monkey weight="duotone" className="size-5" /></span>
            <p className="min-w-0 text-sm text-body"><b className="block text-[11px] font-extrabold uppercase tracking-[.12em] text-banana-ink">{first ? "Bienvenida" : `Coach Banana, semana ${r.week}`}</b>{tip}</p>
          </div>
        )}
        {session ? (
          <>
            <p className="text-sm font-semibold text-muted">Hoy {DAY_NAMES[new Date(dateKey + "T12:00:00").getDay()]}, sesión del programa</p>
            <h3 className="mt-0.5 text-2xl font-extrabold tracking-tight text-ink">{plan.name}</h3>
            <p className="mt-1 text-sm font-semibold text-ink/70 tabular-nums">{plan.exercises.length} ejercicios en unos {mins} min{plan.program?.deload ? ", con carga de descarga" : ""}</p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {plan.program!.exercises.map((e) => <li key={e.id} className="chip h-8 bg-white text-ink text-[13px] border border-line">{e.name} <span className="text-ink/70">{setsLabel(e.cfg)}</span></li>)}
            </ul>
            {trainedToday ? (
              <p className="mt-5 flex items-center gap-2 font-extrabold text-ink"><CheckCircle weight="fill" className="size-5 shrink-0 text-peel" />Ya entrenaste hoy. La sesión del programa sigue lista para cuando quieras.</p>
            ) : <div className="mt-5"><Readiness initial={energy} dateKey={dateKey} demo={demo} mins={mins} /></div>}
          </>
        ) : r.today === "hecho" ? (
          <p className="flex items-start gap-2.5 text-ink"><CheckCircle weight="fill" className="mt-0.5 size-6 shrink-0 text-peel" /><span><b className="block text-lg font-extrabold">Sesión de hoy completada</b><span className="text-sm text-muted">{r.nextOn ? `Tu próxima sesión es el ${fmtDay(r.nextOn)}.` : "Descansa y come bien."}</span></span></p>
        ) : r.today === "terminado" ? (
          <div>
            <p className="flex items-start gap-2.5 text-ink"><Flag weight="duotone" className="mt-0.5 size-6 shrink-0 text-ember-ink" /><span><b className="block text-lg font-extrabold">Terminaste las {r.weeks} semanas</b><span className="text-sm text-muted">Cierra el programa para recibir tu certificado y comparar con tu día 1.</span></span></p>
            <Link href={`/app/retos/${p.slug}/progreso`} className="btn-primary mt-4 h-12 w-full sm:w-auto px-6">Ver mi certificado<ArrowRight weight="bold" className="size-5" /></Link>
          </div>
        ) : r.today === "pausado" ? (
          <p className="flex items-start gap-2.5 text-ink"><Pause weight="duotone" className="mt-0.5 size-6 shrink-0" /><span><b className="block text-lg font-extrabold">Programa en pausa</b><span className="text-sm text-muted">Reanúdalo desde su página cuando quieras.</span></span></p>
        ) : (
          <div>
            <p className="flex items-start gap-2.5 text-ink"><TreePalm weight="duotone" className="mt-0.5 size-6 shrink-0 text-sky" /><span>
              <b className="block text-lg font-extrabold">{r.today === "semana-completa" ? "Semana completa" : "Hoy descansas"}</b>
              <span className="text-sm text-muted">{r.today === "semana-completa" ? (r.nextOn ? `La semana ${r.week + 1} empieza el ${fmtDay(r.nextOn)}. Camina y estira.` : "Camina y estira.") : `${x?.restDay ? `${x.restDay}. ` : ""}Tu próxima sesión es el ${r.nextOn ? fmtDay(r.nextOn) : "próximo día"}: ${r.next?.session.title ?? ""}. El músculo crece cuando descansas.`}</span>
            </span></p>
            {r.next && <Link href="/app/entreno" className="btn-ghost mt-4 h-12 w-full sm:w-auto px-5">Adelantar la sesión de {r.next.session.title}<ArrowRight weight="bold" className="size-4" /></Link>}
          </div>
        )}
        {!trainedToday && r.today !== "terminado" && <div className="mt-4"><ExpressChips /></div>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line pt-3 text-xs font-semibold text-ink/75">
          {r.milestone && <span className="inline-flex items-center gap-1.5"><CalendarCheck weight="duotone" className="size-4 text-banana-ink" />Próximo hito: {r.milestone.label}{r.milestone.left > 0 ? `, en ${r.milestone.left} ${r.milestone.left === 1 ? "semana" : "semanas"}` : ", esta semana"}</span>}
          <Link href={`/app/retos/${p.slug}/progreso`} className="tap inline-flex min-h-11 items-center gap-1 font-bold text-ink hover:underline underline-offset-4">Ver avance<ArrowRight weight="bold" className="size-3.5" /></Link>
        </div>
      </div>
    </section>
  );
}
