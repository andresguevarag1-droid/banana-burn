"use client";
// Oferta al terminar el primer entreno (#199). Anual preseleccionado con su ahorro en dólares; mensual con el 50 % del
// primer mes por dejar la tarjeta. "Ahora no" la cierra para siempre en este teléfono; luego se ve en Mi plan desde el perfil.
// La primera vez que la cierra en su cuenta, antes de irse ve una sola vez la oferta de salida (#227) con ese mismo 50 %.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Banana, Check } from "@/components/icons";
import { FunnelTracker, trackOnce } from "@/components/analytics";
import { activateHref, exitOfferKey, firstWorkoutOffer, offerDismissKey } from "@/lib/first-workout-offer";
import { PROMO_PCT } from "@/lib/trial";
import type { Billing } from "@/lib/plans";
import { usd2 } from "@/lib/num";
import { useLang } from "./use-lang";

/** Lee y marca la oferta de salida en este teléfono. Devuelve true si es la primera vez (y desde ya queda marcada). */
export function claimExitOffer(storage: Pick<Storage, "getItem" | "setItem">, userId: string): boolean {
  const k = exitOfferKey(userId);
  if (storage.getItem(k)) return false;
  storage.setItem(k, String(Date.now()));
  return true;
}

export function FirstWorkoutOffer({ userId }: { userId: string }) {
  const [step, setStep] = useState<"hidden" | "offer" | "exit">("hidden");
  const [billing, setBilling] = useState<Billing>("anual");
  const key = offerDismissKey(userId);
  useEffect(() => {
    try { setStep(localStorage.getItem(key) ? "hidden" : "offer"); }
    catch { setStep("offer"); }
  }, [key]);
  if (step === "hidden") return null;
  function close() {
    try { localStorage.setItem(key, String(Date.now())); } catch { /* sin almacenamiento: igual se cierra en esta pantalla */ }
    setStep("hidden");
  }
  function dismiss() {
    let first = false;
    try { first = claimExitOffer(localStorage, userId); } catch { /* sin almacenamiento: no insistimos */ }
    close();
    if (first) {
      setStep("exit");
      trackOnce("plan_wall_exit_offer", { where: "primer-entreno" });
    }
  }
  if (step === "exit") return <ExitOfferCard onDismiss={() => setStep("hidden")} />;
  return <OfferCard billing={billing} onBilling={setBilling} onDismiss={dismiss} />;
}

/** Oferta de salida (#227): la misma promoción del 50 % del primer mes mensual (PROMO_TERMS), sin descuentos nuevos. */
export function ExitOfferCard({ onDismiss }: { onDismiss: () => void }) {
  const o = firstWorkoutOffer();
  const { t } = useLang();
  return (
    <section aria-labelledby="exit-offer-title" className="mt-3 rounded-[1.5rem] border-2 border-ink bg-banana-soft p-4 text-left">
      <FunnelTracker view="card_ask_view" props={{ where: "salida" }} />
      <h2 id="exit-offer-title" className="text-lg font-extrabold text-ink text-balance">{t("Antes de irte: {pct}\u00a0% en tu primer mes si dejas tu tarjeta hoy", { pct: PROMO_PCT })}</h2>
      <p className="mt-1 text-sm text-body text-pretty">{t("{plan}: tu primer mes a", { plan: t(o.name) })} <b className="tabular-nums">{usd2(o.monthFirst)}</b>{t(", después")} <b className="tabular-nums">{t("{price}/mes", { price: usd2(o.month) })}</b>{t(". Hoy no te cobramos: se cobra al terminar tu prueba. Precios en USD, IVA incluido.")}</p>
      <Link href={activateHref("mes", undefined, "salida")} data-cta="salida-guardar-tarjeta" className="btn-banana mt-3 h-13 w-full text-base font-extrabold">{t("Dejar mi tarjeta")}</Link>
      <p className="mt-2 text-center text-sm text-muted">{t("Cancela cuando quieras en 2 toques.")}</p>
      <p className="text-center"><button type="button" onClick={onDismiss} data-cta="salida-no-gracias" className="tap inline-flex min-h-11 items-center text-sm font-semibold text-muted underline underline-offset-4 hover:text-ink">{t("No, gracias")}</button></p>
    </section>
  );
}

/** La tarjeta en sí (sin estado, para probarla). */
export function OfferCard({ billing, onBilling, onDismiss }: { billing: Billing; onBilling: (b: Billing) => void; onDismiss: () => void }) {
  const o = firstWorkoutOffer();
  const { t } = useLang();
  const options: { id: Billing; title: string; price: string; line: string }[] = [
    { id: "anual", title: t("Anual"), price: t("{price}/año", { price: usd2(o.annual) }), line: t("Ahorras {amount} al año", { amount: usd2(o.annualSaving) }) },
    { id: "mes", title: t("Mensual"), price: t("{price}/mes", { price: usd2(o.month) }), line: t("Primer mes a {price} dejando tu tarjeta", { price: usd2(o.monthFirst) }) },
  ];
  return (
    <section aria-labelledby="first-offer-title" className="mt-3 rounded-[1.5rem] border-2 border-ink bg-white p-4 text-left">
      <FunnelTracker view="plan_wall_view" props={{ where: "primer-entreno" }} />
      <FunnelTracker view="card_ask_view" props={{ where: "primer-entreno" }} />
      <h2 id="first-offer-title" className="flex items-center gap-2 text-lg font-extrabold text-ink text-balance">
        <span>{t("Terminaste tu primer entreno")} <Banana weight="fill" aria-hidden className="inline size-5 align-[-3px] text-banana-ink" /> {t("Sigue con tu plan")}</span>
      </h2>
      <p className="mt-1 text-sm text-muted">{t("{plan}. Precios en USD, IVA incluido.", { plan: t(o.name) })}</p>
      <fieldset className="mt-3 space-y-2">
        <legend className="sr-only">{t("Elige cómo pagar")}</legend>
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
      <Link href={activateHref(billing, undefined, "primer-entreno")} data-cta={`primer-entreno-activar-${billing}`} className="btn-banana mt-3 h-13 w-full text-base font-extrabold">{t("Activar mi plan")}</Link>
      <p className="mt-2 text-center text-sm text-muted">{t("Cancela cuando quieras en 2 toques.")}</p>
      <p className="text-center"><button type="button" onClick={onDismiss} data-cta="primer-entreno-ahora-no" className="tap inline-flex min-h-11 items-center text-sm font-semibold text-muted underline underline-offset-4 hover:text-ink">{t("Ahora no")}</button></p>
    </section>
  );
}
