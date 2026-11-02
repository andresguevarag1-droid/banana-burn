"use client";
// Oferta al terminar el primer entreno (#199). Anual preseleccionado con su ahorro en dólares; mensual con el 50 % del
// primer mes por dejar la tarjeta. "Ahora no" la cierra para siempre en este teléfono; luego se ve en Mi plan desde el perfil.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Banana, Check } from "@/components/icons";
import { FunnelTracker } from "@/components/analytics";
import { activateHref, firstWorkoutOffer, offerDismissKey } from "@/lib/first-workout-offer";
import type { Billing } from "@/lib/plans";
import { usd2 } from "@/lib/num";

export function FirstWorkoutOffer({ userId }: { userId: string }) {
  const [visible, show] = useState(false);
  const [billing, setBilling] = useState<Billing>("anual");
  const key = offerDismissKey(userId);
  useEffect(() => {
    try { show(!localStorage.getItem(key)); }
    catch { show(true); }
  }, [key]);
  if (!visible) return null;
  function dismiss() {
    try { localStorage.setItem(key, String(Date.now())); } catch { /* sin almacenamiento: igual se cierra en esta pantalla */ }
    show(false);
  }
  return <OfferCard billing={billing} onBilling={setBilling} onDismiss={dismiss} />;
}

/** La tarjeta en sí (sin estado, para probarla). */
export function OfferCard({ billing, onBilling, onDismiss }: { billing: Billing; onBilling: (b: Billing) => void; onDismiss: () => void }) {
  const o = firstWorkoutOffer();
  const options: { id: Billing; title: string; price: string; line: string }[] = [
    { id: "anual", title: "Anual", price: `${usd2(o.annual)}/año`, line: `Ahorras ${usd2(o.annualSaving)} al año` },
    { id: "mes", title: "Mensual", price: `${usd2(o.month)}/mes`, line: `Primer mes a ${usd2(o.monthFirst)} dejando tu tarjeta` },
  ];
  return (
    <section aria-labelledby="first-offer-title" className="mt-3 rounded-[1.5rem] border-2 border-ink bg-white p-4 text-left">
      <FunnelTracker view="plan_wall_view" props={{ where: "primer-entreno" }} />
      <h2 id="first-offer-title" className="flex items-center gap-2 text-lg font-extrabold text-ink text-balance">
        <span>Terminaste tu primer entreno <Banana weight="fill" aria-hidden className="inline size-5 align-[-3px] text-banana-ink" /> Sigue con tu plan</span>
      </h2>
      <p className="mt-1 text-sm text-muted">{o.name}. Precios en USD, IVA incluido.</p>
      <fieldset className="mt-3 space-y-2">
        <legend className="sr-only">Elige cómo pagar</legend>
        {options.map((x) => {
          const on = billing === x.id;
          return (
            <label key={x.id} className={`pressable flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 ${on ? "border-ink bg-banana-soft" : "border-line bg-white"}`}>
              <input type="radio" name="first-offer-billing" value={x.id} checked={on} onChange={() => onBilling(x.id)} className="sr-only" />
              <span aria-hidden className={`grid size-6 shrink-0 place-items-center rounded-full border-2 ${on ? "border-ink bg-ink text-banana" : "border-line"}`}>{on && <Check weight="bold" className="size-3.5" />}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2"><span className="font-extrabold text-ink">{x.title}</span><span className="font-extrabold text-ink tabular-nums">{x.price}</span></span>
                <span className="block text-sm text-body tabular-nums">{x.line}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
      <Link href={activateHref(billing)} data-cta={`primer-entreno-activar-${billing}`} className="btn-banana mt-3 h-13 w-full text-base font-extrabold">Activar mi plan</Link>
      <p className="mt-2 text-center text-sm text-muted">Cancela cuando quieras en 2 toques.</p>
      <p className="text-center"><button type="button" onClick={onDismiss} data-cta="primer-entreno-ahora-no" className="tap inline-flex min-h-11 items-center text-sm font-semibold text-muted underline underline-offset-4 hover:text-ink">Ahora no</button></p>
    </section>
  );
}
