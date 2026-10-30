import { Pricing } from "@/components/pricing";
import { PLANS, annualSavingPct } from "@/lib/plans";
import { TRIAL_DAYS } from "@/lib/copy";
import { Faq } from "../parts";
import { faqJsonLd, ldScript, social } from "../seo";
import { Compare, FaqCta, FROM, pricingFaq } from "../content";
import { offer } from "@/lib/offer";
import type { Metadata } from "next";

// Pública e igual para todos: ISR (la CDN la sirve y se regenera cada hora; nada depende de la persona).
export const revalidate = 3600;

const TITLE = `Precios: tu entrenador personal en el celular desde ${FROM} al mes`;
/** Según la fecha (offer.ts): la prueba no pide tarjeta; la beta es gratis hasta el 7 de noviembre. */
const description = () => `${offer().card ? `Prueba Banana Burn ${TRIAL_DAYS} días gratis con todo incluido, sin tarjeta.` : `Prueba Banana Burn ${TRIAL_DAYS} días gratis con todo incluido.`} Después, Entreno desde ${FROM} al mes, o súmale nutrición con comida latina de verdad. Cancela cuando quieras.`;
const SAVE = Math.max(...PLANS.map(annualSavingPct));

export function generateMetadata(): Metadata {
  const d = description();
  return { title: TITLE, description: d, ...social({ title: "Precios de Banana Burn", description: d, path: "/precios", og: { t: "Precios claros, 7 días gratis", s: offer().card ? "Entreno o Entreno + Nutrición, en dólares. Pruébalo sin tarjeta." : "Entreno o Entreno + Nutrición, en dólares, con todo incluido para probar.", v: "record" } }) };
}

export default function Precios() {
  const o = offer();
  const PRICING_FAQ = pricingFaq();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={ldScript(faqJsonLd(PRICING_FAQ))} />
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-16">
        <div className="text-center max-w-2xl mx-auto mb-10 animate-rise">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-ink text-balance">Pruébalo {TRIAL_DAYS} días gratis. Después, elige tu plan.</h1>
          <p className="mt-4 text-lg text-muted text-pretty">{o.pricingTrial} Luego entrenas con tu rutina de recomposición, o le sumas nutrición para bajar de peso más rápido. Con el pago anual ahorras {SAVE} %.</p>
        </div>
        <h2 className="sr-only">Planes</h2>
        <Pricing trialGuarantee={o.guarantee} />
      </section>
      <Compare />
      <Faq id="faq" items={PRICING_FAQ} aside={<FaqCta cta="precios-faq" />} />
    </>
  );
}
