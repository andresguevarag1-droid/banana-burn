import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "@/components/icons";
import { Pricing } from "@/components/pricing";
import { PLANS, annualSavingPct } from "@/lib/plans";
import { TRIAL_DAYS } from "@/lib/copy";
import { REMINDER_DAYS_BEFORE } from "@/lib/trial";
import { offerFor } from "@/lib/i18n/offer";
import { Faq } from "../../(marketing)/parts";
import { StickyCta } from "../../(marketing)/sticky-cta";
import { faqJsonLd, ldScript, ogImage } from "../../(marketing)/seo";
import { CTA_EN, FROM_EN, SIGNUP_EN, homeFaqEn } from "../content";

// Precios en inglés (#287). Los mismos planes y precios en USD que /precios.
export const revalidate = 3600;

const SAVE = Math.max(...PLANS.map(annualSavingPct));
const TITLE = `Pricing: your personal trainer in your pocket from ${FROM_EN}/month`;

export function generateMetadata(): Metadata {
  const o = offerFor("en-US");
  const description = `${o.seo} Then Training from ${FROM_EN}/month, or add nutrition. Cancel anytime.`;
  const img = ogImage("Simple pricing, 7 days free", "Training or Training + Nutrition, in US dollars.", "record");
  return {
    title: { absolute: TITLE },
    description,
    alternates: { canonical: "/en/pricing", languages: { "en-US": "/en/pricing", "es-419": "/precios", "x-default": "/precios" } },
    openGraph: { title: "Banana Burn pricing", description, url: "/en/pricing", siteName: "Banana Burn", locale: "en_US", type: "website", images: [img] },
    twitter: { card: "summary_large_image", title: "Banana Burn pricing", description, images: [img.url] },
  };
}

export default function EnglishPricing() {
  const o = offerFor("en-US");
  const faq = homeFaqEn().filter(([q]) => q !== "Can I train at home?" && q !== "Do I need to know how to work out?");
  const steps: [string, string][] = o.cardRequired ? [
    [`Try it for ${TRIAL_DAYS} days`, "Create your account and add your card. Nothing is charged today. Try workouts, nutrition and Banana Shield before you decide what you need."],
    ["We remind you before any charge", `We remind you ${REMINDER_DAYS_BEFORE} days before the charge. On day ${TRIAL_DAYS + 1} your plan is charged, with your first monthly payment at half price.`],
    ["Decide if you keep going", "The charge is automatic unless you cancel before from My plan. If you cancel, nothing is charged and your progress stays saved."],
  ] : [
    [`Try it for ${TRIAL_DAYS} days`, "Create your account, no card needed. Try workouts, nutrition and Banana Shield before you decide what you need."],
    ["We remind you before any charge", `If you save your card, we remind you ${REMINDER_DAYS_BEFORE} days before the scheduled charge. Saving it is optional.`],
    ["Decide if you keep going", "With no card saved, you pick and pay for your plan when the trial ends, and your progress stays saved. With a card saved, the charge is automatic unless you cancel before from My plan."],
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={ldScript(faqJsonLd(faq))} />
      <section id="hero" className="bg-banana">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          <p className="text-sm font-bold text-ink tabular-nums">{TRIAL_DAYS} days free{o.cardRequired ? ", everything included" : ", no card needed"}</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-extrabold tracking-tight text-ink text-balance sm:text-5xl">Get stronger with a plan that guides you every day</h1>
          <p className="mt-4 max-w-xl text-body text-pretty">Your workouts, your weights and your progress in one place. Try everything, then decide if you want to add nutrition.</p>
          <div data-sticky-anchor className="mt-5"><Link href={SIGNUP_EN} data-cta="precios-hero" className="btn-primary min-h-12 w-full sm:w-auto">{CTA_EN}<ArrowRight aria-hidden className="size-5" /></Link></div>
          <p className="mt-2 text-sm text-ink">Cancel anytime from My plan.</p>
        </div>
      </section>

      <section id="plans" aria-labelledby="plans-title" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h2 id="plans-title" className="text-3xl font-extrabold tracking-tight text-ink">Pick what you want to keep</h2>
        <p className="mt-3 mb-8 max-w-2xl text-body">{o.pricingIntro(SAVE)}</p>
        <Pricing trialGuarantee={o.guarantee} trialLabel={CTA_EN} />
      </section>

      <section aria-labelledby="billing-title" className="bg-cream py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 id="billing-title" className="text-3xl font-extrabold tracking-tight text-ink">How billing works</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">{steps.map(([title, detail], i) => <li key={title} className="card p-5"><span className="grid size-11 place-items-center rounded-2xl bg-banana font-extrabold tabular-nums text-ink">{i + 1}</span><h3 className="mt-4 text-lg font-extrabold text-ink">{title}</h3><p className="mt-2 text-body text-pretty">{detail}</p></li>)}</ol>
        </div>
      </section>

      <div className="pb-12"><Faq id="faq" items={faq} title="Frequently asked questions" more="Anything else? Email us at" /></div>
      <section data-sticky-hide className="bg-banana">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <h2 className="max-w-2xl text-3xl font-extrabold tracking-tight text-ink text-balance">Your next workout starts with one simple decision</h2>
          <p className="mt-3 text-body">{o.note}</p>
          <div className="mt-5"><Link href={SIGNUP_EN} data-cta="precios-final" className="btn-primary min-h-12 w-full sm:w-auto">{CTA_EN}<ArrowRight aria-hidden className="size-5" /></Link></div>
        </div>
      </section>
      <StickyCta note={o.note}><Link href={SIGNUP_EN} data-cta="precios-sticky" className="btn-primary min-h-12 px-4 text-sm">Try it free</Link></StickyCta>
    </>
  );
}
