import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/supabase/server";
import { getCatalog, getMyChallenges, getOwned, getParticipants, getPlan, levelPerks } from "@/lib/challenges-server";
import { todayMetrics } from "@/lib/metrics";
import { todayFor } from "@/lib/today";
import { DIFFICULTY_LABEL, MAX_ACTIVE, milestonesFor, openState, priceMinor, usd, VERIFY_LABEL } from "@/lib/challenges";
import { CHALLENGE_DAY_XP, MILESTONE_XP } from "@/lib/gamify";
import { toView } from "@/lib/challenge-view";
import { ChallengeCard, JoinButton } from "@/components/challenge-card";
import { ChallengeCover, coverInk } from "@/components/retos/cover";
import { BuyButton } from "@/components/retos/buy-button";
import { MIN_PARTICIPANTS_SHOWN } from "@/components/retos/store-card";
import { ArrowLeft, BananaMedal, CalendarCheck, CheckCircle, Clock, Flag, Info, Lock, Shield, Target, Users, WarningCircle } from "@/components/icons";

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: P) {
  const { slug } = await params;
  const v = await getViewer();
  const c = v ? (await getCatalog(v.demo)).get(slug) : undefined;
  return { title: c ? c.title : "Reto" };
}

const fmtStart = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("es-419", { weekday: "long", day: "numeric", month: "long" });
const TYPE_LABEL: Record<string, string> = { reps: "Repeticiones", tiempo: "Tiempo", pasos: "Pasos", entreno: "Entreno", habito: "Hábito", nutricion: "Comida", descanso: "Descanso" };

export default async function RetoDetalle({ params }: P) {
  const { slug } = await params;
  const v = (await getViewer())!;
  const today = todayFor(v).iso;
  const [catalog, owned, participants, perks, mine] = await Promise.all([getCatalog(v.demo), getOwned(v), getParticipants(v), levelPerks(v), getMyChallenges(v, await todayMetrics(v))]);
  const c = catalog.get(slug);
  const myActive = mine.active.find((m) => m.c.id === slug);
  if (!c || (c.status !== "publicado" && !myActive)) notFound();

  const isOwned = owned.has(c.id);
  const paid = c.priceUsd > 0;
  const plan = await getPlan(v, c, isOwned || !!myActive);
  const open = openState(c, today);
  const full = mine.active.length >= MAX_ACTIVE;
  const n = participants.get(c.id) ?? 0;
  const ink = coverInk(c.cover);
  const listMinor = priceMinor(c.priceUsd, 0), finalMinor = priceMinor(c.priceUsd, perks.discountPct);
  const graceTotal = Math.min(c.days - 1, c.grace + perks.extraGrace);
  const lockedDays = plan.locked ? c.days - plan.days.length : 0;
  const ms = milestonesFor(c.days);
  const completedBefore = mine.done.filter((d) => d.c.id === c.id).length;

  let cta: React.ReactNode;
  if (myActive) cta = <a href="#mi-progreso" className="btn-primary h-12 w-full">Ver mi progreso de hoy</a>;
  else if (paid && !isOwned && open !== "cerrado") cta = (
    <>
      <BuyButton slug={c.id} label={`Comprar por ${usd(finalMinor)}`} />
      <p className="mt-2 text-center text-xs text-muted">{finalMinor < listMinor ? `Precio normal ${usd(listMinor)}. Tu nivel ${perks.level.n} te da ${perks.discountPct}% de descuento. ` : ""}Pago único con tarjeta en USD, procesado por ONVO Pay.{open === "pronto" ? " Puedes comprarlo ya y empezarlo cuando abra." : ""}</p>
    </>
  );
  else if (open === "pronto") cta = <p className="rounded-2xl bg-sky/10 p-3 text-center text-sm font-bold text-sky">{c.startDate ? `Abre el ${fmtStart(c.startDate)}` : "Muy pronto"}</p>;
  else if (open === "cerrado") cta = <p className="rounded-2xl bg-cream p-3 text-center text-sm font-semibold text-muted">Las inscripciones de esta edición ya cerraron.</p>;
  else if (full) cta = <p className="rounded-2xl bg-cream p-3 text-center text-sm text-muted">Ya tienes {MAX_ACTIVE} retos en curso. Termina o abandona uno para empezar este.</p>;
  else cta = <JoinButton id={c.id} title={c.title} label={paid ? (completedBefore ? "Repetir reto" : "Empezar reto") : "Unirme gratis"} className="btn-primary h-12 w-full text-base" info={{ cover: c.cover, icon: c.icon, days: c.days, firstTask: plan.days[0]?.t }} />;

  const priceCard = (
    <section className="card p-5" aria-label="Precio">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold text-muted">{paid ? "Pago único" : "Precio"}</p>
              {paid ? (isOwned ? <p className="inline-flex items-center gap-1 text-lg font-extrabold text-peel"><CheckCircle weight="fill" className="size-5" />Ya es tuyo</p> : <p className="tabular-nums">{finalMinor < listMinor && <s className="mr-1.5 text-sm text-faint">{usd(listMinor)}</s>}<span className="text-2xl font-extrabold text-ink">{usd(finalMinor)}</span> <span className="text-xs font-semibold text-muted">USD</span></p>) : <p className="text-2xl font-extrabold text-peel">Gratis</p>}
            </div>
            <div className="mt-4">{cta}</div>
          </section>
  );

  return (
    <div className="space-y-6 animate-enter">
      <Link href="/app/retos" className="tap inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft weight="bold" className="size-4" />Tienda de retos</Link>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
        <div className="space-y-6">
          <header className="overflow-hidden rounded-[1.75rem] shadow-soft">
            <ChallengeCover c={c} className="h-44 sm:h-52">
              <div className="absolute inset-x-0 bottom-0 p-5">
                <p className={`text-xs font-extrabold uppercase tracking-[.14em] opacity-85 ${ink}`}>{paid ? "Premium" : "Gratis"}{c.featured ? ", destacado" : ""}</p>
                <h1 className={`mt-1 text-3xl sm:text-4xl font-extrabold leading-tight tracking-tight text-balance ${ink}`}>{c.title}</h1>
              </div>
            </ChallengeCover>
          </header>

          <ul className="flex flex-wrap gap-2 text-xs font-bold text-ink/85">
            <li className="chip h-8 bg-white border border-line"><CalendarCheck weight="duotone" className="size-4" />{c.days} días</li>
            <li className="chip h-8 bg-white border border-line"><Target weight="duotone" className="size-4" />{DIFFICULTY_LABEL[c.difficulty]}</li>
            <li className="chip h-8 bg-white border border-line"><Clock weight="duotone" className="size-4" />{c.minutes} min al día</li>
            <li className="chip h-8 bg-white border border-line"><CheckCircle weight="duotone" className="size-4" />{VERIFY_LABEL[c.verify]}</li>
            {n >= MIN_PARTICIPANTS_SHOWN && <li className="chip h-8 bg-white border border-line"><Users weight="duotone" className="size-4" />{n.toLocaleString("es-419")} personas en el reto</li>}
          </ul>

          <p className="text-[17px] leading-relaxed text-body">{c.desc}</p>

          {/* En móvil el precio y el botón van arriba, antes del plan; en escritorio quedan en la columna lateral. */}
          <div className="lg:hidden">{priceCard}</div>

          {c.safetyNote && (
            <p className="flex gap-2.5 rounded-2xl border border-sky/25 bg-sky/5 p-4 text-sm text-body"><Info weight="duotone" className="mt-0.5 size-5 shrink-0 text-sky" /><span><b className="text-ink">Antes de empezar.</b> {c.safetyNote}</span></p>
          )}

          {myActive && (
            <section id="mi-progreso" className="scroll-mt-6 space-y-3" aria-label="Mi progreso">
              <h2 className="text-xl font-extrabold text-ink">Mi progreso</h2>
              <ChallengeCard v={toView(myActive)} />
            </section>
          )}

          <section aria-labelledby="plan-t" className="space-y-3">
            <h2 id="plan-t" className="text-xl font-extrabold text-ink">Qué haces cada día</h2>
            {plan.days.length ? (
              <ol className="overflow-hidden rounded-2xl border border-line bg-white">
                {plan.days.map((d, i) => (
                  <li key={i} className="flex gap-3 border-b border-line p-3.5 last:border-0">
                    <span className={`grid size-9 shrink-0 place-items-center rounded-xl text-sm font-extrabold tabular-nums ${ms.includes(i + 1) ? "bg-ember text-ink" : d.type === "descanso" ? "bg-sky/10 text-sky" : "bg-banana-soft text-banana-ink"}`}>{i + 1}</span>
                    <span className="min-w-0"><span className="block text-[11px] font-bold uppercase tracking-[.1em] text-muted">{TYPE_LABEL[d.type] ?? "Día"}{ms.includes(i + 1) ? (i + 1 === c.days ? ", día final" : ", hito") : ""}</span><span className="block text-sm font-semibold text-ink">{d.t}</span></span>
                  </li>
                ))}
                {lockedDays > 0 && (
                  <li className="relative p-4">
                    <div aria-hidden className="space-y-2 blur-[3px] select-none">
                      {[0, 1].map((k) => <div key={k} className="flex gap-3"><span className="size-9 rounded-xl bg-cream" /><span className="flex-1 space-y-1.5 pt-1"><span className="block h-2.5 w-24 rounded bg-line" /><span className="block h-3 w-4/5 rounded bg-line" /></span></div>)}
                    </div>
                    <p className="absolute inset-0 grid place-items-center px-4 text-center text-sm font-extrabold text-ink"><span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-soft"><Lock weight="fill" className="size-4" />Días {plan.days.length + 1} a {c.days} al comprar</span></p>
                  </li>
                )}
              </ol>
            ) : <p className="text-sm text-muted">El plan de este reto se está preparando.</p>}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="hidden lg:block">{priceCard}</div>
          <section className="card p-5" aria-labelledby="premios-t">
            <h2 id="premios-t" className="flex items-center gap-2 font-extrabold text-ink"><BananaMedal className="size-6 text-banana-ink" />Recompensas</h2>
            <ul className="mt-3 space-y-2.5 text-sm">
              {ms.filter((d) => d < c.days).map((d) => <li key={d} className="flex gap-2"><Flag weight="duotone" className="mt-0.5 size-4 shrink-0 text-ember-ink" /><span>Hito del día {d} cumplido: <b>+{MILESTONE_XP} XP</b></span></li>)}
              <li className="flex gap-2"><BananaMedal className="mt-0.5 size-4 shrink-0 text-banana-ink" /><span>Al terminar: <b>+{c.xp.toLocaleString("es-419")} XP</b>, medalla <b>{c.badge}</b> y certificado en tu perfil{c.rewardTitle ? <>, más el título <b>{c.rewardTitle}</b></> : ""}</span></li>
              {c.verify === "manual" && <li className="flex gap-2"><CheckCircle weight="duotone" className="mt-0.5 size-4 shrink-0 text-peel" /><span>Cada día que marcas: <b>+{CHALLENGE_DAY_XP} XP</b></span></li>}
            </ul>
          </section>

          <section className="card p-5" aria-labelledby="reglas-t">
            <h2 id="reglas-t" className="flex items-center gap-2 font-extrabold text-ink"><Shield weight="duotone" className="size-5 text-sky" />Reglas</h2>
            <ul className="mt-3 space-y-2 text-sm text-body">
              <li>{c.verify === "manual" ? "Marcas cada día con el botón Hecho, solo el día de hoy." : `Se marca solo: ${VERIFY_LABEL[c.verify].toLowerCase()}${c.verify === "steps" ? ` (${(c.stepsGoal ?? 10000).toLocaleString("es-419")} pasos)` : ""}.`}</li>
              <li>{graceTotal === 0 ? "Sin comodines: cada día cuenta." : <>Tienes <b>{graceTotal} {graceTotal === 1 ? "comodín" : "comodines"}</b>{perks.extraGrace > 0 ? ` (incluye ${perks.extraGrace} extra por tu nivel)` : ""}: días que puedes fallar sin perder el reto.</>}</li>
              <li>Para la medalla necesitas {c.days - graceTotal} de {c.days} días cumplidos.</li>
              <li>Máximo {MAX_ACTIVE} retos en curso a la vez.</li>
              {c.startMode === "fecha" && c.startDate && <li>Empieza el {fmtStart(c.startDate)}; puedes unirte durante sus primeros 3 días.</li>}
            </ul>
            {paid && !isOwned && <p className="mt-3 flex gap-2 text-xs text-muted"><WarningCircle weight="duotone" className="size-4 shrink-0" />El reto se activa en tu cuenta cuando ONVO confirma el pago, normalmente en segundos.</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}
