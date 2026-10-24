"use client";
import { PROMO_PCT } from "@/lib/trial";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowCounterClockwise, Check, CircleNotch, Gift, Lock, MonkeyCrown, Scroll, X } from "@/components/icons";
import { PLANS, PREMIUM_RETOS_NOTE, annualSavingPct, type Billing, type PlanId } from "@/lib/plans";
import { isSupabaseConfigured } from "@/lib/env";
import { intentPath } from "@/lib/checkout-intent";
import { TRIAL_DAYS, money, noBreakGlp1 } from "@/lib/copy";
import { useCheckout } from "@/components/pagos/use-checkout";
import { offer } from "@/lib/offer";

/**
 * ¿Hay sesión? (lectura local de la sesión de Supabase, sin red). En demo no hay cuentas.
 * El cliente de Supabase se carga aparte y solo si hay cookie de sesión: la landing no arrastra supabase-js para visitantes nuevos.
 */
function useLoggedIn(known?: boolean) {
  const [loggedIn, setLoggedIn] = useState(Boolean(known));
  useEffect(() => {
    if (known !== undefined || !isSupabaseConfigured) return;
    if (!/(?:^|;\s*)sb-[^=]*-auth-token/.test(document.cookie)) return;
    import("@/lib/supabase/client")
      .then(({ createClient }) => createClient().auth.getSession())
      .then(({ data }) => setLoggedIn(Boolean(data.session)))
      .catch(() => {});
  }, [known]);
  return loggedIn;
}

/** Etiqueta del CTA de los planes para quien aún no tiene cuenta: primero la prueba gratis. */
export const CTA_LABEL = `Empezar ${TRIAL_DAYS} días gratis`;

function PlanCta({ plan, billing, name, hot, loggedIn, checkout }: { plan: PlanId; billing: Billing; name: string; hot: boolean; loggedIn: boolean; checkout: ReturnType<typeof useCheckout> }) {
  const cls = `mt-5 h-14 w-full text-base ${hot ? "btn-banana shadow-none" : "btn-primary"}`;
  const intent = { plan, billing };
  const cta = `pricing-${plan}-${billing}`;
  // Demo: sin cuentas ni cobros, mostramos la pantalla de suscripción con el aviso de demo.
  if (!isSupabaseConfigured) return <Link href={intentPath(intent)} data-cta={cta} className={cls}>{CTA_LABEL}<span className="sr-only"> con {name}</span></Link>;
  if (!loggedIn) {
    // Sin sesión: registro con la prueba gratis. /entrar guarda el plan elegido en una cookie de intención
    // (sobrevive al onboarding) y la bienvenida la usa para el plan de la prueba (con tarjeta desde el fin de la beta).
    const href = `/entrar?modo=registro&plan=${plan}&pago=${billing}`;
    return <Link href={href} data-cta={cta} className={cls}>{CTA_LABEL}<span className="sr-only">, luego {name}</span></Link>;
  }
  // Con sesión ya tiene plan de entreno: aquí solo activa el pago.
  const busy = checkout.busy === `${plan}.${billing}`;
  return (
    <button type="button" onClick={() => checkout.start(plan, billing)} disabled={Boolean(checkout.busy)} aria-busy={busy} data-cta={cta} className={cls}>
      {busy ? <><CircleNotch weight="bold" className="size-5 animate-spin" />Preparando tu pago…</> : <>Activar {name}</>}
    </button>
  );
}

/** Garantías. La de la prueba cambia con el fin de la beta (offer.ts); las páginas del servidor la pasan ya calculada. */
const guarantees = (trial: readonly [string, string]) => [
  [Gift, trial[0], trial[1]],
  [ArrowCounterClockwise, "Cancela cuando quieras", "Desde Mi plan, sin llamadas. Conservas el acceso hasta el final del periodo pagado y no se te vuelve a cobrar."],
  [Scroll, "8 días hábiles de retracto", "Si compraste y cambias de opinión, escríbenos dentro de los 8 días hábiles siguientes a la compra (Ley 7472)."],
  [Lock, "Pago seguro", "Los datos de tu tarjeta van directo a nuestro procesador de pagos (ONVO Pay o Tilopay) y nunca pasan por nuestros servidores."],
] as const;

/**
 * Planes con el anual anclado. `recommended` decide qué plan va destacado (por defecto el completo;
 * el muro de planes lo elige según el uso de la prueba). `loggedIn` evita leer la sesión cuando ya se sabe.
 */
export function Pricing({ recommended = "completo", loggedIn: known, reason, trialGuarantee }: { recommended?: PlanId; loggedIn?: boolean; reason?: string; trialGuarantee?: readonly [string, string] } = {}) {
  const [b, setB] = useState<Billing>("anual");
  const loggedIn = useLoggedIn(known);
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

      {/* El botón va justo después del precio (alineado en las dos tarjetas por el min-h del texto del pago) y la tarjeta
          mide su contenido: antes la lista crecía para alinear los botones al pie y la tarjeta con menos líneas
          quedaba con un hueco grande sobre el botón. */}
      <div data-sticky-hide className="grid gap-5 md:grid-cols-2 max-w-4xl mx-auto items-start">
        {PLANS.map((p) => {
          const hot = p.id === recommended;
          const annual = b === "anual";
          const saved = Math.round((p.price.mes * 12 - p.price.anual) * 100) / 100;
          return (
            <div key={p.id} className={`relative flex flex-col rounded-[1.75rem] p-7 sm:p-8 ${hot ? "bg-ink text-white shadow-lift max-md:order-first" : "card"}`}>
              {hot && <span className="chip absolute -top-3 left-7 gap-1.5 bg-banana text-ink"><MonkeyCrown className="size-4" />{reason ? "Recomendado para ti" : "Recomendado"}</span>}
              <h3 className={`text-lg font-extrabold ${hot ? "text-banana" : "text-ink"}`}>{p.name}</h3>
              <p className={`text-sm ${hot ? "text-white/75" : "text-muted"}`}>{hot && reason ? reason : p.tagline}</p>
              <p className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className={`text-5xl font-extrabold tracking-tight tabular-nums ${hot ? "" : "text-ink"}`}>{money(annual ? p.price.anual : p.price.mes)}</span>
                <span className={hot ? "text-white/75" : "text-muted"}>{annual ? "al año" : "al mes"}</span>
              </p>
              <p className={`mt-2 min-h-10 text-sm font-semibold tabular-nums text-pretty ${annual ? (hot ? "text-banana" : "text-peel") : hot ? "text-white/75" : "text-muted"}`}>
                {annual ? `Un solo pago al año. Ahorras ${money(saved)} frente a ${money(p.price.mes)} al mes.` : "Sin permanencia. Cancela cuando quieras."}
              </p>
              <PlanCta plan={p.id} billing={b} name={p.name} hot={hot} loggedIn={loggedIn} checkout={checkout} />
              <ul className={`mt-6 pt-6 border-t space-y-3 text-[15px] ${hot ? "border-white/15" : "border-line"}`}>
                {p.feats.map((f) => <li key={f} className="flex gap-2.5"><Check weight="bold" aria-hidden className={`size-5 shrink-0 ${hot ? "text-banana" : "text-peel"}`} />{noBreakGlp1(f)}</li>)}
                {p.excluded.map((f) => <li key={f} className={`flex gap-2.5 ${hot ? "text-white/60" : "text-faint"}`}><X weight="bold" aria-hidden className="size-5 shrink-0" /><span><span className="sr-only">No incluye: </span>{noBreakGlp1(f)}</span></li>)}
              </ul>
            </div>
          );
        })}
      </div>
      {checkout.error && <p role="alert" className="mt-6 text-center text-sm font-semibold text-bad">{checkout.error}</p>}
      {/* La prueba gratis solo se le cuenta a quien aún no tiene cuenta: en el muro (prueba terminada) y en Mi plan no aplica. */}
      {!loggedIn && <p className="mt-6 text-center text-sm text-muted text-pretty">Primero tienes {TRIAL_DAYS} días gratis con todo incluido, sin tarjeta. Si dejas tu tarjeta lista antes de tu primer cobro, tu primer mes del plan mensual cuesta {PROMO_PCT} % menos. Precios en dólares (USD).</p>}
      {loggedIn && <p className="mt-6 text-center text-sm text-muted text-pretty">Precios en dólares (USD).</p>}
      <p className="mt-2 text-center text-sm text-muted text-pretty">{PREMIUM_RETOS_NOTE}</p>

      {/* Título arriba y las cuatro garantías en dos columnas: en escritorio la columna del título quedaba casi vacía. */}
      <div className="mt-14 max-w-4xl mx-auto rounded-[1.75rem] border border-line bg-cream p-6 sm:p-8">
        <div className="max-w-2xl">
          <h3 className="text-2xl font-extrabold tracking-tight text-ink text-balance">Sin riesgo y sin letra pequeña</h3>
          <p className="mt-2 text-muted text-pretty">Todo esto está en nuestros <Link href="/terminos#planes" className="tap font-semibold text-ink underline underline-offset-2">términos</Link>, escritos para leerse en cinco minutos.</p>
        </div>
        <ul className="mt-6 grid gap-x-10 gap-y-5 sm:grid-cols-2">
          {guarantees(trialGuarantee ?? offer().guarantee).slice(loggedIn ? 1 : 0).map(([I, t, d]) => (
            <li key={t} className="flex gap-4 border-t border-line pt-5">
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
