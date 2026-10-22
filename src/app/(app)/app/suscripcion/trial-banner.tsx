import Link from "next/link";
import { ArrowRight, Clock, Gift } from "@/components/icons";
import { FunnelTracker } from "@/components/analytics";
import { trialNudge } from "@/lib/copy";

const TONE = {
  start: { box: "border-peel/25 bg-peel/5", icon: "text-peel" },
  calm: { box: "border-line bg-white", icon: "text-banana-ink" },
  warn: { box: "border-banana/60 bg-banana-soft", icon: "text-banana-ink" },
  last: { box: "border-ember/30 bg-ember/5", icon: "text-ember-ink" },
} as const;

/**
 * Aviso de la prueba gratis dentro de la app. Cambia en el día 1 (bienvenida), días 5 y 6 (quedan pocos días)
 * y día 7 (último día). Lleva directo a elegir plan; como no hay tarjeta, no hay cobros sorpresa.
 */
export function TrialBanner({ daysLeft }: { daysLeft: number }) {
  const n = trialNudge(daysLeft);
  const t = TONE[n.tone];
  const Icon = n.tone === "start" ? Gift : Clock;
  return (
    <aside aria-label="Prueba gratis" className={`mb-5 grid grid-cols-[auto_1fr_auto] items-center gap-x-3 rounded-2xl border px-3 py-1 text-sm ${t.box}`}>
      <FunnelTracker view="trial_banner_view" props={{ day: n.day, tone: n.tone }} />
      <Icon weight="duotone" className={`size-5 shrink-0 ${t.icon}`} aria-hidden />
      <p className="min-w-0 py-1 text-pretty">
        <span className="font-semibold text-ink">{n.title}</span>
        <span className="hidden sm:inline text-muted"> {n.body}</span>
      </p>
      <Link href="/app/suscripcion" data-cta={`trial-banner-d${n.day}`} className="tap pressable inline-flex shrink-0 items-center gap-1 rounded-full px-2 sm:px-3 h-11 font-bold text-banana-ink hover:text-ink">
        {n.cta}<ArrowRight weight="bold" className="size-4" />
      </Link>
      {n.tone !== "calm" && <p className="col-start-2 col-span-2 -mt-1 pb-2 text-muted text-pretty sm:hidden">{n.body}</p>}
    </aside>
  );
}
