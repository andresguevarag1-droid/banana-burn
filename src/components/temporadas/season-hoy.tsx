// Tarjeta de temporada en Hoy: cuenta regresiva en la preventa, "Empezar mi temporada" si ya empezó y no la activó,
// y con la temporada activa, su semana, su evento y la opinión rápida de la última sesión.
import Link from "next/link";
import { ArrowRight, CalendarCheck, Flag, PersonSimpleRun } from "@/components/icons";
import { createClient, type Viewer } from "@/lib/supabase/server";
import { getProgramStates } from "@/lib/programs-server";
import { exInfo } from "@/lib/programs-server";
import { parseProgramTemplate } from "@/lib/programs";
import { getIntake, getSeasonsView } from "@/lib/seasons-server";
import { DOW_LONG, SPORTS, daysBetweenIso, daysToStart, longDate, parseSeasonSlug, planWeek, seasonStatus, seasonWeek } from "@/lib/seasons";
import { listRuns } from "@/lib/runs-server";
import { fmtKm, longRunShift } from "@/lib/runs";
import { SeasonActivate } from "./season-activate";
import { SeasonFeedback } from "./season-feedback";

/** La última sesión de temporada (hoy o ayer) sin opinión, con sus ejercicios. */
async function pendingFeedback(v: Viewer, slug: string, today: string) {
  if (v.demo) return null;
  const sb = await createClient();
  const since = new Date(Date.parse(today + "T12:00:00Z") - 864e5).toISOString().slice(0, 10);
  const { data: w } = await sb.from("workouts").select("id,template,day").eq("user_id", v.id).like("template", `p:${slug}:%`).gte("day", since).order("day", { ascending: false }).limit(1).maybeSingle();
  const t = w ? parseProgramTemplate(String(w.template ?? "")) : null;
  if (!w || !t) return null;
  const { count } = await sb.from("season_feedback").select("id", { count: "exact", head: true }).eq("user_id", v.id).eq("slug", slug).eq("week", t.week).eq("day", t.day);
  if (count) return null;
  const { data: sets } = await sb.from("workout_sets").select("exercise").eq("workout_id", w.id).limit(80);
  const ids = [...new Set(((sets ?? []) as { exercise: string }[]).map((x) => x.exercise))].slice(0, 8);
  const exercises = ids.map((id) => ({ id, name: exInfo(id)?.name ?? id })).filter((e) => /^(ds:\d{4}|[a-z][a-zA-Z0-9_]{1,30})$/.test(e.id));
  return exercises.length ? { week: t.week, day: t.day, exercises } : null;
}

/** Hoy nunca se rompe por la temporada: si algo falla al leerla, la tarjeta simplemente no aparece. */
export async function SeasonHoy({ v }: { v: Viewer }) {
  try {
    return await SeasonHoyInner({ v });
  } catch (e) {
    console.error("[temporadas] hoy", e instanceof Error ? e.name : "error");
    return null;
  }
}

async function SeasonHoyInner({ v }: { v: Viewer }) {
  const [view, states] = await Promise.all([getSeasonsView(v), getProgramStates(v)]);
  const owned = view.seasons.filter((s) => view.owned.has(s.slug));
  if (!owned.length) return null;
  const active = owned.find((s) => states.some((x) => x.slug === s.slug && x.status === "activo"));
  const s = active ?? owned[0];
  const m = parseSeasonSlug(s.slug)!;
  const info = SPORTS[m.sport];
  const status = seasonStatus(s, view.today);
  const intake = await getIntake(v, s.slug);
  const style = { ["--sport" as string]: info.accent, ["--sport-soft" as string]: info.accentSoft };

  if (status === "preventa") {
    return (
      <section style={style} className="card flex flex-wrap items-center gap-4 p-5">
        <span className="grid place-items-center size-12 shrink-0 rounded-2xl bg-[var(--sport)] text-white"><CalendarCheck weight="duotone" className="size-6" /></span>
        <div className="min-w-0 flex-1"><p className="font-extrabold text-ink">{s.title} empieza en {daysToStart(s, view.today)} días</p><p className="text-sm text-muted">El {longDate(s.startsOn)} tu app se transforma en {info.mode}.</p></div>
        {!intake && <Link href={`/app/temporadas/${s.slug}/cuestionario`} className="btn-primary h-11">Armar mi semana<ArrowRight className="size-4" /></Link>}
      </section>
    );
  }
  if (status === "terminada") return null;
  if (!active) {
    return (
      <section style={style} className="card space-y-3 p-5">
        <p className="font-extrabold text-ink">Tu {s.title} ya empezó</p>
        {intake ? <SeasonActivate slug={s.slug} /> : <Link href={`/app/temporadas/${s.slug}/cuestionario`} className="btn-banana w-full h-12">Armar mi semana</Link>}
      </section>
    );
  }
  const fb = await pendingFeedback(v, s.slug, view.today);
  // Running: una carrera larga fuera de plan corre un día la siguiente sesión pesada de piernas.
  const shift = m.sport === "running" && intake ? longRunShift(planWeek("running", intake.answers).days, await listRuns(v, 3), view.today, intake.answers.running?.longRunDay ?? null) : null;
  const ev = intake?.answers.eventDate && intake.answers.eventDate >= view.today ? intake.answers : null;
  return (
    <div style={style} className="space-y-3">
      <Link href={`/app/temporadas/${s.slug}`} className="card flex items-center gap-3 p-4 transition-transform duration-150 active:scale-[.99]">
        <span className="chip h-7 shrink-0 bg-[var(--sport)] text-white">{info.mode}</span>
        <span className="min-w-0 flex-1 text-sm font-semibold text-ink">Semana {Math.max(1, Math.min(8, seasonWeek(s, view.today)))} de 8{ev ? `. Faltan ${daysBetweenIso(view.today, ev.eventDate!)} días para tu ${ev.eventType ?? "evento"}` : ""}</span>
        {ev ? <Flag weight="duotone" className="size-5 shrink-0 text-[var(--sport)]" /> : <ArrowRight className="size-4 shrink-0 text-muted" />}
      </Link>
      {shift && (
        <section className="card flex gap-3 p-4">
          <PersonSimpleRun weight="duotone" className="size-6 shrink-0 text-[var(--sport)]" />
          <p className="text-sm text-body"><b className="block text-ink">Corriste {fmtKm(shift.run.distanceM)} km fuera de tu plan</b>Pasa tu sesión de {shift.moved} al {DOW_LONG[shift.to]} y haz hoy recuperación o descanso: tus piernas necesitan 48 horas antes de cargar pesado.</p>
        </section>
      )}
      {m.sport === "running" && <Link href="/app/correr" className="card flex items-center gap-3 p-4 text-sm font-semibold text-ink"><PersonSimpleRun weight="duotone" className="size-5 text-[var(--sport)]" /><span className="flex-1">Registra tu carrera con GPS</span><ArrowRight className="size-4 text-muted" /></Link>}
      {fb && <SeasonFeedback slug={s.slug} week={fb.week} day={fb.day} title={`Semana ${fb.week}, sesión ${fb.day}`} exercises={fb.exercises} />}
    </div>
  );
}
