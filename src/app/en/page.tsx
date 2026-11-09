import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Barbell, Check, House, Scales, Timer } from "@/components/icons";
import { Phone } from "@/components/phone";
import { Pricing } from "@/components/pricing";
import { PLANS, annualSavingPct } from "@/lib/plans";
import { TRIAL_DAYS } from "@/lib/copy";
import { offerFor } from "@/lib/i18n/offer";
import { cardRequiredNow } from "@/lib/card-required";
import { Faq } from "../(marketing)/parts";
import { StickyCta } from "../(marketing)/sticky-cta";
import { faqJsonLd, ldScript, ogImage } from "../(marketing)/seo";
import { CTA_EN, FROM_EN, SIGNIN_EN, SIGNUP_EN, homeFaqEn } from "./content";

// Portada en inglés para Estados Unidos (#287). Pública e igual para todos: ISR, se regenera cada hora.
export const revalidate = 3600;

const SAVE = Math.max(...PLANS.map(annualSavingPct));
const TITLE = "Banana Burn: your personal trainer in your pocket";

export function generateMetadata(): Metadata {
  const description = `The body recomposition app that tells you exactly what to lift today, how much weight to use and how to do every rep. ${offerFor("en-US").seo}`;
  const img = ogImage("Lose fat, keep your muscle", "Your personal trainer in your pocket.");
  return {
    title: { absolute: TITLE },
    description,
    alternates: { canonical: "/en", languages: { "en-US": "/en", "es-419": "/", "x-default": "/" } },
    openGraph: { title: TITLE, description, url: "/en", siteName: "Banana Burn", locale: "en_US", type: "website", images: [img] },
    twitter: { card: "summary_large_image", title: TITLE, description, images: [img.url] },
  };
}

const UGC = "https://d8j0ntlcm91z4.cloudfront.net/user_3KlOTMXim7g88SAyF4A03SG6JZ6/";
const POSE = {
  flex: `${UGC}hf_20261023_061301_ed14348a-1464-482d-8fee-fbe951fd4d44.png`,
  barra: `${UGC}hf_20261023_061358_9ff0ae8e-4afd-4a93-bb85-4207b5a2c361.png`,
  saluda: `${UGC}hf_20261023_061412_513c4e96-cb2a-46a6-ad65-6065ac48bb64.png`,
  salta: `${UGC}hf_20261023_061411_c121bf5f-06b1-4af8-95a3-2854fcde1109.png`,
};

const trust = (now = new Date()) => [`${TRIAL_DAYS} days free`, cardRequiredNow(now) ? "No charge today" : "No card needed", "Cancel anytime", "Beginner friendly"];

const FOR_WHO: { icon: typeof Scales; t: string; d: string }[] = [
  { icon: Scales, t: "You're losing weight fast", d: "With diet, Ozempic or Mounjaro. You want the weight you lose to be fat, not muscle." },
  { icon: Barbell, t: "You've never really trained", d: "You don't know what to do at the gym or how much weight to use. We show you, step by step." },
  { icon: Timer, t: "You're short on time", d: "Sessions from 15 to 60 minutes, plus 10-minute express workouts for busy days." },
  { icon: House, t: "Gym or home, it works", d: "Your plan uses what you have: a full gym, dumbbells, bands or just your body." },
];

const STEPS: [string, string][] = [
  ["Tell us where you're starting", "Your weight, your goal, how many days you can train and what equipment you have. Takes 2 minutes."],
  ["Get your plan", "Your week of workouts, with every exercise, set, rep and the weight to use."],
  ["Train and let it adjust", "Log your sets and the plan raises your weights. Every week it reads your real weight and adjusts."],
];

const PILLARS: { n: string; t: string; d: string }[] = [
  { n: "01", t: "Strength that goes up every week", d: "Every set comes with the exact weight. Hit your reps and it goes up next time. That's how you rebuild muscle." },
  { n: "02", t: "Fresh exercises at your level", d: "Variations rotate every week so you don't plateau, with animated form from Coach Banana. At the gym, at home or with no equipment." },
  { n: "03", t: "Enough protein, with your food", d: "No protein, no muscle. With Training + Nutrition you know how much to eat and log it with the food you already eat." },
];

const H2 = "text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.03em] text-ink text-balance";
const CTA_CLASS = "pressable inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-ink px-8 text-base font-extrabold text-banana shadow-lift hover:bg-black sm:w-auto";

export default function EnglishHome() {
  const o = offerFor("en-US");
  const faq = homeFaqEn();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={ldScript(faqJsonLd(faq))} />

      <section id="hero" className="relative overflow-hidden bg-banana">
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 size-[28rem] rounded-full bg-white/25 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 pb-12 pt-6 sm:px-6 sm:pt-12 lg:grid-cols-[1.15fr_1fr] lg:gap-6 lg:pb-20 lg:pt-16">
          <div className="animate-rise">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-bold text-banana sm:text-sm">
              <Barbell weight="duotone" aria-hidden className="size-4" />For anyone who lost weight fast
            </p>
            <h1 className="text-[2.5rem] leading-[1.03] sm:text-6xl lg:text-[4.25rem] font-extrabold tracking-[-0.04em] text-ink text-balance">You lost the weight. Now keep your muscle.</h1>
            <p className="mt-4 max-w-[34rem] text-[17px] sm:text-xl leading-relaxed text-ink/85 text-pretty"><b className="text-ink">Your personal trainer in your pocket.</b> It tells you what to train today, how much weight to use and how to do every exercise, even if you&apos;ve never trained before.</p>
            <div data-sticky-anchor className="mt-6">
              <Link href={SIGNUP_EN} data-cta="hero" className={CTA_CLASS}>{CTA_EN} <ArrowRight weight="bold" className="size-5" /></Link>
            </div>
            <ul aria-label="Terms" className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm font-bold text-ink">
              {trust().map((t) => <li key={t} className="flex items-center gap-1.5"><Check weight="bold" aria-hidden className="size-4 shrink-0" />{t}</li>)}
            </ul>
            <p className="mt-3 text-sm text-ink/75">{o.from(FROM_EN)} Already have an account? <Link href={SIGNIN_EN} data-cta="hero-entrar" className="tap inline-flex font-bold text-ink underline underline-offset-4">Sign in</Link></p>
          </div>
          <div className="relative isolate mx-auto h-[460px] w-full max-w-[470px] sm:h-[640px]">
            <div className="absolute left-1/2 top-0 -translate-x-1/2 sm:left-auto sm:right-0 sm:translate-x-0">
              <Phone src="/landing/entreno.png" alt="The Banana Burn workout screen with today's exercise, the set and the weight to use" sizes="300px" priority className="w-[300px] origin-top scale-[.76] sm:scale-100" />
            </div>
            <div className="absolute -bottom-2 -left-2 w-[135px] sm:w-[230px]">
              <Image src={POSE.flex} alt="Coach Banana, the Banana Burn coach" width={460} height={460} sizes="(min-width: 640px) 230px, 135px" className="drop-shadow-xl" />
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="for-you" className="mx-auto max-w-6xl px-4 pt-16 sm:px-6 sm:pt-24">
        <h2 id="for-you" className={`${H2} max-w-3xl`}>It&apos;s for you if…</h2>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FOR_WHO.map(({ icon: I, t, d }) => (
            <li key={t} className="flex gap-4 rounded-[1.5rem] border border-line bg-white p-5 lg:flex-col">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-banana text-ink"><I weight="duotone" aria-hidden className="size-6" /></span>
              <div><h3 className="text-lg font-extrabold text-ink text-balance">{t}</h3><p className="mt-1 leading-relaxed text-muted text-pretty">{d}</p></div>
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-[62ch] text-lg font-semibold text-ink text-pretty">When you lose weight fast, part of what you lose is muscle. That&apos;s why you feel soft, weaker, and the weight comes back more easily. The good news: muscle comes back, and we show you how.</p>
      </section>

      <section id="how-it-works" aria-labelledby="how-t" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-16 sm:px-6 sm:pt-24">
        <div className="flex items-end justify-between gap-4">
          <h2 id="how-t" className={`${H2} max-w-3xl`}>Here&apos;s how it works.</h2>
          <Image src={POSE.saluda} alt="Coach Banana waving with a phone in hand" width={360} height={360} sizes="(min-width: 640px) 176px, 96px" className="-mb-4 w-24 shrink-0 sm:w-44" />
        </div>
        <ol className="mt-8 grid gap-3 lg:grid-cols-3">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="flex gap-4 rounded-[1.5rem] bg-cream p-5 sm:p-6 lg:flex-col">
              <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-lg font-extrabold tabular-nums text-banana">{i + 1}</span>
              <div><h3 className="text-lg font-extrabold text-ink text-balance">{t}</h3><p className="mt-1 leading-relaxed text-muted text-pretty">{d}</p></div>
            </li>
          ))}
        </ol>
        <Link href={SIGNUP_EN} data-cta="pasos" className={`${CTA_CLASS} mt-6`}>{CTA_EN} <ArrowRight weight="bold" className="size-5" /></Link>
      </section>

      <section aria-labelledby="method" className="pt-16 sm:pt-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-[2.25rem] bg-ink p-6 text-white sm:p-12 lg:p-16">
            <Image src={POSE.barra} alt="" width={420} height={420} sizes="224px" className="pointer-events-none absolute right-8 top-8 hidden w-44 lg:block xl:right-12 xl:top-10 xl:w-56" />
            <p className="w-fit rounded-full bg-banana px-3.5 py-1.5 text-sm font-extrabold text-ink">The method</p>
            <h2 id="method" className="mt-5 max-w-3xl lg:max-w-[calc(100%-12rem)] xl:max-w-3xl text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.03em] text-balance">Less fat, <span className="text-banana">more muscle</span>, at the same time.</h2>
            <ol className="mt-8 grid gap-3 lg:grid-cols-3">
              {PILLARS.map((p) => (
                <li key={p.n} className="rounded-[1.5rem] bg-white/[.06] p-5 sm:p-6">
                  <p className="text-3xl font-extrabold tabular-nums text-banana">{p.n}</p>
                  <h3 className="mt-2 text-lg font-extrabold text-balance">{p.t}</h3>
                  <p className="mt-1.5 leading-relaxed text-white/75 text-pretty">{p.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6 sm:pt-24">
        <div className="rounded-[2rem] bg-cream p-6 sm:p-12">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink text-balance">I built it because I needed it.</h2>
          <p className="mt-4 max-w-[60ch] text-lg leading-relaxed text-ink/80 text-pretty">I&apos;m Andrés, the founder, and I&apos;m user number 1. My goal: from 207 to 187 lb by December 31, without losing muscle. No app told me exactly what to do at the gym today, with the food I actually eat.</p>
          <p className="mt-3 max-w-[60ch] leading-relaxed text-ink/80 text-pretty">Write to me at <a href="mailto:hola@bananaburn.app" className="tap font-bold text-ink underline underline-offset-2">hola@bananaburn.app</a> and it comes straight to me.</p>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-16 sm:px-6 sm:pt-24">
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <h2 className={H2}>Less than one session with a trainer.</h2>
          <p className="mt-4 text-lg text-muted text-pretty">{o.pricingIntro(SAVE)}</p>
        </div>
        <Pricing trialGuarantee={o.guarantee} trialLabel={CTA_EN} />
      </section>

      <Faq id="faq" items={faq} title="Frequently asked questions" more="Anything else? Email us at" />

      <section data-sticky-hide className="mx-auto max-w-6xl px-4 pt-16 sm:px-6 sm:pt-24">
        <div className="relative overflow-hidden rounded-[2.25rem] bg-banana px-6 pb-6 pt-12 text-center sm:px-16 sm:pb-8 sm:pt-16">
          <h2 className={`${H2} mx-auto max-w-3xl`}>Your new body starts with your first workout.</h2>
          <Link href={SIGNUP_EN} data-cta="final" className={`${CTA_CLASS} mt-8`}>{CTA_EN} <ArrowRight weight="bold" className="size-5" /></Link>
          <p className="mt-4 text-sm font-semibold text-ink/80">{o.note} {o.from(FROM_EN)}</p>
          <Image src={POSE.salta} alt="" width={420} height={420} sizes="(min-width: 640px) 240px, 176px" className="mx-auto mt-6 w-36 sm:w-60" />
        </div>
      </section>

      <StickyCta note={o.note}><Link href={SIGNUP_EN} data-cta="sticky" className="btn-primary h-12 shrink-0 px-5">Try it free <ArrowRight className="size-4" /></Link></StickyCta>
    </>
  );
}
