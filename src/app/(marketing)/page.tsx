import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowCounterClockwise, ArrowRight, Barbell, Check, CreditCard, House, Lock, Scales, Scroll, ShieldCheck, Syringe, Timer,
} from "@/components/icons";
import { Phone } from "@/components/phone";
import { Pricing } from "@/components/pricing";
import { PLANS, annualSavingPct } from "@/lib/plans";
import { TRIAL_DAYS } from "@/lib/copy";
import { Faq } from "./parts";
import { StickyCta } from "./sticky-cta";
import { InstallSection } from "./install-section";
import { ExtrasSection, LearnSection, OfferBand, PlatanitaSection } from "./new-sections";
import { AppTour } from "./app-tour";
import { HeroPlayer } from "./hero-player";
import { appJsonLd, faqJsonLd, ldScript, orgJsonLd, social } from "./seo";
import { ANIMATED_TECHNIQUES, FaqCta, FROM, GLP1, SIGNUP, SIGNUP_GLP1, homeFaq } from "./content";
import { offer } from "@/lib/offer";
import { LIB_COUNT } from "@/lib/library";

const SAVE = Math.max(...PLANS.map(annualSavingPct));
const CTA = "Crear mi plan gratis";

const TITLE = "Banana Burn: reconstruye tu cuerpo después de bajar de peso";
/** Descripción según la fecha (offer.ts): la prueba sin tarjeta hasta el fin de la beta, con tarjeta después. */
const description = () => `La app de recomposición corporal que reemplaza a tu entrenador personal: rutina exacta, el peso de cada serie y ejercicios con técnica animada. ${offer().seo}`;

export function generateMetadata(): Metadata {
  const d = description();
  return {
    title: { absolute: TITLE },
    description: d,
    ...social({ title: TITLE, description: d, path: "/", og: { t: "Bajaste de peso. Ahora reconstruye tu cuerpo.", s: "Tu entrenador personal en el celular, con rutina de recomposición corporal.", v: "gym" } }),
  };
}

const UGC_BASE = "https://d8j0ntlcm91z4.cloudfront.net/user_3KlOTMXim7g88SAyF4A03SG6JZ6/";
/** Coach Banana en distintas poses (fondo transparente). */
const POSE = {
  flex: `${UGC_BASE}hf_20261023_061301_ed14348a-1464-482d-8fee-fbe951fd4d44.png`,
  bascula: `${UGC_BASE}hf_20261023_061356_83ad4af0-f8c7-4a04-8ff6-090e8e2dd637.png`,
  barra: `${UGC_BASE}hf_20261023_061358_9ff0ae8e-4afd-4a93-bb85-4207b5a2c361.png`,
  senala: `${UGC_BASE}hf_20261023_061359_e2ce4b14-b277-48d0-9b21-a0ead0d7a0c3.png`,
  entrenador: `${UGC_BASE}hf_20261023_061409_d0198d87-fa4d-4ff8-aaec-e30ab735a6e0.png`,
  salta: `${UGC_BASE}hf_20261023_061411_c121bf5f-06b1-4af8-95a3-2854fcde1109.png`,
  saluda: `${UGC_BASE}hf_20261023_061412_513c4e96-cb2a-46a6-ad65-6065ac48bb64.png`,
};

/** Los tres pilares del método. */
const PILLARS: { n: string; t: string; d: string }[] = [
  { n: "01", t: "Fuerza que sube cada semana", d: "Cada serie trae el peso exacto. Si completas tus repeticiones, la próxima vez sube. Así le pides al cuerpo que reconstruya músculo." },
  { n: "02", t: "Ejercicios novedosos, a tu nivel", d: "Variantes que rotan cada semana para que no te estanques, con técnica animada por Coach Banana. En gym, en casa o sin equipo." },
  { n: "03", t: "Proteína suficiente, con tu comida", d: "Sin proteína no hay músculo. Con Entreno + Nutrición sabes cuánta comer y la registras con la comida latina que ya comes." },
];

/** Lo que hace la app, entendido en 5 segundos. */
const HERO_TRUST = [`${TRIAL_DAYS} días gratis`, "Sin tarjeta", "Cancelas cuando quieras", "Te enseñamos desde cero"];

const STEPS: [string, string][] = [
  ["Cuéntanos de dónde vienes", "Tu peso, tu meta, cuántos días puedes entrenar y con qué equipo. Toma 2 minutos."],
  ["Recibe tu rutina de recomposición", "Tu plan de la semana, con cada ejercicio, series, repeticiones y el peso que te toca."],
  ["Entrena y deja que se ajuste solo", "Registras tus series y el plan sube las cargas. Cada semana lee tu peso real y corrige el rumbo."],
];

const FOR_WHO: { icon: typeof Syringe; t: string; d: string }[] = [
  { icon: Scales, t: "Estás bajando de peso rápido", d: "Con dieta o con Ozempic o Mounjaro. Quieres que lo que bajes sea grasa, no tu músculo." },
  { icon: Barbell, t: "Nunca has entrenado", d: "No sabes qué hacer en el gym ni cuánto peso usar. Te lo enseñamos paso a paso." },
  { icon: Timer, t: "Tienes poco tiempo", d: "Sesiones de 15 a 60 minutos, y entrenos exprés de 10 minutos para los días apretados." },
  { icon: House, t: "Entrenas en casa o en el gym", d: "El plan usa lo que tienes: gym, mancuernas, bandas o sin equipo." },
];

const risk = (): [typeof Lock, string][] => [
  [CreditCard, offer().riskLine],
  [ArrowCounterClockwise, "Cancelas cuando quieras"],
  [Scroll, "8 días hábiles de retracto al pagar"],
  [Lock, "Pago seguro con ONVO Pay"],
];

const H2 = "text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.03em] text-ink text-balance";
const LEAD = "mt-5 text-lg sm:text-xl text-muted leading-relaxed text-pretty max-w-[58ch]";

export default function Landing() {
  const o = offer();
  const faqItems = homeFaq();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={ldScript(appJsonLd())} />
      <script type="application/ld+json" dangerouslySetInnerHTML={ldScript(orgJsonLd())} />
      <script type="application/ld+json" dangerouslySetInnerHTML={ldScript(faqJsonLd(faqItems))} />

      {/* 1. HERO: en 5 segundos, qué es, para quién y qué hacer. Un solo botón principal; la ayuda de instalación va más abajo. */}
      <section id="hero" className="relative overflow-hidden bg-banana">
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 size-[28rem] rounded-full bg-white/25 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 pb-12 pt-6 sm:px-6 sm:pt-12 lg:grid-cols-[1.15fr_1fr] lg:gap-6 lg:pb-20 lg:pt-16">
          <div className="animate-rise">
            <p className="inline-flex items-center gap-2 rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-bold text-banana sm:text-sm">
              <Barbell weight="duotone" aria-hidden className="size-4" />Para quien bajó de peso rápido
            </p>
            <h1 className="mt-4 text-[2.5rem] leading-[1.03] sm:text-6xl lg:text-[4.25rem] font-extrabold tracking-[-0.04em] text-ink text-balance">
              Bajaste de peso. Ahora no pierdas tu músculo.
            </h1>
            <p className="mt-4 max-w-[34rem] text-[17px] sm:text-xl leading-relaxed text-ink/85 text-pretty">
              <b className="text-ink">Tu entrenador personal en el celular.</b> Te dice qué entrenar hoy, con cuánto peso y cómo se hace cada ejercicio, aunque nunca hayas entrenado.
            </p>
            <div data-sticky-anchor className="mt-6">
              <Link href={SIGNUP} data-cta="hero" className="pressable inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-ink px-8 text-base font-extrabold text-banana shadow-lift hover:bg-black sm:w-auto">{CTA} <ArrowRight weight="bold" className="size-5" /></Link>
            </div>
            <ul aria-label="Condiciones" className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm font-bold text-ink">
              {HERO_TRUST.map((t) => <li key={t} className="flex items-center gap-1.5"><Check weight="bold" aria-hidden className="size-4 shrink-0" />{t}</li>)}
            </ul>
            <p className="mt-3 text-sm text-ink/75">{o.from(FROM)} ¿Ya tienes cuenta? <Link href="/entrar" data-cta="hero-entrar" className="tap inline-flex font-bold text-ink underline underline-offset-4">Entrar</Link></p>
          </div>

          <div className="relative isolate mx-auto h-[460px] w-full max-w-[470px] sm:h-[640px]">
            <Phone src="/landing/hoy2.png" alt="" sizes="220px" className="absolute left-0 top-10 hidden w-[210px] -rotate-6 opacity-95 sm:block" />
            {/* El teléfono se dibuja siempre a 300 px (como en escritorio) y se escala en el celular: así nada se aprieta ni se corta. */}
            <div className="absolute left-1/2 top-0 -translate-x-1/2 sm:left-auto sm:right-0 sm:translate-x-0">
              <HeroPlayer className="w-[300px] origin-top scale-[.76] sm:scale-100" />
            </div>
            <div className="absolute -bottom-2 -left-2 w-[135px] sm:w-[230px]">
              <Image src={POSE.flex} alt="Coach Banana, el entrenador de Banana Burn" width={460} height={460} sizes="(min-width: 640px) 230px, 135px" className="drop-shadow-xl" />
            </div>
          </div>
        </div>
      </section>

      {/* 2. PARA TI SI: que la persona se reconozca de inmediato */}
      <section aria-labelledby="para-quien" className="mx-auto max-w-6xl px-4 pt-16 sm:px-6 sm:pt-24">
        <h2 id="para-quien" className={`${H2} max-w-3xl`}>Es para ti si…</h2>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FOR_WHO.map(({ icon: I, t, d }) => (
            <li key={t} className="flex gap-4 rounded-[1.5rem] border border-line bg-white p-5 lg:flex-col">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-banana text-ink"><I weight="duotone" aria-hidden className="size-6" /></span>
              <div>
                <h3 className="text-lg font-extrabold text-ink text-balance">{t}</h3>
                <p className="mt-1 leading-relaxed text-muted text-pretty">{d}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-[62ch] text-lg font-semibold text-ink text-pretty">Cuando bajas rápido, parte de lo que pierdes es músculo: por eso te ves flácido, tienes menos fuerza y es más fácil recuperar el peso. La buena noticia: el músculo se recupera, y te enseñamos cómo.</p>
      </section>

      {/* 3. CÓMO FUNCIONA: 3 pasos */}
      <section id="como-funciona" aria-labelledby="como-t" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-16 sm:px-6 sm:pt-24">
        <div className="flex items-end justify-between gap-4">
          <h2 id="como-t" className={`${H2} max-w-3xl`}>Así de fácil funciona.</h2>
          <Image src={POSE.saluda} alt="Coach Banana saludando con el celular en la mano" width={360} height={360} sizes="(min-width: 640px) 176px, 96px" className="-mb-4 w-24 shrink-0 sm:w-44" />
        </div>
        <ol className="mt-8 grid gap-3 lg:grid-cols-3">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="flex gap-4 rounded-[1.5rem] bg-cream p-5 sm:p-6 lg:flex-col">
              <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-lg font-extrabold tabular-nums text-banana">{i + 1}</span>
              <div>
                <h3 className="text-lg font-extrabold text-ink text-balance">{t}</h3>
                <p className="mt-1 leading-relaxed text-muted text-pretty">{d}</p>
              </div>
            </li>
          ))}
        </ol>
        <Link href={SIGNUP} data-cta="pasos" className="pressable mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-ink px-8 text-base font-extrabold text-banana shadow-lift hover:bg-black sm:w-auto">{CTA} <ArrowRight weight="bold" className="size-5" /></Link>
      </section>

      {/* 4. PRUEBA REAL: te enseñamos desde cero (capturas reales) */}
      <LearnSection />

      {/* 5. LA APP POR DENTRO: recorrido con capturas reales y técnica animada */}
      <section id="por-dentro" aria-labelledby="por-dentro-t" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-16 sm:px-6 sm:pt-24">
        <h2 id="por-dentro-t" className={`${H2} max-w-3xl`}>Mira Banana Burn por dentro.</h2>
        <p className={LEAD}>Todo lo que haría un entrenador personal, en tu bolsillo. Toca cada pantalla.</p>
        <AppTour />
        <p className="mt-3 text-sm text-muted">Capturas reales de la app en modo demostración, con datos de ejemplo.</p>
        <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-line pt-8 sm:grid-cols-4">
          {([[LIB_COUNT.toLocaleString("es-419"), "ejercicios con guía"], [String(ANIMATED_TECHNIQUES), "técnicas animadas por Coach Banana"], ["10 min", "el entreno exprés más corto"], [`${TRIAL_DAYS} días`, o.statLabel]] as const).map(([v, l]) => (
            <div key={l} className="flex flex-col-reverse justify-end">
              <dt className="mt-1 text-sm text-muted text-pretty">{l}</dt>
              <dd className="text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 6. MÉTODO: por qué funciona, explicado simple */}
      <section aria-labelledby="metodo" className="pt-16 sm:pt-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-[2.25rem] bg-ink p-6 text-white sm:p-12 lg:p-16">
            <Image src={POSE.barra} alt="" width={420} height={420} sizes="224px" className="pointer-events-none absolute right-8 top-8 hidden w-44 lg:block xl:right-12 xl:top-10 xl:w-56" />
            <p className="w-fit rounded-full bg-banana px-3.5 py-1.5 text-sm font-extrabold text-ink">El método</p>
            <h2 id="metodo" className="mt-5 max-w-3xl lg:max-w-[calc(100%-12rem)] xl:max-w-3xl text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.03em] text-balance">
              Menos grasa, <span className="text-banana">más músculo</span>, al mismo tiempo.
            </h2>
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

      {/* 7. GLP-1: Banana Shield */}
      <section aria-label="Banana Shield" className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        <Link href={SIGNUP_GLP1} data-cta="glp1-banda" className="group grid items-center gap-4 rounded-[1.75rem] bg-banana-soft p-6 text-ink sm:grid-cols-[auto_1fr_auto] sm:p-8 transition-shadow duration-200 hover:shadow-lift focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink">
          <span className="grid size-14 place-items-center rounded-2xl bg-banana text-ink"><ShieldCheck weight="duotone" aria-hidden className="size-8" /></span>
          <span>
            <span className="block text-2xl font-extrabold text-balance">¿Usas {GLP1}? Banana Shield es para ti.</span>
            <span className="mt-1 block text-ink/75 text-pretty">Fuerza y proteína para cuidar tu músculo, con un modo suave en tu día de inyección. Siempre con la guía de tu médico.</span>
          </span>
          <span className="inline-flex items-center gap-2 font-bold text-ink">Empezar con Banana Shield <ArrowRight weight="bold" className="size-5 transition-transform duration-200 ease-[cubic-bezier(.23,1,.32,1)] group-hover:translate-x-1" /></span>
        </Link>
      </section>

      <PlatanitaSection />

      {/* 9. FUNDADOR: historia real, sin testimonios inventados */}
      <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6 sm:pt-24">
        <div className="grid items-center gap-6 rounded-[2rem] bg-cream p-6 sm:p-12 lg:grid-cols-[1.6fr_1fr] lg:gap-14">
          <div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink text-balance">La hice porque yo la necesitaba.</h2>
            <p className="mt-4 max-w-[60ch] text-lg leading-relaxed text-ink/80 text-pretty">Soy Andrés, el fundador, y soy el usuario número 1. Mi meta: de 94 a 85 kg antes del 31 de diciembre, sin perder músculo. Ninguna app me decía qué hacer hoy en el gym, en español y con la comida que como todos los días.</p>
            <p className="mt-3 max-w-[60ch] leading-relaxed text-ink/80 text-pretty">Lo que me escribas a <a href="mailto:hola@bananaburn.app" className="tap font-bold text-ink underline underline-offset-2">hola@bananaburn.app</a> me llega directo.</p>
          </div>
          <div className="relative mx-auto hidden aspect-square w-full max-w-[260px] rounded-[1.75rem] bg-banana lg:block">
            <div className="absolute inset-[7%]">
              <Image src="/brand/mascota-sola.webp" alt="Coach Banana, el mono de Banana Burn" fill sizes="240px" className="object-contain" />
            </div>
          </div>
        </div>
      </section>

      <OfferBand />

      {/* 10. PRECIOS */}
      <section id="precios" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-16 sm:px-6 sm:pt-24">
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <h2 className={H2}>Menos que una sesión con un entrenador.</h2>
          <p className="mt-4 text-lg text-muted text-pretty">{o.pricingIntro(SAVE)}</p>
        </div>
        <Pricing trialGuarantee={o.guarantee} />
      </section>

      {/* 11. EXTRAS: temporadas deportivas y GPS (secundario para quien llega de un anuncio) */}
      <ExtrasSection />

      <InstallSection />

      <Faq id="faq" items={faqItems} aside={<FaqCta cta="faq" />} />

      {/* 12. CTA FINAL con el mono */}
      <section data-sticky-hide className="mx-auto max-w-6xl px-4 pt-16 sm:px-6 sm:pt-24">
        <div className="relative overflow-hidden rounded-[2.25rem] bg-banana px-6 pb-6 pt-12 text-center sm:px-16 sm:pb-8 sm:pt-16">
          <h2 className={`${H2} mx-auto max-w-3xl`}>Tu cuerpo nuevo empieza con el primer entreno.</h2>
          <Link href={SIGNUP} data-cta="final" className="pressable mt-8 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-ink px-8 text-base font-extrabold text-banana shadow-lift hover:bg-black sm:w-auto">{CTA} <ArrowRight weight="bold" className="size-5" /></Link>
          <p className="mt-4 text-sm font-semibold text-ink/80">{o.note} {o.from(FROM)}</p>
          <ul className="mx-auto mt-6 grid w-fit max-w-3xl grid-cols-1 gap-x-6 gap-y-2 text-left text-sm font-semibold text-ink sm:grid-cols-2">
            {risk().map(([I, t]) => <li key={t} className="flex items-center gap-2"><I weight="duotone" aria-hidden className="size-5 shrink-0" />{t}</li>)}
          </ul>
          <Image src={POSE.salta} alt="" width={420} height={420} sizes="(min-width: 640px) 240px, 176px" className="mx-auto mt-6 w-36 sm:w-60" />
        </div>
      </section>

      <StickyCta note={o.note}><Link href={SIGNUP} data-cta="sticky" className="btn-primary h-12 shrink-0 px-5">{CTA} <ArrowRight className="size-4" /></Link></StickyCta>
    </>
  );
}
