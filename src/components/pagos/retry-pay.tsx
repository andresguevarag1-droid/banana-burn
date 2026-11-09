"use client";
import { ArrowCounterClockwise, CircleNotch } from "@/components/icons";
import type { Billing, PlanId } from "@/lib/plans";
import { useCheckout } from "./use-checkout";

/** Reintentar el pago que no se completó (#296): un toque abre otra vez el pago del mismo plan y periodo. */
export function RetryPay({ plan, billing, provider }: { plan: PlanId; billing: Billing; provider?: "onvo" | "tilopay" }) {
  const { start, busy, error } = useCheckout();
  return (
    <div className="mt-3 space-y-2">
      <button type="button" onClick={() => start(plan, billing, provider)} disabled={Boolean(busy)} aria-busy={Boolean(busy)} data-cta="pago-reintentar" className="btn-primary h-12 w-full sm:w-auto">
        {busy ? <><CircleNotch weight="bold" className="size-5 animate-spin motion-reduce:animate-none" />Abriendo el pago…</> : <><ArrowCounterClockwise weight="bold" aria-hidden className="size-5" />Intentar de nuevo</>}
      </button>
      {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
    </div>
  );
}
