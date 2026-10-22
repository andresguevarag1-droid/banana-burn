"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowCounterClockwise, Check, CircleNotch, Lock, MonkeyCrown, Scroll, X } from "@/components/icons";
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

/** Copy regional (LATAM) para los textos de `plans.ts` que aún dicen "tico". Quitar cuando plans.ts se actualice. */
const NEUTRAL: Record<string, string> = {
  "Registro de comidas con alimentos ticos": "Registro de comidas con alimentos latinos",
  "Ideas de menú tico día a día": "Ideas de menú latino día a día",
};
const neutral = (f: string) => NEUTRAL[f] ?? f;

/** Etiqueta única del CTA principal en todo el sitio. */
export const CTA_LABEL = "Crear mi plan";

function PlanCta({ plan, billing, name, hot, loggedIn, checkout }: { plan: PlanId; billing: Billing; name: string; hot: boolean; loggedIn: boolean; checkout: ReturnType<typeof useCheckout> }) {
  const cls = `mt-8 h-14 w-full text-base ${hot ? "btn-banana shadow-none" : "btn-primary"}`;
  const intent = { plan, billing };
  const cta = `pricing-${plan}-${billing}`;
  // Demo: sin cuentas ni cobros, mostramos la pantalla de suscripción con el aviso de demo.
  if (!isSupabaseConfigured) return <Link href={intentPath(intent)} data-cta={cta} className={cls}>{CTA_LABEL}<span className="sr-only"> con {name}</span></Link>;
  if (!loggedIn) {
    // Sin sesión: registro. La intención viaja en `next` y en una cookie (sobrevive al onboarding).
    const href = `/entrar?modo=registro&plan=${plan}&pago=${billing}&next=${encodeURIComponent(intentPath(intent))}`;
    const remember = () => { try { document.cookie = `${INTENT_COOKIE}=${encodeIntent(intent)}; path=/; max-age=${INTENT_MAX_AGE}; samesite=lax`; } catch { /* sin cookies */ } };
    return <Link href={href} onClick={remember} data-cta={cta} className={cls}>{CTA_LABEL}<span className="sr-only"> con {name}</span></Link>;
  }
  // Con sesión ya tiene plan de entreno: aquí solo activa el pago.
  const busy = checkout.busy === `${plan}.${billing}`;
  return (
    <button type="button" onClick={() => checkout.start(plan, billing)} disabled={Boolean(checkout.busy)} aria-busy={busy} data-cta={cta} className={cls}>
      {busy ? <><CircleNotch weight="bold" className="size-5 animate-spin" />Preparando tu pago…</> : <>Activar {name}</>}
    </button>
  );
}

const GUARANTEES = [
  [ArrowCounterClockwise, "Cancela cuando quieras", "Desde Mi plan, sin llamadas. Conservas el acceso hasta el final del periodo pagado y no se te vuelve a cobrar."],
  [Scroll, "8 días hábiles de retracto", "Si compraste y cambias de opinión, escríbenos dentro de los 8 días hábiles siguientes a la compra (Ley 7472)."],
  [Lock, "Pago seguro con ONVO Pay", "Los datos de tu tarjeta van directo a ONVO Pay, nuestro procesador de pagos, y nunca pasan por nuestros servidores."],
] as const;

export function Pricing() {
  const [b, setB] = useState<Billing>("anual");
  const loggedIn = useLoggedIn();
  const checkout = useCheckout();
  const save = Math.max(...PLANS.map(annualSavingPct));
  return (
    <div>
      <div className="flex justify-center mb-10">
        <div className="inline-flex rounded-full bg-white border border-line p-1 shadow-soft" role="tablist" aria-label="Periodo de pago">
          {(["anual", "mes"] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={b === k} onClick={() => setB(k)} className={`pressable h-11 px-5 rounded-full text-sm font-bold transition-[background-color,color,transform] duration-150 ${b === k ? "bg-ink text-white" : "text-muted hover:text-ink"}`}>
              {k === "mes" ? "Mensual" : <>Anual <span className={`ml-1 chip h-6 px-2 ${b === k ? "bg-banana text-ink" : "bg-peel/10 text-peel"}`}>Ahorra {save} %</span></>}
            </button>
          ))}
        </div>
      </div>

      <div data-sticky-hide className="grid gap-5 md:grid-cols-2 max-w-4xl mx-auto items-stretch">
        {PLANS.map((p) => {
          const hot = p.nutrition;
          const annual = b === "anual";
          const saved = Math.round((p.price.mes * 12 - p.price.anual) * 100) / 100;
          return (
            <div key={p.id} className={`relative flex flex-col rounded-[1.75rem] p-7 sm:p-8 ${hot ? "bg-ink text-white shadow-lift max-md:order-first" : "card"}`}>
              {hot && <span className="chip absolute -top-3 left-7 gap-1.5 bg-banana text-ink"><MonkeyCrown className="size-4" />Recomendado</span>}
              <h3 className={`text-lg font-extrabold ${hot ? "text-banana" : "text-ink"}`}>{p.name}</h3>
              <p className={`text-sm ${hot ? "text-white/75" : "text-muted"}`}>{p.tagline}</p>
              <p className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                {annual && <s className={`text-xl font-bold ${hot ? "text-white/60" : "text-faint"}`}><span className="sr-only">Antes </span>{usd(p.price.mes)}</s>}
                <span className={`text-5xl font-extrabold tracking-tight ${hot ? "" : "text-ink"}`}>{usd(annual ? perMonthAnnual(p) : p.price.mes)}</span>
                <span className={hot ? "text-white/75" : "text-muted"}>al mes</span>
              </p>
              <p className={`mt-2 min-h-10 text-sm font-semibold tabular-nums text-pretty ${annual ? (hot ? "text-banana" : "text-peel") : hot ? "text-white/75" : "text-muted"}`}>
                {annual ? `Un solo pago de ${usd(p.price.anual)} al año. Ahorras ${usd(saved)}.` : "Sin permanencia. Cancela cuando quieras."}
              </p>
              <ul className={`mt-6 pt-6 border-t space-y-3 text-[15px] flex-1 ${hot ? "border-white/15" : "border-line"}`}>
                {p.feats.map((f) => <li key={f} className="flex gap-2.5"><Check weight="bold" aria-hidden className={`size-5 shrink-0 ${hot ? "text-banana" : "text-peel"}`} />{neutral(f)}</li>)}
                {!p.nutrition && <li className="flex gap-2.5 text-faint"><X weight="bold" aria-hidden className="size-5 shrink-0" /><span><span className="sr-only">No incluye: </span>Plan de nutrición, registro de comidas y Banana Shield</span></li>}
              </ul>
              <PlanCta plan={p.id} billing={b} name={p.name} hot={hot} loggedIn={loggedIn} checkout={checkout} />
            </div>
          );
        })}
      </div>
      {checkout.error && <p role="alert" className="mt-6 text-center text-sm font-semibold text-bad">{checkout.error}</p>}
      <p className="mt-6 text-center text-sm text-muted text-pretty">Precios en dólares (USD). Pagas con tarjeta de crédito o débito.</p>

      <div className="mt-14 max-w-4xl mx-auto grid gap-6 rounded-[1.75rem] border border-line bg-cream p-6 sm:p-8 lg:grid-cols-[1fr_1.7fr] lg:gap-10">
        <div>
          <h3 className="text-2xl font-extrabold tracking-tight text-ink text-balance">Sin riesgo y sin letra pequeña</h3>
          <p className="mt-2 text-muted text-pretty">Todo esto está en nuestros <Link href="/terminos#planes" className="font-semibold text-ink underline underline-offset-2">términos</Link>, escrito para leerse en cinco minutos.</p>
        </div>
        <ul className="divide-y divide-line">
          {GUARANTEES.map(([I, t, d]) => (
            <li key={t} className="flex gap-4 py-4 first:pt-0 last:pb-0">
              <I weight="duotone" aria-hidden className="mt-0.5 size-6 shrink-0 text-banana-ink" />
              <div>
                <p className="font-extrabold text-ink">{t}</p>
                <p className="mt-1 text-[15px] text-muted leading-relaxed text-pretty max-w-[60ch]">{d}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
