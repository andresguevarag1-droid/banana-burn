import { Pricing } from "@/components/pricing";
import { ANNUAL_SEASON_NOTE, PLANS } from "@/lib/plans";
import { TRIAL_DAYS } from "@/lib/copy";
import { Faq } from "../parts";
import { faqJsonLd, ldScript, social } from "../seo";
import { SIGNUP, FROM, faq, pricingFaq } from "../content";
import { offer } from "@/lib/offer";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "@/components/icons";
import { Phone } from "@/components/phone";
import { REMINDER_DAYS_BEFORE } from "@/lib/trial";
import { StickyCta } from "../sticky-cta";
import type { Metadata } from "next";

// Pública e igual para todos: ISR (la CDN la sirve y se regenera cada hora; nada depende de la persona).
export const revalidate = 3600;

const TITLE = `Precios: tu entrenador personal en el celular desde ${FROM} al mes`;
/** Según la fecha (offer.ts): la prueba no pide tarjeta; la beta es gratis hasta el 7 de noviembre. */
const description = () => `${offer().card ? `Prueba Banana Burn ${TRIAL_DAYS} días gratis con todo incluido, sin tarjeta.` : `Prueba Banana Burn ${TRIAL_DAYS} días gratis con todo incluido.`} Después, Entreno desde ${FROM} al mes, o súmale nutrición con comida latina de verdad. Cancela cuando quieras.`;
const CTA = `Empieza ${TRIAL_DAYS} días gratis`;
const ENTRENO = PLANS.find((p) => p.id === "entreno")!;
const COMPLETO = PLANS.find((p) => p.id === "completo")!;

function Start({ location }: { location: string }) {
  return <div><Link href={SIGNUP} data-cta={`precios-${location}`} className="btn-primary min-h-12 w-full sm:w-auto">{CTA}<ArrowRight aria-hidden className="size-5" /></Link><Link href={SIGNUP} data-cta={`precios-${location}-sin-tarjeta`} className="tap mt-1 flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4">Continuar sin tarjeta</Link></div>;
}

export function generateMetadata(): Metadata {
  const d = description();
  return { title: TITLE, description: d, ...social({ title: "Precios de Banana Burn", description: d, path: "/precios", og: { t: "Precios claros, 7 días gratis", s: offer().card ? "Entreno o Entreno + Nutrición, en dólares. Pruébalo sin tarjeta." : "Entreno o Entreno + Nutrición, en dólares, con todo incluido para probar.", v: "record" } }) };
}

export default function Precios() {
  const o = offer();
  const PRICING_FAQ = [
    ...pricingFaq().map(([q, a]) => [q, q === "Uso Ozempic o Mounjaro. ¿Es para mí?" ? "Banana Shield, incluido en Entreno + Nutrición y en tu prueba gratis, combina entrenamiento de fuerza y seguimiento de proteína. Permite ajustar la intensidad en tu día de inyección. No sustituye la indicación de tu médico." : a] as const),
    ["¿Puedo cambiar de plan?", "Sí, desde Mi plan. Si ya tienes una suscripción, el nuevo plan empieza cuando se confirma su pago y reemplaza al actual, sin prorrateo. Si cambias desde un anual, el tiempo restante no se reembolsa ni se descuenta; puedes cancelar la renovación y esperar a que termine tu año."],
    ...faq().filter(([q]) => q === "¿Cómo pago?"),
  ] as const;
  const steps = [
    [`Prueba ${TRIAL_DAYS} días`, "Crea tu cuenta sin tarjeta. Prueba el entreno, la nutrición y Banana Shield antes de elegir qué necesitas."],
    ["Te avisamos antes del cobro", `Si guardas tu tarjeta, te avisamos ${REMINDER_DAYS_BEFORE} días antes del cobro programado. Guardarla es opcional; puedes continuar sin tarjeta.`],
    ["Decide si sigues", "Sin tarjeta guardada, eliges y pagas tu plan al terminar; tu progreso queda guardado. Con tarjeta guardada, el cobro es automático salvo que canceles antes desde Mi plan."],
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={ldScript(faqJsonLd(PRICING_FAQ))} />
      <section id="hero" className="bg-banana">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-8 sm:px-6 sm:py-12 md:grid-cols-[1fr_240px]">
          <div>
            <p className="text-sm font-bold text-ink tabular-nums">{TRIAL_DAYS} días gratis, sin tarjeta</p>
            <h1 className="mt-3 max-w-2xl text-4xl font-extrabold tracking-tight text-ink text-balance sm:text-5xl">Gana fuerza con un plan que te guía cada día</h1>
            <p className="mt-4 max-w-xl text-body text-pretty">Tu rutina, tus cargas y tu progreso en un solo lugar. Prueba todo y decide si también quieres sumar nutrición.</p>
            <div data-sticky-anchor className="mt-5"><Start location="hero" /></div>
            <p className="mt-1 text-sm text-ink">Cancelas cuando quieras desde Mi plan.</p>
          </div>
          <Image src="/brand/mascota-sola.webp" alt="Coach Banana, tu guía de entrenamiento" width={240} height={300} sizes="240px" className="hidden h-[300px] w-[240px] object-contain md:block" />
        </div>
      </section>

      <section id="planes" aria-labelledby="planes-title" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h2 id="planes-title" className="text-3xl font-extrabold tracking-tight text-ink">Elige lo que quieres seguir usando</h2>
        <p className="mt-3 max-w-2xl text-body">{o.pricingTrial} Compara lo que incluye cada plan después de la prueba.</p>
        <p className="mt-4 mb-8 rounded-2xl border border-line bg-banana-soft p-4 font-bold text-ink">Anual: {ANNUAL_SEASON_NOTE.toLowerCase()} por cada año pagado.</p>
        <Pricing trialGuarantee={o.guarantee} trialLabel={CTA} />
      </section>

      <section aria-labelledby="cobro-title" className="bg-cream py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 id="cobro-title" className="text-3xl font-extrabold tracking-tight text-ink">Cómo funciona el cobro</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">{steps.map(([title, detail], i) => <li key={title} className="card p-5"><span className="grid size-11 place-items-center rounded-2xl bg-banana font-extrabold tabular-nums text-ink">{i + 1}</span><h3 className="mt-4 text-lg font-extrabold text-ink">{title}</h3><p className="mt-2 text-body text-pretty">{detail}</p></li>)}</ol>
        </div>
      </section>

      <section aria-labelledby="para-ti" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h2 id="para-ti" className="text-3xl font-extrabold tracking-tight text-ink">¿Qué plan va contigo?</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          <article className="card p-5"><h3 className="text-xl font-extrabold text-ink">Si empiezas en el gym</h3><p className="mt-3 font-bold text-banana-ink">{ENTRENO.name}</p><p className="mt-2 text-body">Empieza con una rutina a tu nivel y animaciones de técnica. Registra tus cargas y sigue tu progreso sin tener que armar cada sesión.</p><Phone src="/landing/entreno-top.webp" alt="Entreno real de Banana Burn con los ejercicios del día" sizes="180px" className="mx-auto mt-6 w-[180px]" /></article>
          <article className="card p-5"><h3 className="text-xl font-extrabold text-ink">Si bajaste de peso rápido o usas GLP-1</h3><p className="mt-3 font-bold text-banana-ink">{COMPLETO.name}</p><p className="mt-2 text-body">Suma el seguimiento de comida y proteína a tu fuerza. Banana Shield está incluido en este plan y en la prueba.</p><p className="mt-3 text-sm font-semibold text-ink">No sustituye la indicación de tu médico.</p><ul className="mt-5 space-y-3 text-sm text-body">{COMPLETO.feats.slice(1, 4).map((f) => <li key={f} className="border-t border-line pt-3">{f}</li>)}</ul></article>
          <article className="card p-5"><h3 className="text-xl font-extrabold text-ink">Si corres con Banana Run</h3><p className="mt-3 font-bold text-banana-ink">Tu plan + Temporada Running</p><p className="mt-2 text-body">La Temporada Running suma Banana Run completo y fuerza alrededor de tus carreras. Se compra aparte; el plan anual: {ANNUAL_SEASON_NOTE.toLowerCase()} por cada año pagado.</p><Link href="/temporadas" className="tap mt-3 inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-4">Conoce las temporadas</Link><Phone src="/landing/running-plan.webp" alt="Plan real de Banana Run con la semana de carrera" sizes="180px" className="mx-auto mt-6 w-[180px]" /></article>
        </div>
      </section>

      <div className="pb-12"><Faq id="faq" items={PRICING_FAQ} /></div>
      <section data-sticky-hide className="bg-banana">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <h2 className="max-w-2xl text-3xl font-extrabold tracking-tight text-ink text-balance">Tu próximo entreno empieza con una decisión sencilla</h2>
          <p className="mt-3 text-body">Prueba {TRIAL_DAYS} días con todo incluido, sin tarjeta. Después eliges tu plan.</p>
          <div className="mt-5"><Start location="final" /></div>
        </div>
      </section>
      <StickyCta note="Sin tarjeta"><div className="flex flex-col items-center"><Link href={SIGNUP} data-cta="precios-sticky" className="btn-primary min-h-12 px-4 text-sm">{CTA}</Link><Link href={SIGNUP} data-cta="precios-sticky-sin-tarjeta" className="tap inline-flex min-h-11 items-center text-xs font-semibold text-ink underline">Continuar sin tarjeta</Link></div></StickyCta>
    </>
  );
}
