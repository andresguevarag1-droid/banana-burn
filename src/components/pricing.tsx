"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Loader2, X } from "lucide-react";
import { PLANS, annualSavingPct, perMonthAnnual, usd, type Billing, type PlanId } from "@/lib/plans";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";
import { INTENT_COOKIE, INTENT_MAX_AGE, encodeIntent, intentPath } from "@/lib/checkout-intent";
import { useCheckout } from "@/components/pagos/use-checkout";

/** ¿Hay sesión? (lectura local de la sesión de Supabase, sin red). En demo no hay cuentas. */
function useLoggedIn() {
  const [loggedIn, setLoggedIn] = useState(false);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    createClient().auth.getSession().then(({ data }) => setLoggedIn(Boolean(data.session))).catch(() => {});
  }, []);
  return loggedIn;
}

function PlanCta({ plan, billing, name, hot, loggedIn, checkout }: { plan: PlanId; billing: Billing; name: string; hot: boolean; loggedIn: boolean; checkout: ReturnType<typeof useCheckout> }) {
  const cls = `mt-8 h-13 w-full ${hot ? "btn-banana" : "btn-primary"}`;
  const intent = { plan, billing };
  // Demo: sin cuentas ni cobros → mostramos la pantalla de suscripción con el aviso de demo.
  if (!isSupabaseConfigured) return <Link href={intentPath(intent)} className={cls}>Elegir {name}</Link>;
  if (!loggedIn) {
    // Sin sesión: registro. La intención viaja en `next` y en una cookie (sobrevive al onboarding).
    const href = `/entrar?modo=registro&plan=${plan}&pago=${billing}&next=${encodeURIComponent(intentPath(intent))}`;
    const remember = () => { try { document.cookie = `${INTENT_COOKIE}=${encodeIntent(intent)}; path=/; max-age=${INTENT_MAX_AGE}; samesite=lax`; } catch { /* sin cookies */ } };
    return <Link href={href} onClick={remember} className={cls}>Elegir {name}</Link>;
  }
  const busy = checkout.busy === `${plan}.${billing}`;
  return (
    <button type="button" onClick={() => checkout.start(plan, billing)} disabled={Boolean(checkout.busy)} aria-busy={busy} className={cls}>
      {busy ? <><Loader2 className="size-5 animate-spin" aria-hidden />Preparando tu pago…</> : <>Elegir {name}</>}
    </button>
  );
}

export function Pricing() {
  const [b, setB] = useState<Billing>("anual");
  const loggedIn = useLoggedIn();
  const checkout = useCheckout();
  const save = Math.max(...PLANS.map(annualSavingPct));
  return (
    <div>
      <div className="flex justify-center mb-10">
        <div className="inline-flex rounded-full bg-white border border-line p-1 shadow-soft" role="tablist" aria-label="Periodo de pago">
          {(["mes", "anual"] as const).map((k) => (
            <button key={k} role="tab" aria-selected={b === k} onClick={() => setB(k)} className={`h-11 px-5 rounded-full text-sm font-bold transition ${b === k ? "bg-ink text-white" : "text-muted"}`}>
              {k === "mes" ? "Mensual" : <>Anual <span className={`ml-1 chip h-6 px-2 ${b === k ? "bg-banana text-ink" : "bg-peel/10 text-peel"}`}>−{save} %</span></>}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2 max-w-4xl mx-auto items-stretch">
        {PLANS.map((p) => {
          const hot = p.nutrition;
          return (
            <div key={p.id} className={`relative flex flex-col rounded-[1.75rem] p-7 sm:p-8 ${hot ? "bg-ink text-white shadow-lift" : "card"}`}>
              {hot && <span className="chip absolute -top-3 left-7 bg-banana text-ink">⭐ Más resultados</span>}
              <p className={`text-lg font-extrabold ${hot ? "text-banana" : "text-ink"}`}>{p.name}</p>
              <p className={`text-sm ${hot ? "text-white/60" : "text-muted"}`}>{p.tagline}</p>
              <p className="mt-5 flex items-baseline gap-1.5">
                <span className={`text-5xl font-extrabold tracking-tight tabular-nums ${hot ? "" : "text-ink"}`}>{usd(b === "mes" ? p.price.mes : p.price.anual)}</span>
                <span className={hot ? "text-white/60" : "text-muted"}>{b === "mes" ? "/mes" : "/año"}</span>
              </p>
              <p className={`mt-1 h-5 text-sm font-semibold ${hot ? "text-banana" : "text-peel"}`}>{b === "anual" ? `Equivale a ${usd(perMonthAnnual(p))}/mes · ahorras ${usd(Math.round((p.price.mes * 12 - p.price.anual) * 100) / 100)}` : ""}</p>
              <ul className="mt-6 space-y-3 text-[15px] flex-1">
                {p.feats.map((f) => <li key={f} className="flex gap-2.5"><Check className={`size-5 shrink-0 ${hot ? "text-banana" : "text-peel"}`} />{f}</li>)}
                {!p.nutrition && <li className="flex gap-2.5 text-faint"><X className="size-5 shrink-0" />Plan de nutrición y registro de comidas</li>}
              </ul>
              <PlanCta plan={p.id} billing={b} name={p.name} hot={hot} loggedIn={loggedIn} checkout={checkout} />
            </div>
          );
        })}
      </div>
      {checkout.error && <p role="alert" className="mt-6 text-center text-sm font-semibold text-bad">{checkout.error}</p>}
      <p className="mt-6 text-center text-sm text-muted">Precios en dólares (USD) · tarjeta, SINPE Móvil o Apple Pay · cancela cuando quieras</p>
    </div>
  );
}
