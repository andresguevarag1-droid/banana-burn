import { redirect } from "next/navigation";
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
import { GiftCelebration } from "@/components/gift-celebration";
import { deliverPendingGifts, getUnseenGifts } from "@/lib/gifts-server";

export const dynamic = "force-dynamic";

const fmtDay = (iso: string, tz: string) => { try { return new Date(iso).toLocaleDateString("es-419", { day: "numeric", month: "long", timeZone: tz }); } catch { return null; } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const v = await getViewer();
  if (!v) redirect("/entrar?next=/app");
  if (!v.onboarded) redirect("/bienvenida");
  const [ent, xp, prog, unseen] = await Promise.all([getEntitlements(v), getXpTotal(v).catch(() => null), getActiveProgram(v).catch(() => null), getUnseenGifts(v).catch(() => ({ gifts: [], undelivered: false }))]);
  // Un regalo creado por la base (recompensa de referidos) todavía sin correo ni push: se manda después de responder.
  if (unseen.undelivered) after(() => deliverPendingGifts({ userId: v.id, limit: 5 }).then(() => {}));
  return (
    <div className="lg:pl-64">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-full focus:bg-ink focus:text-white focus:px-4 focus:py-2">Saltar al contenido</a>
      {v.demo && <DemoBanner />}
      <AppNav name={v.name} staff={STAFF.includes(v.role)} nutrition={ent.nutrition} program={prog && ent.app ? { slug: prog.c.id, title: prog.c.title } : null} />
      <InstallPrompt />
      <TzSync current={v.tz} />
      <ConnectionStatus />
      <UpdatePrompt version={deployId()} />
      {xp !== null && <LevelWatcher uid={v.id} idx={levelOf(xp).idx} />}
      <GiftCelebration gifts={unseen.gifts} demo={v.demo} />
      <main id="contenido" tabIndex={-1} className="block mx-auto max-w-5xl min-w-0 overflow-x-clip px-4 sm:px-8 outline-none pt-6 sm:pt-10 pb-32 lg:pb-16">
        {betaLive() && !ent.fromSubscription ? <BetaBanner /> : ent.trial && <TrialBanner daysLeft={ent.trial.daysLeft} />}
        <PlanGate locked={ent.locked} trialEndedOn={ent.locked && ent.trialEndsAt ? fmtDay(ent.trialEndsAt, v.tz) : null}>{children}</PlanGate>
      </main>
    </div>
  );
}
