import Link from "next/link";
import { ArrowRight, CaretDown, Clock, Gift } from "@/components/icons";
import { FunnelTracker } from "@/components/analytics";
import { trialNudge } from "@/lib/copy";

const TONE = {
  start: { box: "border-peel/25 bg-peel/5", icon: "text-peel" },
  calm: { box: "border-line bg-white", icon: "text-banana-ink" },
  warn: { box: "border-banana/60 bg-banana-soft", icon: "text-banana-ink" },
  last: { box: "border-banana/60 bg-banana-soft", icon: "text-banana-ink" },
} as const;

/**
 * Aviso de la prueba gratis dentro de la app. Cambia en el día 1 (bienvenida), días 5 y 6 (quedan pocos días)
 * y día 7 (último día). Con tarjeta guardada (desde el fin de la beta) dice cuánto y cuándo se cobra y que se puede
 * cancelar sin costo hasta el día 7; lleva a Mi plan, donde están la fecha, el monto y el botón para cancelar.
 */
export function TrialBanner({ daysLeft, charge }: { daysLeft: number; charge?: { amount: number; canceled: boolean } | null }) {
  const n = trialNudge(daysLeft, undefined, charge);
  const t = TONE[n.tone];
  const Icon = n.tone === "start" ? Gift : Clock;
  return (
    <aside aria-label="Prueba gratis" className={`mb-4 flex items-start gap-1 rounded-2xl border pl-3 pr-1 text-sm ${t.box}`}>
      <span className="sr-only">{daysLeft === 1 ? "Último día de prueba." : `Quedan ${daysLeft} días de prueba.`}</span>
      <FunnelTracker view="trial_banner_view" props={{ day: n.day, tone: n.tone }} />
      {/* #315: una sola línea para que no empuje el botón de empezar fuera de la pantalla. El detalle y lo que se pausa
          al terminar siguen aquí, plegados: se ven al tocar la línea (y completos en Mi plan). */}
      <details className="group min-w-0 flex-1">
        <summary className="tap flex min-h-11 cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
          <Icon weight="duotone" className={`size-5 shrink-0 ${t.icon}`} aria-hidden />
          <span className="min-w-0 font-semibold text-ink text-pretty">{n.title}</span>
          <CaretDown weight="bold" className="size-3.5 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <p className="pl-7 text-muted text-pretty">{n.body}</p>
        <p className="pl-7 pt-1 pb-2.5 text-xs text-muted">Al terminar, sin un plan activo se pausa el acceso a tu plan y al seguimiento de tu progreso. Sigue entrenando para mantener tu racha. Tus datos quedan guardados.</p>
      </details>
      <Link href="/app/suscripcion" data-cta={`trial-banner-d${n.day}`} className="tap pressable inline-flex shrink-0 items-center gap-1 rounded-full px-2 sm:px-3 h-11 font-bold text-banana-ink hover:text-ink">
        {n.cta}<ArrowRight weight="bold" className="size-4" />
      </Link>
    </aside>
  );
}
