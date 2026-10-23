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
import { AddCardBanner, FailedBanner, ProcessingBanner, ScheduledBanner } from "@/components/card-banner";
import { bannerFor } from "@/lib/trial";
import { demoCardState } from "@/lib/trial-demo";
import { runDueForUser } from "@/lib/trial-billing";

export const dynamic = "force-dynamic";

const fmtDay = (iso: string, tz: string) => { try { return new Date(iso).toLocaleDateString("es-419", { day: "numeric", month: "long", timeZone: tz }); } catch { return null; } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const v = await getViewer();
  if (!v) redirect("/entrar?next=/app");
  if (!v.onboarded) redirect("/bienvenida");
  const [ent, xp, prog, unseen] = await Promise.all([getEntitlements(v), getXpTotal(v).catch(() => null), getActiveProgram(v).catch(() => null), getUnseenGifts(v).catch(() => ({ gifts: [], undelivered: false }))]);
  // Un regalo creado por la base (recompensa de referidos) todavía sin correo ni push: se manda después de responder.
  // Programa activo: solo con acceso a la app (sin acceso queda guardado y vuelve al renovar).
  const live = prog && ent.app ? prog : null;
  if (unseen.undelivered) after(() => deliverPendingGifts({ userId: v.id, limit: 5 }).then(() => {}));
  // Tarjeta guardada (0026): en demo, el estado de ejemplo. Revisión al abrir la app: si el cobro ya tocaba (o el aviso
  // del día 5, o hay que confirmar uno en curso), se hace después de responder. El cron diario es el respaldo.
  const cs = v.demo ? demoCardState((await cookies()).get("bb_demo_tarjeta")?.value) : null;
  const charge = cs ? cs.charge : ent.charge ?? null;
  const cardStep = cs ? cs.cardStep : ent.cardStep ?? "none";
  const trial = cs ? cs.trial : ent.trial;
  if (!v.demo && ent.charge && (ent.charge.due || ent.charge.remind || ent.charge.phase === "procesando")) after(() => runDueForUser(v.id).then(() => {}));
  const banner = bannerFor({ betaLive: betaLive(), fromSubscription: ent.fromSubscription, cardStep, charge, trial: Boolean(trial) });
  return (
    <div className="lg:pl-64" style={live ? ({ "--program": COVER_ACCENT[live.c.cover] } as React.CSSProperties) : undefined}>
      {/* Programa activo: la app toma su color en una franja arriba (y en la cinta y los hábitos). */}
      {live && <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-1 bg-[var(--program)]" />}
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-full focus:bg-ink focus:text-white focus:px-4 focus:py-2">Saltar al contenido</a>
      {v.demo && <DemoBanner />}
      <AppNav name={v.name} staff={STAFF.includes(v.role)} nutrition={ent.nutrition} program={live ? { slug: live.c.id, title: live.c.title, mode: live.c.program.experience?.mode ?? null } : null} />
      <InstallPrompt />
      <TzSync current={v.tz} />
      <ConnectionStatus />
      <UpdatePrompt version={deployId()} />
      {xp !== null && <LevelWatcher uid={v.id} idx={levelOf(xp).idx} />}
      <GiftCelebration gifts={unseen.gifts} demo={v.demo} />
      <main id="contenido" tabIndex={-1} className="block mx-auto max-w-5xl min-w-0 overflow-x-clip px-4 sm:px-8 outline-none pt-6 sm:pt-10 pb-32 lg:pb-16">
        {live && <ProgramRibbon p={{ slug: live.c.id, title: live.c.title, mode: live.c.program.experience?.mode ?? "Programa activo", cover: live.c.cover, icon: live.c.icon, week: live.run.week, weeks: live.run.weeks }} />}
        {banner === "beta-add" ? <AddCardBanner />
          : banner === "beta-scheduled" && charge ? <ScheduledBanner charge={charge} tz={v.tz} />
          : banner === "failed" && charge ? <FailedBanner charge={charge} tz={v.tz} />
          : banner === "processing" ? <ProcessingBanner />
          : banner === "beta" ? <BetaBanner />
          : banner === "trial" && trial ? <TrialBanner daysLeft={trial.daysLeft} charge={charge && (charge.phase === "programado" || charge.phase === "cancelado") ? { amount: charge.amount, canceled: charge.phase === "cancelado" } : null} />
          : null}
        <PlanGate locked={ent.locked} trialEndedOn={ent.locked && ent.trialEndsAt ? fmtDay(ent.trialEndsAt, v.tz) : null} cardStep={cardStep} chargePhase={charge?.phase ?? null}>{children}</PlanGate>
      </main>
    </div>
  );
}
