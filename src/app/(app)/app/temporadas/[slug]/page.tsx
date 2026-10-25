import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { ArrowLeft, CalendarCheck, CheckCircle, PencilSimple, ShieldWarning, Timer } from "@/components/icons";
import { getViewer } from "@/lib/supabase/server";
import { getSex } from "@/lib/athlete";
import { getCatalog } from "@/lib/challenges-server";
import { isProgram, usd } from "@/lib/challenges";
import { getProgramStates } from "@/lib/programs-server";
import { getIntake, getSeason, getSeasonsView } from "@/lib/seasons-server";
import { COACHES, seasonCoachId } from "@/lib/coaches";
import { SPORTS, canEnroll, daysToStart, longDate, parseSeasonSlug, planWeek, seasonStatus, seasonWeek } from "@/lib/seasons";
import { tilopayOfferedTo } from "@/lib/tilopay";
import { providerFor } from "@/lib/pay-provider";
import { SafeImage } from "@/components/safe-image";
import { SeasonBuy } from "@/components/temporadas/season-buy";
import { SeasonActivate } from "@/components/temporadas/season-activate";
import { WeekSummary } from "@/components/temporadas/week-summary";

type P = { params: Promise<{ slug: string }>; searchParams: Promise<{ pago?: string; listo?: string }> };

export async function generateMetadata({ params }: P) {
  const { slug } = await params;
  const m = parseSeasonSlug(slug);
  return { title: m ? `Temporada de ${SPORTS[m.sport].name}` : "Temporada" };
}

const PAGO: Record<string, string> = {
  confirmando: "Estamos confirmando tu pago con Tilopay. Revisa en unos minutos; no vuelvas a pagar.",
  rechazada: "El pago no se completó. Puedes intentarlo de nuevo con otra tarjeta.",
  error: "No pudimos confirmar tu pago. Si ves el cargo, escríbenos a hola@bananaburn.app.",
};

export default async function Temporada({ params, searchParams }: P) {
  const { slug } = await params;
  const m = parseSeasonSlug(slug);
  if (!m) notFound();
  const v = await getViewer();
  if (!v) redirect(`/entrar?next=/app/temporadas/${slug}`);
  const [s, view, sex, intake, states, catalog, sp] = await Promise.all([getSeason(v.demo, slug), getSeasonsView(v), getSex(v), getIntake(v, slug), getProgramStates(v), getCatalog(v.demo), searchParams]);
  if (!s) notFound();
  const c = catalog.get(slug);
  const meta = c && isProgram(c) ? c.program : null;
  const info = SPORTS[m.sport];
  const coach = COACHES[seasonCoachId(m.sport, sex)];
  const owned = view.owned.has(slug);
  const status = seasonStatus(s, view.today);
  const mine = states.find((x) => x.slug === slug);
  const active = mine?.status === "activo";
  const plan = intake ? planWeek(m.sport, intake.answers) : null;
  const h = await headers();
  const tilopay = tilopayOfferedTo(v.role);
  const suggested = providerFor({ country: h.get("x-vercel-ip-country"), profileCountry: v.country, tilopayReady: tilopay });

  return (
    <div className="space-y-6 animate-rise" style={{ ["--sport" as string]: info.accent, ["--sport-soft" as string]: info.accentSoft }}>
      <Link href="/app/temporadas" className="tap inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors duration-150 hover:text-ink"><ArrowLeft weight="bold" className="size-4" />Temporadas</Link>
      {sp.pago && PAGO[sp.pago] && <p role="alert" className="rounded-2xl bg-ember/10 p-3 text-sm font-semibold text-ember-ink">{PAGO[sp.pago]}</p>}
      {sp.listo && <p className="flex items-center gap-2 rounded-2xl bg-peel/10 p-3 text-sm font-semibold text-peel"><CheckCircle weight="duotone" className="size-5 shrink-0" />Tu semana quedó lista. Tu temporada empieza el {longDate(s.startsOn)}.</p>}

      <section className="card overflow-hidden md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="relative aspect-square md:aspect-auto md:min-h-80 bg-[var(--sport-soft)]">
          <SafeImage src={coach.hello} alt={`${coach.name} con ropa de ${info.name.toLowerCase()}`} fill priority sizes="(min-width: 768px) 45vw, 100vw" className="object-contain object-bottom p-4 mix-blend-multiply" />
        </div>
        <div className="space-y-4 p-5 sm:p-7">
          <span className="chip h-7 w-fit bg-[var(--sport)] text-white">{info.mode}</span>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink text-balance">{s.title}</h1>
          <p className="text-body text-pretty">{info.tagline} {meta?.who}</p>
          <p className="flex items-center gap-2 text-sm font-semibold text-ink"><CalendarCheck weight="duotone" className="size-5 text-[var(--sport)]" />Del {longDate(s.startsOn)} al {longDate(s.endsOn)}</p>
          <p className="flex items-center gap-2 text-sm font-semibold text-ink"><Timer weight="duotone" className="size-5 text-[var(--sport)]" />{status === "preventa" ? `Empieza en ${daysToStart(s, view.today)} días` : status === "activa" ? `Semana ${seasonWeek(s, view.today)} de 8` : "Esta temporada terminó"}</p>

          {owned ? (
            <div className="space-y-3 border-t border-line pt-4">
              {!intake ? (
                <Link href={`/app/temporadas/${slug}/cuestionario`} className="btn-banana w-full h-14 text-base">Armar mi semana</Link>
              ) : status === "activa" && !active ? (
                <SeasonActivate slug={slug} />
              ) : status === "preventa" ? (
                <p className="rounded-2xl bg-[var(--sport-soft)] p-3 text-sm font-semibold text-ink">Listo. El {longDate(s.startsOn)} tu app se transforma en {info.mode}.</p>
              ) : active ? (
                <Link href="/app/entrenar" className="btn-primary w-full h-12">Ir a mi entreno de hoy</Link>
              ) : null}
              {intake && <Link href={`/app/temporadas/${slug}/cuestionario`} className="tap inline-flex items-center gap-1.5 text-sm font-semibold text-muted underline underline-offset-4"><PencilSimple weight="bold" className="size-4" />Cambiar mis respuestas</Link>}
            </div>
          ) : canEnroll(s, view.today) ? (
            <div className="border-t border-line pt-4">
              {view.access || v.demo ? <SeasonBuy slug={slug} price={usd(s.priceMinor)} annual={!!view.annual} tilopay={tilopay} suggested={suggested} /> : <Link href="/app/suscripcion" className="btn-primary w-full h-12">Activa tu plan para sumar una temporada</Link>}
            </div>
          ) : (
            <p className="rounded-2xl bg-cream p-3 text-sm text-body">Las inscripciones de esta temporada cerraron. La próxima temporada abre cuando esta termine y llega con ejercicios nuevos; te avisamos en Novedades.</p>
          )}
        </div>
      </section>

      {plan && (
        <section className="card p-5 space-y-3" aria-labelledby="semana">
          <h2 id="semana" className="text-xl font-extrabold text-ink">Así queda tu semana</h2>
          <WeekSummary sport={m.sport} plan={plan} />
          {plan.warnings.map((w) => <p key={w} className="rounded-2xl bg-ember/10 p-3 text-sm font-semibold text-ember-ink">{w}</p>)}
          {intake && intake.fromWeek > 1 && <p className="text-xs text-muted">Tus cambios rigen desde la semana {intake.fromWeek}.</p>}
        </section>
      )}

      {meta && (
        <section className="grid gap-4 md:grid-cols-2">
          <div className="card p-5 space-y-3">
            <h2 className="text-xl font-extrabold text-ink">Las 8 semanas</h2>
            <ol className="space-y-2.5">
              {meta.phases.map((ph, k) => (
                <li key={ph.name} className="flex gap-3"><span className="grid place-items-center size-8 shrink-0 rounded-xl bg-[var(--sport-soft)] text-sm font-extrabold text-ink tabular-nums">{k + 1}</span><span><b className="text-ink">{ph.name}</b> <span className="text-muted">({ph.weeks === 1 ? "1 semana" : `${ph.weeks} semanas`})</span><span className="block text-sm text-body">{ph.focus}</span></span></li>
              ))}
            </ol>
          </div>
          <div className="card p-5 space-y-3">
            <h2 className="text-xl font-extrabold text-ink">Qué incluye</h2>
            <ul className="space-y-2">{meta.outcomes.map((o) => <li key={o} className="flex gap-2 text-body"><CheckCircle weight="duotone" className="mt-0.5 size-5 shrink-0 text-[var(--sport)]" />{o}</li>)}</ul>
            <ul className="space-y-2 border-t border-line pt-3 text-sm text-body">
              <li>Tu coach con ropa de {info.name.toLowerCase()}, consejos y comida para tu deporte.</li>
              <li>2 a 4 sesiones por semana de 30, 45 o 60 minutos, en gimnasio o en casa.</li>
              <li>Descarga en la semana 4 y antes de tu competencia.</li>
            </ul>
          </div>
        </section>
      )}
      {c?.safetyNote && <p className="flex gap-2 text-sm text-muted"><ShieldWarning weight="duotone" className="mt-0.5 size-5 shrink-0" />{c.safetyNote}</p>}
    </div>
  );
}
