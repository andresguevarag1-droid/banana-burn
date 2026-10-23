import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { DemoBanner } from "@/components/brand";
import { InstallPrompt } from "@/components/install-prompt";
import { TzSync } from "@/components/tz-sync";
import { getEntitlements } from "@/lib/entitlements";
import { getViewer, STAFF } from "@/lib/supabase/server";
import { PlanGate } from "./suscripcion/plan-wall";
import { LevelWatcher } from "@/components/levels/level-up";
import { getXpTotal } from "@/lib/xp-server";
import { levelOf } from "@/lib/gamify";
import { TrialBanner } from "./suscripcion/trial-banner";
import { BetaBanner } from "@/components/beta-notice";
import { betaLive } from "@/lib/plans";

export const dynamic = "force-dynamic";

const fmtDay = (iso: string, tz: string) => { try { return new Date(iso).toLocaleDateString("es-419", { day: "numeric", month: "long", timeZone: tz }); } catch { return null; } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const v = await getViewer();
  if (!v) redirect("/entrar?next=/app");
  if (!v.onboarded) redirect("/bienvenida");
  const [ent, xp] = await Promise.all([getEntitlements(v), getXpTotal(v).catch(() => null)]);
  return (
    <div className="lg:pl-64">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-full focus:bg-ink focus:text-white focus:px-4 focus:py-2">Saltar al contenido</a>
      {v.demo && <DemoBanner />}
      <AppNav name={v.name} staff={STAFF.includes(v.role)} nutrition={ent.nutrition} />
      <InstallPrompt />
      <TzSync current={v.tz} />
      {xp !== null && <LevelWatcher uid={v.id} idx={levelOf(xp).idx} />}
      <main id="contenido" tabIndex={-1} className="block mx-auto max-w-5xl min-w-0 overflow-x-clip px-4 sm:px-8 outline-none pt-6 sm:pt-10 pb-32 lg:pb-16">
        {betaLive() && !ent.fromSubscription ? <BetaBanner /> : ent.trial && <TrialBanner daysLeft={ent.trial.daysLeft} />}
        <PlanGate locked={ent.locked} trialEndedOn={ent.locked && ent.trialEndsAt ? fmtDay(ent.trialEndsAt, v.tz) : null}>{children}</PlanGate>
      </main>
    </div>
  );
}
