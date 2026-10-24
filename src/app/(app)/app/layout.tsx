import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { after } from "next/server";
import { AppNav } from "@/components/app-nav";
import { DemoBanner } from "@/components/brand";
import { InstallPrompt } from "@/components/install-prompt";
import { TzSync } from "@/components/tz-sync";
import { ConnectionStatus } from "@/components/offline/connection-status";
import { UpdatePrompt } from "@/components/offline/update-prompt";
import { deployId } from "@/lib/version";
import { getEntitlements } from "@/lib/entitlements";
import { getViewer, STAFF } from "@/lib/supabase/server";
import { PlanGate } from "./suscripcion/plan-wall";
import { LevelWatcher } from "@/components/levels/level-up";
import { getXpTotal } from "@/lib/xp-server";
import { levelOf } from "@/lib/gamify";
import { TrialBanner } from "./suscripcion/trial-banner";
import { BetaBanner } from "@/components/beta-notice";
import { betaLive } from "@/lib/plans";
import { getActiveProgram } from "@/lib/programs-server";
import { ProgramRibbon } from "@/components/programas/program-ribbon";
import { COVER_ACCENT } from "@/components/retos/cover";
import { GiftCelebration } from "@/components/gift-celebration";
import { deliverPendingGifts, getUnseenGifts } from "@/lib/gifts-server";
import { TesterCelebration } from "@/components/testers/tester-celebration";
import { deliverTesterNotices, getMyTester } from "@/lib/testers-server";
import { AddCardBanner, FailedBanner, ProcessingBanner, ScheduledBanner } from "@/components/card-banner";
import { bannerFor } from "@/lib/trial";
import { demoCardState } from "@/lib/trial-demo";
import { runDueForUser } from "@/lib/trial-billing";
import { GuideProvider } from "@/components/guide/guide-provider";
import { getGuideState } from "@/lib/guide-server";
import type { GuideInput } from "@/lib/guide";
import { NewsLauncher } from "@/components/novedades/news-dialog";
import { getNewsState } from "@/lib/novedades-server";
import { NEWS_STAFF_ROLES, newsView } from "@/lib/novedades";
import { coachOf } from "@/lib/coaches";
import { getSex } from "@/lib/athlete";

export const dynamic = "force-dynamic";

const fmtDay = (iso: string, tz: string) => { try { return new Date(iso).toLocaleDateString("es-419", { day: "numeric", month: "long", timeZone: tz }); } catch { return null; } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const v = await getViewer();
  if (!v) redirect("/entrar?next=/app");
  if (!v.onboarded) redirect("/bienvenida");
  const [ent, xp, prog, unseen, tester, guide, newsState] = await Promise.all([getEntitlements(v), getXpTotal(v).catch(() => null), getActiveProgram(v).catch(() => null), getUnseenGifts(v).catch(() => ({ gifts: [], undelivered: false })), getMyTester(v).catch(() => null), getGuideState(v).catch(() => ({ seenVersion: null, tips: [], persisted: false })), getNewsState(v).catch(() => ({ seenId: null, seenAt: null, createdAt: null, persisted: false }))]);
  // Un regalo creado por la base (recompensa de referidos) todavía sin correo ni push: se manda después de responder.
  // Programa activo: solo con acceso a la app (sin acceso queda guardado y vuelve al renovar).
  const live = prog && ent.app ? prog : null;
  if (unseen.undelivered) after(() => deliverPendingGifts({ userId: v.id, limit: 5 }).then(() => {}));
  // Tester (0029): correo y push de la asignación, aviso de 3 días antes y agradecimiento al terminar, si faltan.
  if (tester?.pending) after(() => deliverTesterNotices({ userId: v.id, limit: 5 }).then(() => {}));
  // Un aviso grande a la vez: primero el regalo, la bienvenida de tester en la próxima visita.
  const testerWelcome = tester?.unseenId && !unseen.gifts.length ? tester.until : null;
  // Tarjeta guardada (0026): en demo, el estado de ejemplo. Revisión al abrir la app: si el cobro ya tocaba (o el aviso
  // del día 5, o hay que confirmar uno en curso), se hace después de responder. El cron diario es el respaldo.
  const cs = v.demo ? demoCardState((await cookies()).get("bb_demo_tarjeta")?.value) : null;
  const charge = cs ? cs.charge : ent.charge ?? null;
  const cardStep = cs ? cs.cardStep : ent.cardStep ?? "none";
  const trial = cs ? cs.trial : ent.trial;
  // En demo, los estados de ejemplo con el muro (?demo=fallo|vencida) también lo muestran.
  const locked = ent.locked || Boolean(cs?.locked);
  if (!v.demo && ent.charge && (ent.charge.due || ent.charge.remind || ent.charge.phase === "procesando")) after(() => runDueForUser(v.id).then(() => {}));
  // Guía de la app: cambia con el plan, la prueba y el programa activo (lib/guide.ts).
  const px = live?.c.program.experience ?? null;
  const liveCoach = live ? coachOf(px) : null;
  const guideInput: GuideInput = {
    name: v.name, plan: ent.plan, nutrition: ent.nutrition, cardStep,
    trial: trial ? { beta: Boolean(trial.beta), endsAt: trial.endsAt, daysLeft: trial.daysLeft } : null,
    charge: charge ? { kind: charge.kind, phase: charge.phase, plan: charge.plan, amount: charge.amount, chargeAt: charge.chargeAt } : null,
    program: live ? { slug: live.c.id, title: live.c.title, mode: px?.mode ?? null, welcome: px?.welcome ?? null, habits: px?.habits.map((h) => h.label) ?? [], hasTips: Boolean(px?.tips.length), week: live.run.week, weeks: live.run.weeks, ...(live.run.byDays ? { day: Math.min(live.run.days, live.run.effectiveDay + 1), days: live.run.days } : {}), coach: liveCoach && liveCoach.id !== "banana" ? liveCoach.name : null, cover: live.c.cover, icon: live.c.icon } : null,
  };
  // Novedades (0036): lo que cambió desde la última visita, según el plan. Espera su turno detrás de la guía y las celebraciones.
  const news = newsView({ nutrition: ent.nutrition, plan: ent.plan, program: Boolean(live), staff: NEWS_STAFF_ROLES.includes(v.role) }, newsState);
  const banner = bannerFor({ betaLive: betaLive(), fromSubscription: ent.fromSubscription, cardStep, charge, trial: Boolean(trial) });
  return (
    <div className="lg:pl-64" style={live ? ({ "--program": COVER_ACCENT[live.c.cover] } as React.CSSProperties) : undefined}>
      {/* Programa activo: la app toma su color en una franja arriba (y en la cinta y los hábitos). */}
      {live && <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-1 bg-[var(--program)]" />}
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-full focus:bg-ink focus:text-white focus:px-4 focus:py-2">Saltar al contenido</a>
      {v.demo && <DemoBanner />}
      <AppNav name={v.name} staff={STAFF.includes(v.role)} nutrition={ent.nutrition} program={live ? { slug: live.c.id, title: live.c.title, mode: live.c.program.experience?.mode ?? null } : null} coachName={liveCoach && liveCoach.id !== "banana" ? liveCoach.name : null} news={{ latestId: news.latestId, unseen: news.unseenIds.length > 0, persisted: newsState.persisted }} />
      <InstallPrompt />
      <TzSync current={v.tz} />
      <ConnectionStatus />
      <UpdatePrompt version={deployId()} />
      {xp !== null && <LevelWatcher uid={v.id} idx={levelOf(xp).idx} sex={await getSex(v).catch(() => null)} />}
      <GiftCelebration gifts={unseen.gifts} demo={v.demo} />
      <TesterCelebration until={testerWelcome} renewal={tester?.renewal} demo={v.demo} />
      <GuideProvider input={guideInput} seenVersion={guide.seenVersion} tips={guide.tips} persisted={guide.persisted} locked={locked} busy={unseen.gifts.length > 0 || !!testerWelcome} demo={v.demo} tz={v.tz}>
      <NewsLauncher releases={news.releases} seenId={newsState.seenId} seenAt={newsState.seenAt} createdAt={newsState.createdAt} persisted={newsState.persisted} locked={locked} busy={unseen.gifts.length > 0 || !!testerWelcome} demo={v.demo} guideSeenVersion={guide.seenVersion} />
      <main id="contenido" tabIndex={-1} className="block mx-auto max-w-5xl min-w-0 overflow-x-clip px-4 sm:px-8 outline-none pt-6 sm:pt-10 pb-32 lg:pb-16">
        {live && <ProgramRibbon p={{ slug: live.c.id, title: live.c.title, mode: live.c.program.experience?.mode ?? "Programa activo", cover: live.c.cover, icon: live.c.icon, at: live.run.today === "terminado" ? "tu certificado te espera" : live.run.byDays ? `día ${Math.min(live.run.days, live.run.effectiveDay + 1)} de ${live.run.days}` : `semana ${live.run.week} de ${live.run.weeks}`, avatar: liveCoach && liveCoach.id !== "banana" ? liveCoach.avatar : null }} />}
        {banner === "beta-add" ? <AddCardBanner />
          : banner === "beta-scheduled" && charge ? <ScheduledBanner charge={charge} tz={v.tz} />
          : banner === "failed" && charge ? <FailedBanner charge={charge} tz={v.tz} />
          : banner === "processing" ? <ProcessingBanner />
          : banner === "beta" ? <BetaBanner />
          : banner === "trial" && trial ? <TrialBanner daysLeft={trial.daysLeft} charge={charge && (charge.phase === "programado" || charge.phase === "cancelado") ? { amount: charge.amount, canceled: charge.phase === "cancelado" } : null} />
          : null}
        <PlanGate locked={locked} trialEndedOn={ent.locked && ent.trialEndsAt ? fmtDay(ent.trialEndsAt, v.tz) : null} cardStep={cardStep} chargePhase={charge?.phase ?? null}>{children}</PlanGate>
      </main>
      </GuideProvider>
    </div>
  );
}
