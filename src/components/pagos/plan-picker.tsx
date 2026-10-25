"use client";
import { Check } from "@/components/icons";
import { ANNUAL_SEASON_NOTE, PLANS, annualSaving, annualSavingPct, usd, type Billing, type PlanId } from "@/lib/plans";
import { money } from "@/lib/copy";
import { PROMO_PCT, promoPrice } from "@/lib/trial";

export type PlanChoice = { plan: PlanId; billing: Billing };

/**
 * Elegir plan y periodo antes de guardar la tarjeta (bienvenida y Mi plan). Solo muestra precios: el monto del cobro lo
 * decide el servidor con plans.ts. Sin descuentos por nivel (esos son solo para programas Premium).
 * `promo` (0043): el plan mensual muestra el precio tachado y el del primer mes con 50 %; el anual va a precio normal.
 */
export function PlanPicker({ value, onChange, disabled, promo = false }: { value: PlanChoice; onChange: (v: PlanChoice) => void; disabled?: boolean; promo?: boolean }) {
  const promoOn = promo && value.billing === "mes";
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 rounded-full bg-white border border-line p-1" role="radiogroup" aria-label="Periodo de pago">
        {(["mes", "anual"] as const).map((b) => (
          <button key={b} type="button" role="radio" aria-checked={value.billing === b} disabled={disabled} onClick={() => onChange({ ...value, billing: b })}
            className={`pressable h-11 rounded-full text-sm font-bold transition-[background-color,color] duration-150 ${value.billing === b ? "bg-ink text-white" : "text-muted hover:text-ink"}`}>
            {b === "mes" ? "Mensual" : `Anual (ahorra ${Math.max(...PLANS.map(annualSavingPct))} %)`}
          </button>
        ))}
      </div>
      {promo && value.billing === "anual" && <p className="text-sm text-muted text-pretty">El {PROMO_PCT} % de descuento es solo para el primer mes del plan mensual. El anual va a su precio normal.</p>}
      <div className="grid gap-2" role="radiogroup" aria-label="Plan">
        {PLANS.map((p) => {
          const on = value.plan === p.id;
          return (
            <button key={p.id} type="button" role="radio" aria-checked={on} disabled={disabled} onClick={() => onChange({ ...value, plan: p.id })}
              className={`pressable w-full rounded-2xl border-2 p-4 text-left transition-[background-color,border-color] duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-banana/50 ${on ? "border-ink bg-banana-soft" : "border-line bg-white hover:border-ink/40"}`}>
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block font-extrabold text-ink">{p.name}</span>
                  <span className="block text-sm text-muted text-pretty">{p.tagline}</span>
                </span>
                {promoOn ? (
                  <span className="text-right shrink-0">
                    <span className="block text-xs text-muted tabular-nums"><s><span className="sr-only">Precio normal </span>{usd(p.price.mes)}</s></span>
                    <span className="block font-extrabold tabular-nums text-ink">{money(promoPrice(p.id))}</span>
                    <span className="block text-xs text-muted">tu primer mes</span>
                  </span>
                ) : (
                  <span className="text-right shrink-0">
                    <span className="block font-extrabold tabular-nums text-ink">{usd(p.price[value.billing])}</span>
                    <span className="block text-xs text-muted">{value.billing === "anual" ? `al año, ahorras ${money(annualSaving(p))}` : "al mes"}</span>
                    {value.billing === "anual" && <span className="block text-xs font-semibold text-peel">{ANNUAL_SEASON_NOTE}</span>}
                  </span>
                )}
              </span>
              <span className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span aria-hidden className={`inline-flex items-center gap-1 text-xs font-bold ${on ? "text-ink" : "text-transparent"}`}><Check weight="bold" className="size-3.5" />Elegido</span>
                {promoOn && <span className="text-xs text-muted tabular-nums">Luego {usd(p.price.mes)} al mes</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
