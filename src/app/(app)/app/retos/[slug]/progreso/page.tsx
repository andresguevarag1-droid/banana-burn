// Avance de un programa: cumplimiento, sesiones hechas y perdidas, fuerza en los ejercicios clave, check-in de inicio
// y final (peso, medidas y foto, con los registros de Progreso) y el certificado al terminar.
import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/supabase/server";
import { getAthlete } from "@/lib/athlete";
import { getEntitlements } from "@/lib/entitlements";
import { getProgress } from "@/lib/progress";
import { getMeasures, getPhotos } from "@/lib/measures";
import { todayFor } from "@/lib/today";
import { EX, type ExerciseId } from "@/lib/engine";
import { getLiftGains, getProgramStates, loadProgram, exInfo } from "@/lib/programs-server";
import { adaptId, addDays, phaseAt, programDayOf, sessionsOfPhase, weeksOf, daysOf, durationLabel, weekDaysLabel } from "@/lib/programs";
import { ChallengeCover, coverInk } from "@/components/retos/cover";
import { weekLabel } from "@/components/programas/program-hero";
import { ProgramControls, StartProgramButton } from "@/components/programas/program-actions";
import { ProgressBar } from "@/components/progress-bar";
import { ArrowLeft, ArrowRight, BananaMedal, BrandIcon, Camera, Check, CheckCircle, Ruler, Scales, TrendUp, X } from "@/components/icons";

export const metadata = { title: "Avance del programa" };

const nf = (n: number, d = 1) => n.toLocaleString("es-419", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmt = (iso: string) => new Date(iso.slice(0, 10) + "T12:00:00").toLocaleDateString("es-419", { day: "numeric", month: "long", year: "numeric" });
const NO_KG_EQ = new Set(["body weight", "band", "resistance band"]);
const STATUS: Record<string, string> = { activo: "En curso", pausado: "En pausa", completado: "Completado", abandonado: "Lo dejaste" };

/** Registro más cercano a una fecha (hasta 7 días antes o después). */
function near<T extends { d: string }>(list: T[], iso: string): T | null {
  let best: T | null = null, gap = 8;
  for (const x of list) { const g = Math.abs(Math.round((Date.parse(x.d + "T12:00:00Z") - Date.parse(iso + "T12:00:00Z")) / 864e5)); if (g < gap) { gap = g; best = x; } }
  return best;
}

export default async function ProgramaAvance({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const v = (await getViewer())!;
  const st = (await getProgramStates(v)).find((s) => s.slug === slug);
  if (!st) notFound();
  const p = await loadProgram(v, st);
  if (!p) notFound();
  const [a, ent, prog, measures, photos] = await Promise.all([getAthlete(v), getEntitlements(v), getProgress(v), getMeasures(v), getPhotos(v)]);
  const { c, def, run } = p;
  const today = todayFor(v).iso;
  const weeks = weeksOf(def.meta);
  const ink = coverInk(c.cover);
  const doneKeys = new Set(p.done.map((d) => `${d.week}.${d.day}`));
  const endIso = st.completedAt ? st.completedAt.slice(0, 10) : today;

  // Fuerza: los ejercicios clave tal como los hace la persona (con su equipo) y su unidad.
  const allEx = def.sessions.flatMap((s) => s.exercises);
  const keyIds = [...new Set(def.meta.keyLifts.map((id) => adaptId(allEx.find((e) => e.id === id) ?? { id }, a.equipment, def.meta.adapt, exInfo)))];
  const units = Object.fromEntries(keyIds.map((id) => {
    const e = allEx.find((x) => x.id === id || x.home === id);
    // Sin carga en kilos: peso corporal y bandas (el teaser con banda de Pilates se mide en repeticiones, no en 1RM).
    const bw = id.startsWith("ds:") ? NO_KG_EQ.has(exInfo(id)?.eq ?? "") : EX[id as ExerciseId]?.inc === 0;
    return [id, e?.unit === "s" ? "s" : bw ? "reps" : "kg"] as const;
  })) as Record<string, "kg" | "reps" | "s">;
  const gains = await getLiftGains(v, keyIds, st.startedOn, units);

  // Check-in de inicio y final con los registros de Progreso.
  const w0 = near(prog.weights, st.startedOn), w1 = prog.weights.at(-1) ?? null;
  const m0 = near(measures, st.startedOn), m1 = measures.at(-1) ?? null;
  const photoStart = photos.find((x) => Math.abs(Date.parse(x.d) - Date.parse(st.startedOn)) <= 7 * 864e5);
  const lastWeek = run.week >= weeks || st.status === "completado";

  return (
    <div className="space-y-6 animate-enter">
      <Link href={`/app/retos/${slug}`} className="tap inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft weight="bold" className="size-4" />{c.title}</Link>

      <header className="overflow-hidden rounded-[1.75rem] shadow-soft">
        <ChallengeCover c={c} chip={false} className="p-5 sm:p-6">
          <div className={`relative ${ink}`}>
            <p className="inline-flex h-7 items-center gap-1.5 rounded-full bg-ink px-2.5 text-[11px] font-extrabold uppercase tracking-[.1em] text-banana"><BrandIcon name={c.icon} className="size-3.5" />{STATUS[st.status]}</p>
            <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-balance">Avance del programa</h1>
            <p className="mt-1 text-sm font-bold opacity-85">{c.title}. Empezaste el {fmt(st.startedOn)}{st.status === "activo" || st.status === "pausado" ? `. ${weekLabel(p)}` : ""}</p>
          </div>
        </ChallengeCover>
      </header>

      {st.status === "completado" && (
        <section aria-labelledby="cert" className="overflow-hidden rounded-[1.75rem] border-2 border-banana bg-cream">
          <div className="flex items-center gap-4 p-5 sm:p-6">
            <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-banana text-ink shadow-soft"><BananaMedal className="size-10" /></span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[.12em] text-banana-ink">Certificado de programa</p>
              <h2 id="cert" className="text-2xl font-extrabold leading-tight text-ink">{c.badge}</h2>
              <p className="mt-0.5 text-sm text-muted">{c.title}: {durationLabel(def.meta)}, {run.sessionsDone} sesiones, completado el {fmt(endIso)}{c.rewardTitle ? `. Título: ${c.rewardTitle}` : ""}.</p>
            </div>
          </div>
        </section>
      )}

      <section aria-label="Cumplimiento" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { l: "Cumplimiento", v: `${Math.round(run.pct * 100)} %`, h: "de las sesiones del programa" },
          { l: "Sesiones hechas", v: `${run.sessionsDone}`, h: `de ${run.sessionsTotal}${run.extrasDone ? `, más ${run.extrasDone} extra` : ""}` },
          { l: "Perdidas", v: `${run.sessionsMissed}`, h: run.sessionsMissed ? (run.byDays ? "en días que ya pasaron" : "en semanas que ya pasaron") : st.status === "completado" ? "ninguna" : "ninguna, vas al día" },
          run.byDays ? { l: "Día", v: `${Math.min(run.days, run.effectiveDay + 1)} de ${run.days}`, h: `fase ${run.phase.index}: ${run.phase.phase.name}` } : { l: "Semana", v: `${Math.min(run.week, weeks)} de ${weeks}`, h: `fase ${run.phase.index}: ${run.phase.phase.name}` },
        ].map((k) => (
          <div key={k.l} className="card p-4"><p className="text-xs font-bold text-muted">{k.l}</p><p className="mt-1 text-2xl font-extrabold tabular-nums text-ink">{k.v}</p><p className="text-xs text-muted">{k.h}</p></div>
        ))}
      </section>
      <ProgressBar value={run.pct} min={0.02} className="h-3" fill="bg-ink" track="bg-line" label={`${Math.round(run.pct * 100)} % del programa`} />

      <section aria-labelledby="semanas" className="card p-5">
        <h2 id="semanas" className="font-extrabold text-ink">{run.byDays ? `Tus ${run.days} días` : "Semana por semana"}</h2>
        {run.byDays && <p className="mt-1 text-sm text-muted">Cada casilla es una sesión, con el día del programa en que toca.</p>}
        <ol className="mt-3 space-y-1.5">
          {Array.from({ length: weeks }, (_, i) => i + 1).map((w) => {
            const ph = phaseAt(def.meta, w);
            const ss = sessionsOfPhase(def.sessions, ph.index);
            const cur = w === run.week && (st.status === "activo" || st.status === "pausado");
            return (
              <li key={w} className={`flex items-center gap-3 rounded-xl px-2 py-1.5 ${cur ? "bg-banana-soft" : ""}`}>
                <span className="w-20 shrink-0 text-xs font-bold text-muted first-letter:uppercase">{run.byDays ? weekDaysLabel(def.meta, w) : `Semana ${w}`}{ph.phase.deload ? <span className="block text-[10px] text-sky">descarga</span> : null}</span>
                <span className="flex flex-wrap gap-1.5">
                  {ss.map((s) => {
                    const ok = doneKeys.has(`${w}.${s.day}`);
                    // En días (Pilates 30 días): el día del programa en que el calendario pone esa sesión.
                    const label = run.byDays ? programDayOf(def, w, s.day) : s.day;
                    const past = w < run.week || (st.status !== "activo" && st.status !== "pausado");
                    return <span key={s.day} title={`${run.byDays ? `Día ${label}: ` : ""}${s.title}${ok ? ": hecha" : past && !s.optional ? ": perdida" : ""}`} className={`grid size-7 place-items-center rounded-lg text-[11px] font-bold ${ok ? "bg-ink text-banana" : past && !s.optional ? "bg-cream text-bad" : s.optional ? "border border-dashed border-line text-faint" : "border border-line bg-white text-muted"}`}>
                      {ok ? <Check weight="bold" className="size-3.5" /> : past && !s.optional ? <X weight="bold" className="size-3" /> : label}
                      <span className="sr-only">{ok ? "hecha" : past && !s.optional ? "perdida" : "pendiente"}</span>
                    </span>;
                  })}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="fuerza" className="card p-5">
        <h2 id="fuerza" className="flex items-center gap-2 font-extrabold text-ink"><TrendUp weight="duotone" className="size-5 text-peel" />{Object.values(units).includes("kg") ? "Fuerza en los ejercicios clave" : "Tu avance en los ejercicios clave"}</h2>
        <p className="mt-1 text-sm text-muted">Tu mejor serie en la primera sesión del programa contra la más reciente{Object.values(units).includes("kg") ? " (1RM estimado)" : ""}.</p>
        {gains.length ? (
          <ul className="mt-3 divide-y divide-line">
            {gains.map((g) => {
              const diff = g.last - g.first, pct = g.first ? (diff / g.first) * 100 : 0;
              const u = g.unit === "kg" ? "kg" : g.unit === "s" ? "s" : "reps";
              return (
                <li key={g.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0"><span className="block font-bold text-ink">{g.name}</span><span className="block text-xs text-muted">{g.firstOn === g.lastOn ? "Una sola sesión registrada" : `Del ${fmt(g.firstOn)} al ${fmt(g.lastOn)}`}</span></span>
                  <span className="shrink-0 text-right tabular-nums"><span className="block font-extrabold text-ink">{nf(g.first, g.unit === "kg" ? 1 : 0)} → {nf(g.last, g.unit === "kg" ? 1 : 0)} {u}</span>{g.firstOn !== g.lastOn && <span className={`block text-xs font-bold ${diff > 0 ? "text-peel" : "text-muted"}`}>{diff > 0 ? "+" : ""}{nf(pct, 0)} %</span>}</span>
                </li>
              );
            })}
          </ul>
        ) : <p className="mt-3 rounded-2xl bg-cream p-3 text-sm text-muted">Todavía no hay series registradas en {keyIds.map((id) => exInfo(id)?.name).filter(Boolean).join(", ")}. Aparecen aquí desde tu primera sesión.</p>}
      </section>

      <section aria-labelledby="checkin" className="card p-5">
        <h2 id="checkin" className="font-extrabold text-ink">Check-in de inicio y final</h2>
        <p className="mt-1 text-sm text-muted">Opcional. Usa tus registros de Progreso: pésate, mide tu cintura y toma una foto al empezar y en la última semana.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-cream p-4">
            <p className="flex items-center gap-1.5 text-xs font-bold text-muted"><Scales weight="duotone" className="size-4" />Peso</p>
            {w0 ? <p className="mt-1 font-extrabold tabular-nums text-ink">{nf(w0.v)} kg{w1 && w1.d > w0.d ? <> → {nf(w1.v)} kg</> : null}</p> : <p className="mt-1 text-sm text-muted">Sin pesaje cerca del inicio.</p>}
            <Link href="/app/progreso" className="tap mt-1 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-ink">Pesarme<ArrowRight weight="bold" className="size-3.5" /></Link>
          </div>
          <div className="rounded-2xl bg-cream p-4">
            <p className="flex items-center gap-1.5 text-xs font-bold text-muted"><Ruler weight="duotone" className="size-4" />Cintura</p>
            {m0?.waist ? <p className="mt-1 font-extrabold tabular-nums text-ink">{nf(m0.waist)} cm{m1?.waist && m1.d > m0.d ? <> → {nf(m1.waist)} cm</> : null}</p> : <p className="mt-1 text-sm text-muted">Sin medidas cerca del inicio.</p>}
            <Link href="/app/progreso#medidas" className="tap mt-1 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-ink">Tomar medidas<ArrowRight weight="bold" className="size-3.5" /></Link>
          </div>
          <div className="rounded-2xl bg-cream p-4">
            <p className="flex items-center gap-1.5 text-xs font-bold text-muted"><Camera weight="duotone" className="size-4" />Foto</p>
            <p className="mt-1 text-sm text-body">{photoStart ? <><CheckCircle weight="fill" className="mr-1 inline size-4 align-[-3px] text-peel" />Tienes foto de inicio.</> : lastWeek ? "Toma tu foto final con la misma luz y pose." : "Una foto de frente y otra de lado. Solo tú las ves."}</p>
            <Link href="/app/progreso#fotos" className="tap mt-1 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-ink">{lastWeek ? "Foto final" : "Foto de inicio"}<ArrowRight weight="bold" className="size-3.5" /></Link>
          </div>
        </div>
      </section>

      {(st.status === "activo" || st.status === "pausado") && (
        <section aria-labelledby="opciones" className="card p-5">
          <h2 id="opciones" className="font-extrabold text-ink">Opciones</h2>
          <p className="mt-1 text-sm text-muted">{st.status === "pausado" ? `En pausa desde el ${fmt(st.pausedOn ?? today)}. ${run.byDays ? "Los días del programa no avanzan" : "La semana no avanza"} mientras tanto.` : run.canFinish ? (run.today === "terminado" ? "Terminaste el calendario del programa. Ciérralo para recibir tu certificado." : "Hiciste todas las sesiones del programa. Ya puedes cerrarlo y recibir tu certificado.") : `Si necesitas unos días, pausa: ${run.byDays ? "el conteo de días se detiene" : "la semana deja de avanzar"}. Termina el ${fmt(addDays(st.startedOn, daysOf(def.meta) - 1 + st.pausedDays))} si sigues al día.`}</p>
          <div className="mt-4 space-y-3">
            {st.status === "pausado" && ent.app && <StartProgramButton slug={slug} title={c.title} label="Reanudar programa" className="btn-primary h-12 px-5" />}
            <ProgramControls slug={slug} title={c.title} status={st.status} canFinish={run.canFinish} />
          </div>
        </section>
      )}
      {st.status === "abandonado" && <p className="rounded-2xl bg-cream p-4 text-sm text-muted">Dejaste este programa. Puedes empezarlo de nuevo desde <Link href={`/app/retos/${slug}`} className="font-bold text-ink underline underline-offset-4">su página</Link>.</p>}
    </div>
  );
}
