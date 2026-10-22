import { Pricing } from "@/components/pricing";
import { PLANS, annualSavingPct } from "@/lib/plans";
import { TRIAL_DAYS } from "@/lib/copy";
import { Faq } from "../parts";
import { faqJsonLd, ldScript, social } from "../seo";
import { Compare, FaqCta, FROM, PRICING_FAQ } from "../content";

const TITLE = `Precios: entrenador personal con IA desde ${FROM} al mes`;
const DESCRIPTION = `Prueba Banana Burn ${TRIAL_DAYS} días gratis, sin tarjeta. Después, Entreno desde ${FROM} al mes con el plan anual, o súmale nutrición con comida latina de verdad. Cancela cuando quieras.`;
const SAVE = Math.max(...PLANS.map(annualSavingPct));

export const metadata = { title: TITLE, description: DESCRIPTION, ...social({ title: "Precios de Banana Burn", description: DESCRIPTION, path: "/precios", og: { t: "Precios claros, 7 días gratis", s: "Entreno o Entreno + Nutrición, en dólares y sin tarjeta para probar.", v: "record" } }) };

export default function Precios() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={ldScript(faqJsonLd(PRICING_FAQ))} />
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-16">
        <div className="text-center max-w-2xl mx-auto mb-10 animate-rise">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-ink text-balance">Pruébalo {TRIAL_DAYS} días gratis. Después, elige tu plan.</h1>
          <p className="mt-4 text-lg text-muted text-pretty">En la prueba tienes todo incluido y no pedimos tarjeta. Luego entrenas con tu coach IA, o le sumas nutrición para bajar de peso más rápido. Con el pago anual ahorras {SAVE} %.</p>
        </div>
        <h2 className="sr-only">Planes</h2>
        <Pricing />
      </section>
      <Compare />
      <Faq id="faq" items={PRICING_FAQ} aside={<FaqCta cta="precios-faq" />} />
    </>
  );
}
