import Link from "next/link";
import { getViewer } from "@/lib/supabase/server";
import { getSex } from "@/lib/athlete";
import { getCatalog, getMyChallenges, getOwned, getParticipants, levelPerks } from "@/lib/challenges-server";
import { getActiveProgram, getProgramSessions, getProgramStates, type ProgramChallenge } from "@/lib/programs-server";
import { todayMetrics } from "@/lib/metrics";
import { todayFor } from "@/lib/today";
import { MAX_ACTIVE, isProgram, storeSection, type Challenge, type StoreSection } from "@/lib/challenges";
import { daysLabel, durationLabel } from "@/lib/programs";
import { toEndedView, toView } from "@/lib/challenge-view";
import { ChallengeCard, EndedChallengeCard } from "@/components/challenge-card";
import { StoreCard } from "@/components/retos/store-card";
import { Certificates } from "@/components/retos/certificates";
import { ChallengeCover, coverInk } from "@/components/retos/cover";
import { ProgramCard } from "@/components/programas/program-card";
import { weekLabel } from "@/components/programas/program-hero";
import { ProgressBar } from "@/components/progress-bar";
import { LevelBadge } from "@/components/levels/level-badge";
import { ArrowRight, BananaTrophy, BrandIcon, Lock, Pause, Sparkle } from "@/components/icons";

export const metadata = { title: "Programas y retos" };

const SECTIONS: { key: Exclude<StoreSection, "programas">; title: string; desc: string }[] = [
  { key: "gratis", title: "Retos gratis", desc: "Un hábito diario con check-in y racha. Incluidos con tu plan o tu prueba gratis. No cambian tu rutina." },
  { key: "premium", title: "Retos Premium", desc: "Pago único en USD, aparte de tu plan. Son tuyos para siempre y puedes repetirlos." },
  { key: "proximamente", title: "Próximamente", desc: "Con fecha de inicio para hacerlos en grupo." },
];

export default async function Retos() {
  const v = (await getViewer())!;
  const today = todayFor(v).iso;
  const [{ active, done, ended }, catalog, owned, participants, perks, states, activeProgram] = await Promise.all([
    todayMetrics(v).then((m) => getMyChallenges(v, m)), getCatalog(v.demo), getOwned(v), getParticipants(v), levelPerks(v), getProgramStates(v), getActiveProgram(v),
  ]);
  const activeIds = new Set(active.map((a) => a.c.id));
  const list = [...catalog.values()].sort((a, b) => Number(b.featured) - Number(a.featured) || a.sort - b.sort);
  const by = (k: StoreSection) => list.filter((c) => storeSection(c, today) === k);
  // Para ella, primero los programas de chicas (con Coach Platanita); el resto, en el orden del panel.
  const girlFirst = (await getSex(v)) === "f";
  const girls = (c: ProgramChallenge) => Number(c.program.experience?.coach === "platanita");
  const programs = (by("programas").filter(isProgram) as ProgramChallenge[]).map((c, i) => ({ c, i })).sort((a, b) => (girlFirst ? girls(b.c) - girls(a.c) : 0) || a.i - b.i).map((x) => x.c);
  const stateOf = new Map(states.map((s) => [s.slug, s]));
  const sessions = await Promise.all(programs.map((c) => getProgramSessions(v, c.id)));
  const days = new Map(programs.map((c, i) => [c.id, daysLabel(c.program, sessions[i])]));
  const paused = states.filter((s) => s.status === "pausado").map((s) => ({ s, c: catalog.get(s.slug) })).filter((x): x is { s: typeof x.s; c: Challenge } => !!x.c);
  const ownedIdle = list.filter((c) => c.kind !== "programa" && c.priceUsd > 0 && owned.has(c.id) && !activeIds.has(c.id));
  const certs = [
    ...done,
    ...states.filter((s) => s.status === "completado" && s.completedAt).map((s) => ({ c: catalog.get(s.slug), at: String(s.completedAt).slice(0, 10) }))
      .filter((x): x is { c: Challenge; at: string } => !!x.c && isProgram(x.c)).map((x) => ({ ...x, span: durationLabel(x.c.program!) })),
  ];
  const card = (c: Challenge) => <StoreCard key={c.id} className="w-[80%] max-w-80 shrink-0 snap-start focus-visible:ring-4 focus-visible:ring-banana/60 sm:w-auto sm:max-w-none" c={c} owned={owned.has(c.id)} participants={participants.get(c.id)} discountPct={perks.discountPct} active={activeIds.has(c.id)} />;
  const ap = activeProgram;

  return (
    <div className="space-y-8 animate-enter">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">Programas y retos</p>
          <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight text-ink text-balance">Elige tu próxima transformación</h1>
          <p className="mt-1 max-w-[60ch] text-muted">Un programa toma el control de tu entreno por unas semanas, con un objetivo concreto. Los retos suman un hábito cada día.</p>
        </div>
        <Link href="/app/niveles" className="pressable inline-flex h-12 items-center gap-2 rounded-2xl border border-line bg-white pl-1.5 pr-3 text-sm font-bold text-ink hover:border-ink/25">
          <LevelBadge idx={perks.level.idx} size="sm" />
          <span className="min-w-0"><span className="block leading-tight">{perks.level.n}</span><span className="block text-[11px] font-semibold text-muted">{perks.discountPct > 0 ? `${perks.discountPct}% en Premium` : perks.extraGrace > 0 ? `+${perks.extraGrace} comodín por nivel` : "Sube de nivel para descuentos"}</span></span>
        </Link>
      </header>

      {ap && (
        <section aria-labelledby="mi-programa" className="overflow-hidden rounded-[1.75rem] shadow-soft">
          <h2 id="mi-programa" className="sr-only">Tu programa activo</h2>
          <ChallengeCover c={ap.c} chip={false} className="p-5 sm:p-6">
            <div className={`relative ${coverInk(ap.c.cover)}`}>
              <p className="inline-flex h-7 items-center gap-1.5 rounded-full bg-ink px-2.5 text-[11px] font-extrabold uppercase tracking-[.1em] text-banana"><BrandIcon name={ap.c.icon} className="size-3.5" />Programa activo</p>
              <p className="mt-3 text-2xl font-extrabold leading-tight tracking-tight text-balance">{ap.c.title}</p>
              <p className="mt-1 text-sm font-bold opacity-85">{weekLabel(ap)}. {ap.run.sessionsDone} de {ap.run.sessionsTotal} sesiones</p>
              <ProgressBar value={ap.run.pct} min={0.03} className="mt-3 h-2.5" track="bg-white/25" fill={ap.c.cover === "noche" ? "bg-banana" : "bg-ink"} label={`${Math.round(ap.run.pct * 100)} % del programa`} />
            </div>
          </ChallengeCover>
          <div className="flex flex-wrap gap-2 bg-cream p-4 sm:px-6">
            <Link href="/app/entrenar" className="btn-primary h-12 px-5">Ver la semana<ArrowRight weight="bold" className="size-4" /></Link>
            <Link href={`/app/retos/${ap.c.id}/progreso`} className="btn-ghost h-12 px-5">Avance y opciones</Link>
          </div>
        </section>
      )}
      {paused.length > 0 && (
        <ul className="space-y-2">
          {paused.map(({ s, c }) => (
            <li key={s.slug}><Link href={`/app/retos/${c.id}`} className="card flex items-center gap-3 p-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-cream text-ink"><Pause weight="duotone" className="size-5" /></span><span className="min-w-0 flex-1"><span className="block font-extrabold text-ink">{c.title}</span><span className="block text-sm text-muted">En pausa con tu avance guardado. Reanúdalo cuando quieras.</span></span><ArrowRight weight="bold" className="size-4 shrink-0 text-faint" /></Link></li>
          ))}
        </ul>
      )}

      {programs.length > 0 && (
        <section className="space-y-3" aria-labelledby="sec-programas">
          <div>
            <h2 id="sec-programas" className="flex items-center gap-2 text-xl font-extrabold text-ink"><Sparkle weight="duotone" className="size-5 text-banana-ink" />Programas</h2>
            <p className="max-w-[65ch] text-sm text-muted">Al empezarlo, tu entreno de cada día sale del programa: ejercicios, series, descansos y cargas que suben solas. Pago único, aparte de tu plan.{perks.discountPct > 0 ? ` Tu nivel ${perks.level.n} te da ${perks.discountPct}% de descuento.` : ""}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 [&>*]:min-w-0">
            {programs.map((c, i) => <ProgramCard key={c.id} c={c} big={i === 0 && c.featured} owned={owned.has(c.id)} discountPct={perks.discountPct} status={(stateOf.get(c.id)?.status as "activo" | "pausado" | "completado" | undefined) ?? null} days={days.get(c.id) ?? ""} />)}
          </div>
        </section>
      )}

      <section className="space-y-3" aria-labelledby="mis-retos">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="mis-retos" className="text-xl font-extrabold text-ink">Mis retos</h2>
          <span className="text-sm font-semibold text-muted tabular-nums">{active.length} de {MAX_ACTIVE} en curso</span>
        </div>
        {active.length ? (
          <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">{active.map((m) => <ChallengeCard key={m.ucId} v={toView(m)} />)}</div>
        ) : (
          <div className="card flex items-center gap-3 p-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-banana-soft text-banana-ink"><BananaTrophy className="size-7" /></span><p className="text-sm text-muted">Todavía no tienes retos en curso. Empieza con uno gratis de abajo: el día 1 es hoy. Puedes hacerlos junto con un programa.</p></div>
        )}
        {active.length >= MAX_ACTIVE && <p className="rounded-2xl bg-cream p-3 text-sm text-muted">Ya tienes {MAX_ACTIVE} retos en curso. Termina o abandona uno para empezar otro.</p>}
        {ownedIdle.length > 0 && (
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="flex items-center gap-2 text-sm font-extrabold text-ink"><Lock weight="duotone" className="size-4 text-peel" />Retos Premium que ya son tuyos</p>
            <ul className="mt-2 flex flex-wrap gap-2">{ownedIdle.map((c) => <li key={c.id}><Link href={`/app/retos/${c.id}`} className="pressable inline-flex h-11 items-center gap-1.5 rounded-full bg-cream px-4 text-sm font-bold text-ink hover:bg-banana-soft">{c.title}<ArrowRight weight="bold" className="size-3.5" /></Link></li>)}</ul>
          </div>
        )}
        {ended.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-extrabold text-ink">Para volver a intentar</h3>
            <div className="grid gap-3 lg:grid-cols-2">{ended.map((e) => <EndedChallengeCard key={e.ucId} e={toEndedView(e)} />)}</div>
          </div>
        )}
      </section>

      {SECTIONS.map((s) => {
        const items = by(s.key);
        if (!items.length) return null;
        return (
          <section key={s.key} className="space-y-3" aria-labelledby={`sec-${s.key}`}>
            <div>
              <h2 id={`sec-${s.key}`} className="text-xl font-extrabold text-ink">{s.title}</h2>
              <p className="text-sm text-muted">{s.desc}</p>
            </div>
            {/* Móvil: carrusel deslizable dentro de la sección (la página no se desborda); desde sm, rejilla. */}
            <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">{items.map(card)}</div>
            {items.length > 1 && <p className="text-xs text-muted sm:hidden">Desliza para ver los {items.length} retos.</p>}
          </section>
        );
      })}

      <Certificates done={certs} />
    </div>
  );
}
