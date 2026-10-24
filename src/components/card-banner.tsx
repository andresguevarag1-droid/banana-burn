import Link from "next/link";
import { ArrowRight, CircleNotch, CreditCard, WarningCircle } from "@/components/icons";
import { FunnelTracker } from "@/components/analytics";
import { betaDates } from "@/components/beta-notice";
import { PLANS } from "@/lib/plans";
import { money } from "@/lib/copy";
import type { ChargeView } from "@/lib/trial";

const TZ = "America/Costa_Rica";
const fmt = (iso: string, tz = TZ) => { try { return new Date(iso).toLocaleDateString("es-419", { day: "numeric", month: "long", timeZone: tz }); } catch { return ""; } };

/**
 * Cuentas de la beta sin tarjeta: pedir la tarjeta antes del fin de la beta, con todo dicho claro. No hay días extra:
 * si no la agregan, desde esa fecha ven el muro de planes hasta que guarden una tarjeta y paguen. Nada se borra.
 */
export function AddCardBanner() {
  const { lastFree, firstPaid } = betaDates();
  return (
    <aside aria-label="Agrega tu tarjeta" className="mb-5 rounded-2xl border border-banana bg-banana-soft text-sm">
      <FunnelTracker view="card_banner_view" props={{ kind: "beta-add" }} />
      <details className="group">
        <summary className="tap flex min-h-11 list-none items-center gap-2.5 px-3.5 py-2 [&::-webkit-details-marker]:hidden">
          <CreditCard weight="duotone" className="size-5 shrink-0 text-banana-ink" aria-hidden />
          <span className="min-w-0 flex-1 text-pretty text-ink"><b>Deja tu tarjeta lista y paga 50 % menos tu primer mes.</b> Tu acceso gratis termina el {lastFree}.</span>
          <span className="shrink-0 text-xs font-bold text-banana-ink underline underline-offset-4 group-open:hidden">Más info</span>
        </summary>
        <div className="px-3.5 pb-3 pl-11 text-body text-pretty space-y-1.5">
          <p>Desde el {firstPaid} la app se paga. Si dejas tu tarjeta lista antes, hoy no se cobra nada y el {firstPaid} se cobra tu primer mes con 50 % de descuento (plan mensual), salvo que canceles antes. Te avisamos 2 días antes.</p>
          <p>Si no la agregas, desde el {firstPaid} verás la pantalla de planes hasta que guardes una tarjeta y pagues. No hay días gratis extra después de esa fecha. Tu progreso queda guardado.</p>
        </div>
      </details>
      <div className="px-3.5 pb-2 pl-11">
        <Link href="/app/suscripcion#tarjeta" data-cta="card-banner-agregar" className="tap inline-flex h-11 items-center gap-1 font-bold text-ink underline-offset-4 hover:underline">Dejar mi tarjeta lista<ArrowRight weight="bold" className="size-4" /></Link>
      </div>
    </aside>
  );
}

/** Tarjeta guardada durante la beta: qué se cobra y cuándo. */
export function ScheduledBanner({ charge, tz }: { charge: ChargeView; tz: string }) {
  const plan = PLANS.find((p) => p.id === charge.plan)!;
  return (
    <aside aria-label="Cobro programado" className="mb-5 flex items-center gap-2.5 rounded-2xl border border-line bg-white px-3.5 py-1 text-sm">
      <CreditCard weight="duotone" className="size-5 shrink-0 text-peel" aria-hidden />
      <p className="min-w-0 flex-1 py-1.5 text-pretty text-ink">{charge.testerHold
        ? <><b>Mientras seas tester no se te cobra nada.</b> El {fmt(charge.chargeAt, tz)}, al terminar tu mes de tester, se cobra {plan.name} por {money(charge.amount)}, salvo que canceles antes.</>
        : <><b>Tarjeta lista.</b> El {fmt(charge.chargeAt, tz)} se cobra {plan.name} por {money(charge.amount)}{charge.promo ? ", tu primer mes con 50 % de descuento" : ""}, salvo que canceles antes.</>}</p>
      <Link href="/app/suscripcion" data-cta="card-banner-plan" className="tap inline-flex h-11 shrink-0 items-center gap-1 font-bold text-banana-ink hover:text-ink">Ver<ArrowRight weight="bold" className="size-4" /></Link>
    </aside>
  );
}

/** El cobro no pasó: cambiar la tarjeta. */
export function FailedBanner({ charge, tz }: { charge: ChargeView; tz: string }) {
  return (
    <aside role="alert" className="mb-5 flex items-center gap-2.5 rounded-2xl border border-bad/30 bg-bad/5 px-3.5 py-1 text-sm">
      <FunnelTracker view="card_banner_view" props={{ kind: "failed" }} />
      <WarningCircle weight="duotone" className="size-5 shrink-0 text-bad" aria-hidden />
      <p className="min-w-0 flex-1 py-1.5 text-pretty text-ink"><b>No pudimos cobrar tu plan.</b> {charge.testerHold && charge.retryAt ? `Mientras seas tester no se te cobra: lo intentaremos de nuevo el ${fmt(charge.retryAt, tz)}, al terminar tu mes de tester. Puedes cambiar tu tarjeta antes.` : charge.retryAt ? `Lo intentaremos de nuevo el ${fmt(charge.retryAt, tz)}, o cambia tu tarjeta para seguir hoy.` : "Cambia tu tarjeta para seguir."}</p>
      <Link href="/app/suscripcion#tarjeta" data-cta="card-banner-cambiar" className="tap inline-flex h-11 shrink-0 items-center gap-1 font-bold text-bad hover:text-ink">Cambiar<ArrowRight weight="bold" className="size-4" /></Link>
    </aside>
  );
}

/** Cobro enviado: esperando la confirmación de ONVO (el webhook). */
export function ProcessingBanner() {
  return (
    <aside aria-live="polite" className="mb-5 flex items-center gap-2.5 rounded-2xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink">
      <CircleNotch weight="bold" className="size-5 shrink-0 animate-spin text-banana-ink motion-reduce:animate-none" aria-hidden />
      <p className="min-w-0 flex-1 text-pretty"><b>Estamos confirmando el cobro de tu plan.</b> Suele tardar unos segundos.</p>
    </aside>
  );
}
