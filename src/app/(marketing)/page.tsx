import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowCounterClockwise, ArrowRight, Barbell, BowlFood, Check, CreditCard, Lock, MonkeyBanana, Scales, Scroll, ShieldCheck, Syringe, X,
} from "@/components/icons";
import { Phone } from "@/components/phone";
import { Pricing } from "@/components/pricing";
import { PLANS, annualSavingPct } from "@/lib/plans";
import { TRIAL_DAYS } from "@/lib/copy";
import { Faq, Marker } from "./parts";
import { StickyCta } from "./sticky-cta";
import { AppTour } from "./app-tour";
import { HeroPlayer } from "./hero-player";
import { appJsonLd, faqJsonLd, ldScript, orgJsonLd, social } from "./seo";
import { ANIMATED_TECHNIQUES, Compare, FaqCta, FROM, GLP1, SIGNUP, SIGNUP_GLP1, faq } from "./content";
import { offer } from "@/lib/offer";
import { LIB_COUNT } from "@/lib/library";

const SAVE = Math.max(...PLANS.map(annualSavingPct));
const CTA = "Empezar gratis";

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

/** Escenas ilustrativas (persona real + Coach Banana en caricatura). No son clientes ni testimonios. */
const SCENES: [string, string][] = [
  ["hf_20261022_153719_0be6b29d-ae57-4937-a122-798fdf72baa4", "En el gym: te muestra la técnica de cada ejercicio."],
  ["hf_20261022_155001_e82f1d0e-5f20-4eba-9039-6f62a9d79152", "En la casa: sin equipo y sin excusas."],
  ["hf_20261022_155042_171fc15e-6a39-489f-a615-de397a0bcec2", "A cualquier edad: cargas a tu nivel."],
  ["hf_20261022_155003_11f3b250-6cbe-4354-ab64-49e1d65832ec", "Cada récord se celebra."],
];

/** Lo que vive quien bajó rápido de peso. */
const PAINS: [string, string][] = [
  ["La báscula bajó, pero te ves flácido.", "Bajaste kilos y aun así no te gusta lo que ves en el espejo. Falta firmeza."],
  ["Perdiste fuerza y energía.", "Subir escaleras o cargar las bolsas cuesta más que antes. Eso también es músculo que se fue."],
  ["Te da miedo recuperar todo.", "Sin músculo, tu cuerpo gasta menos y es más fácil volver a subir."],
  ["Un entrenador cuesta demasiado.", "Pagar sesiones cada semana no está en el presupuesto, y en internet nadie te dice qué hacer a ti."],
];

/** Los tres pilares del método. */
const PILLARS: { n: string; t: string; d: string }[] = [
  { n: "01", t: "Fuerza que sube cada semana", d: "Cada serie trae el peso exacto. Si completas tus repeticiones, la próxima vez sube. Así le pides al cuerpo que reconstruya músculo." },
  { n: "02", t: "Ejercicios novedosos, a tu nivel", d: "Variantes que rotan cada semana para que no te estanques, con técnica animada por Coach Banana. En gym, en casa o sin equipo." },
  { n: "03", t: "Proteína suficiente, con tu comida", d: "Sin proteína no hay músculo. Con Entreno + Nutrición sabes cuánta comer y la registras con la comida latina que ya comes." },
];

const STEPS: [string, string][] = [
  ["Cuéntanos de dónde vienes", "Tu peso, tu meta, cuántos días puedes entrenar y con qué equipo. Toma 2 minutos."],
  ["Recibe tu rutina de recomposición", "Tu plan de la semana, con cada ejercicio, series, repeticiones y el peso que te toca."],
  ["Entrena y deja que se ajuste solo", "Registras tus series y el plan sube las cargas. Cada semana lee tu peso real y corrige el rumbo."],
];

const FOR_WHO: { icon: typeof Syringe; t: string; d: string }[] = [
  { icon: Syringe, t: "Usaste Ozempic o Mounjaro", d: `Con ${GLP1} se baja rápido y el músculo sufre. Banana Shield lo protege.` },
  { icon: Scales, t: "Hiciste una dieta muy estricta", d: "Bajaste mucho en poco tiempo y quieres verte firme, no solo más delgado." },
  { icon: Barbell, t: "Nunca has entrenado fuerza", d: "Empiezas desde cero, con técnica guiada y cargas a tu nivel." },
  { icon: BowlFood, t: "Quieres mantener lo que lograste", d: "El músculo es lo que te ayuda a no recuperar lo que tanto te costó bajar." },
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
  const faqItems = faq();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={ldScript(appJsonLd())} />
      <script type="application/ld+json" dangerouslySetInnerHTML={ldScript(orgJsonLd())} />
      <script type="application/ld+json" dangerouslySetInnerHTML={ldScript(faqJsonLd(faqItems))} />

      {/* 1. HERO: qué es, para quién y la promesa, con la app y el mono a la vista */}
      <section id="hero" className="relative overflow-hidden bg-banana">
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 size-[28rem] rounded-full bg-white/25 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-10 sm:px-6 sm:pt-14 lg:grid-cols-[1.15fr_1fr] lg:gap-6 lg:pb-20 lg:pt-16">
          <div className="animate-rise">
            <p className="inline-flex items-center gap-2 rounded-full bg-ink px-3.5 py-1.5 text-sm font-bold text-banana">
              <Barbell weight="duotone" aria-hidden className="size-4" />Recomposición corporal
            </p>
            <h1 className="mt-5 text-[2.75rem] leading-[1.02] sm:text-6xl lg:text-[4.25rem] font-extrabold tracking-[-0.04em] text-ink text-balance">
              Bajaste de peso. Ahora reconstruye tu cuerpo.
            </h1>
            <p className="mt-6 max-w-[34rem] text-lg sm:text-xl leading-relaxed text-ink/85 text-pretty">
              Banana Burn es <b className="text-ink">tu entrenador personal en el celular</b>. Una rutina de recomposición corporal para personas que bajaron rápido de peso: recuperas firmeza y fuerza mientras sigues bajando grasa.
            </p>
            <div data-sticky-anchor className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Link href={SIGNUP} data-cta="hero" className="pressable inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-ink px-8 text-base font-extrabold text-banana shadow-lift hover:bg-black sm:w-auto">{CTA} <ArrowRight weight="bold" className="size-5" /></Link>
              <a href="#por-dentro" data-cta="hero-tour" className="tap hidden sm:inline-flex items-center font-bold text-ink underline decoration-ink/30 decoration-2 underline-offset-4 transition-[text-decoration-color] duration-150 hover:decoration-ink">Ver la app por dentro</a>
            </div>
            <p className="mt-4 text-sm font-semibold text-ink">{o.note} {o.from(FROM)}</p>
            <p className="mt-1 text-sm text-ink/75">¿Ya tienes cuenta? <Link href="/entrar" data-cta="hero-entrar" className="tap inline-flex font-bold text-ink underline underline-offset-4">Entrar</Link></p>
          </div>

          <div className="relative isolate mx-auto h-[600px] w-full max-w-[470px] sm:h-[640px]">
            <Phone src="/landing/hoy2.png" alt="" sizes="220px" className="absolute left-0 top-10 hidden w-[210px] -rotate-6 opacity-95 sm:block" />
            <HeroPlayer className="absolute left-1/2 top-0 w-[275px] -translate-x-1/2 sm:left-auto sm:right-0 sm:w-[300px] sm:translate-x-0" />
            <div className="absolute -bottom-2 -left-3 w-[165px] sm:w-[230px] animate-rise [animation-delay:200ms]">
              <Image src={POSE.flex} alt="Coach Banana, el entrenador de Banana Burn" width={460} height={460} priority sizes="230px" className="drop-shadow-xl" />
            </div>
          </div>
        </div>
      </section>

      {/* 2. DOLOR: lo que vive quien bajó rápido */}
      <section aria-labelledby="dolor" className="mx-auto max-w-6xl px-4 pt-24 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <h2 id="dolor" className={`${H2} max-w-3xl`}>¿Bajaste rápido y te pasó esto?</h2>
          <Image src={POSE.bascula} alt="Coach Banana mirando una báscula" width={360} height={360} sizes="180px" className="-mb-6 w-28 shrink-0 sm:w-44" />
        </div>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {PAINS.map(([t, d]) => (
            <li key={t} className="flex gap-4 rounded-[1.75rem] border border-line bg-white p-6">
              <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-banana-soft text-ink"><X weight="bold" className="size-4" /></span>
              <div>
                <p className="text-xl font-extrabold text-ink text-balance">{t}</p>
                <p className="mt-1.5 leading-relaxed text-muted text-pretty">{d}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-[62ch] text-lg font-semibold text-ink text-pretty">No es tu culpa. Cuando bajas de peso muy rápido, una parte de lo que pierdes es músculo. La buena noticia: el músculo se recupera.</p>
      </section>

      {/* 3. MÉTODO: recomposición corporal explicada simple */}
      <section aria-labelledby="metodo" className="pt-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-[2.25rem] bg-ink p-7 text-white sm:p-12 lg:p-16">
            <Image src={POSE.barra} alt="" width={420} height={420} sizes="260px" className="pointer-events-none absolute -right-6 -top-4 hidden w-56 lg:block xl:w-64" />
            <p className="w-fit rounded-full bg-banana px-3.5 py-1.5 text-sm font-extrabold text-ink">El método</p>
            <h2 id="metodo" className="mt-5 max-w-3xl text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.03em] text-balance">
              Recomposición corporal: <span className="text-banana">menos grasa, más músculo</span>, al mismo tiempo.
            </h2>
            <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-white/80 text-pretty">No se trata de bajar más kilos. Se trata de que lo que queda sea músculo firme. Por eso cada rutina de Banana Burn está hecha para reconstruir, no solo para sudar.</p>
            <ol className="mt-10 grid gap-4 lg:grid-cols-3">
              {PILLARS.map((p) => (
                <li key={p.n} className="rounded-[1.5rem] bg-white/[.06] p-6">
                  <p className="text-4xl font-extrabold tabular-nums text-banana">{p.n}</p>
                  <h3 className="mt-3 text-xl font-extrabold text-balance">{p.t}</h3>
                  <p className="mt-2 leading-relaxed text-white/75 text-pretty">{p.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* 4. LA APP POR DENTRO: recorrido interactivo con capturas reales y técnica animada */}
      <section id="por-dentro" aria-labelledby="por-dentro-t" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-24 sm:px-6">
        <div className="flex items-end gap-4">
          <Image src={POSE.senala} alt="Coach Banana señalando las pantallas de Banana Burn" width={360} height={360} sizes="180px" className="-mb-4 w-24 shrink-0 sm:w-40" />
          <div>
            <h2 id="por-dentro-t" className={`${H2} max-w-3xl`}>Mira Banana Burn por dentro.</h2>
            <p className={LEAD}>Todo lo que haría un entrenador personal, en tu bolsillo. Toca cada pantalla.</p>
          </div>
        </div>
        <AppTour />
        <p className="mt-3 text-sm text-muted">Capturas reales de la app en modo demostración, con datos de ejemplo.</p>
        <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-line pt-8 sm:grid-cols-4">
          {([[LIB_COUNT.toLocaleString("es-419"), "ejercicios con guía"], [String(ANIMATED_TECHNIQUES), "técnicas animadas por Coach Banana"], ["10 min", "el entreno exprés más corto"], [`${TRIAL_DAYS} días`, o.statLabel]] as const).map(([v, l]) => (
            <div key={l} className="flex flex-col-reverse">
              <dt className="mt-1 text-sm text-muted text-pretty">{l}</dt>
              <dd className="text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 5. ENTRENADOR VS APP */}
      <section aria-labelledby="entrenador" className="mx-auto max-w-6xl px-4 pt-24 sm:px-6">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_1fr] lg:gap-14">
          <div>
            <h2 id="entrenador" className={H2}>Todo lo de un entrenador personal. <Marker>Sin pagar sesiones.</Marker></h2>
            <p className={LEAD}>Un entrenador te arma la rutina, te dice cuánto levantar, corrige tu técnica y te empuja a volver. Banana Burn hace eso todos los días, a la hora que entrenes, por menos de lo que cuesta una sola sesión al mes.</p>
            <Image src={POSE.entrenador} alt="Coach Banana como entrenador personal, con tabla y silbato" width={400} height={400} sizes="220px" className="mt-6 w-40 sm:w-52" />
          </div>
          <ul className="grid gap-3">
            {["Te arma la rutina según tu nivel y tu equipo", "Te dice el peso exacto de cada serie", "Te muestra la técnica con animación", "Sube las cargas cuando tu cuerpo lo pide", "Te responde dudas a cualquier hora", "Te mantiene constante con retos y niveles"].map((t) => (
              <li key={t} className="flex items-center gap-3 rounded-2xl bg-white p-4 font-bold text-ink shadow-[0_1px_0_var(--color-line)]">
                <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-banana"><Check weight="bold" className="size-4" /></span>{t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Compare />

      {/* 6. CÓMO FUNCIONA */}
      <section id="como-funciona" aria-labelledby="como-t" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-24 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <h2 id="como-t" className={`${H2} max-w-3xl`}>Empiezas hoy, en 2 minutos.</h2>
          <Image src={POSE.saluda} alt="Coach Banana saludando con el celular en la mano" width={360} height={360} sizes="180px" className="-mb-6 w-28 shrink-0 sm:w-44" />
        </div>
        <ol className="mt-10 grid gap-4 lg:grid-cols-3">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="rounded-[1.75rem] bg-cream p-6 sm:p-7">
              <span aria-hidden className="grid size-12 place-items-center rounded-full bg-ink text-xl font-extrabold tabular-nums text-banana">{i + 1}</span>
              <h3 className="mt-4 text-xl font-extrabold text-ink text-balance">{t}</h3>
              <p className="mt-2 leading-relaxed text-muted text-pretty">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 7. COACH BANANA: el mono que te acompaña */}
      <section aria-labelledby="mono" className="pt-24">
        <div className="mx-auto grid max-w-6xl items-end gap-4 px-4 sm:px-6 lg:grid-cols-[1.2fr_1fr]">
          <h2 id="mono" className={H2}>Conoce a Coach Banana.</h2>
          <p className="max-w-[52ch] text-lg leading-relaxed text-muted text-pretty">Coach Banana te enseña la técnica, te marca el ritmo y celebra cada récord contigo. En el gym, en la casa o en el parque.</p>
        </div>
        <ul tabIndex={0} aria-label="Escenas de Coach Banana entrenando" className="mt-10 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-ink sm:mx-auto sm:grid sm:max-w-6xl sm:grid-cols-2 sm:overflow-visible sm:px-6 lg:grid-cols-4">
          {SCENES.map(([id, t]) => (
            <li key={id} className="relative aspect-[4/5] w-[78%] shrink-0 snap-center overflow-hidden rounded-[1.5rem] bg-banana sm:w-auto">
              <Image src={`${UGC_BASE}${id}.png`} alt={t} fill sizes="(min-width: 1024px) 280px, 80vw" className="object-cover" />
              <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 via-ink/40 to-transparent px-4 pb-4 pt-12 text-[15px] font-bold leading-snug text-white text-balance">{t}</p>
            </li>
          ))}
        </ul>
        <p className="mx-auto mt-3 max-w-6xl px-4 text-xs text-faint sm:px-6">Escenas ilustrativas creadas para mostrar cómo te acompaña Coach Banana.</p>
      </section>

      {/* 8. PARA QUIÉN */}
      <section aria-labelledby="para-quien" className="mx-auto max-w-6xl px-4 pt-24 sm:px-6">
        <h2 id="para-quien" className={`${H2} max-w-3xl`}>Hecho para ti si…</h2>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FOR_WHO.map(({ icon: I, t, d }) => (
            <li key={t} className="flex flex-col rounded-[1.75rem] border border-line bg-white p-6">
              <span className="grid size-12 place-items-center rounded-2xl bg-banana text-ink"><I weight="duotone" aria-hidden className="size-7" /></span>
              <h3 className="mt-4 text-xl font-extrabold text-ink text-balance">{t}</h3>
              <p className="mt-1.5 leading-relaxed text-muted text-pretty">{d}</p>
            </li>
          ))}
        </ul>
        <Link href={SIGNUP_GLP1} data-cta="glp1-banda" className="group mt-4 grid items-center gap-4 rounded-[1.75rem] bg-ink p-6 text-white sm:grid-cols-[auto_1fr_auto] sm:p-8 transition-shadow duration-200 hover:shadow-lift focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-banana">
          <span className="grid size-14 place-items-center rounded-2xl bg-banana text-ink"><ShieldCheck weight="duotone" aria-hidden className="size-8" /></span>
          <span>
            <span className="block text-2xl font-extrabold text-balance">Banana Shield, para personas en {GLP1}</span>
            <span className="mt-1 block text-white/75 text-pretty">Fuerza y proteína para no perder músculo, con modo suave en tu día de inyección.</span>
          </span>
          <span className="inline-flex items-center gap-2 font-bold text-banana">Empezar con Banana Shield <ArrowRight weight="bold" className="size-5 transition-transform duration-200 ease-[cubic-bezier(.23,1,.32,1)] group-hover:translate-x-1" /></span>
        </Link>
      </section>

      {/* 9. FUNDADOR: historia real, sin testimonios inventados */}
      <section className="mx-auto max-w-6xl px-4 pt-24 sm:px-6">
        <div className="grid items-center gap-8 rounded-[2rem] bg-banana-soft p-7 sm:p-12 lg:grid-cols-[1.6fr_1fr] lg:gap-14">
          <div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink text-balance">La hice porque yo la necesitaba.</h2>
            <p className="mt-4 max-w-[60ch] text-lg leading-relaxed text-ink/80 text-pretty">Soy Andrés, el fundador, y soy el usuario número 1. Mi meta: de 94 a 85 kg antes del 31 de diciembre, sin perder músculo. Ninguna app me decía qué hacer hoy en el gym, en español y con la comida que como todos los días.</p>
            <p className="mt-4 max-w-[60ch] leading-relaxed text-ink/80 text-pretty">Banana Burn está en versión de prueba y la estamos puliendo con sus primeros usuarios. Lo que me escribas a <a href="mailto:hola@bananaburn.app" className="tap font-bold text-ink underline underline-offset-2">hola@bananaburn.app</a> me llega directo.</p>
          </div>
          <div className="relative mx-auto aspect-square w-48 overflow-hidden rounded-[1.75rem] bg-banana lg:w-full lg:max-w-[300px]">
            <MonkeyBanana aria-hidden className="absolute inset-0 m-auto size-1/2 text-ink/25" />
            <Image src="/brand/mascota-sola.webp" alt="Coach Banana, el mono de Banana Burn" fill sizes="(min-width: 1024px) 300px, 192px" className="object-contain" />
          </div>
        </div>
      </section>

      {/* 10. PRECIOS */}
      <section id="precios" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-24 sm:px-6">
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <h2 className={H2}>Menos que una sesión con un entrenador.</h2>
          <p className="mt-4 text-lg text-muted text-pretty">{o.pricingIntro(SAVE)}</p>
        </div>
        <Pricing trialGuarantee={o.guarantee} />
      </section>

      <Faq id="faq" items={faqItems} aside={<FaqCta cta="faq" />} />

      {/* 11. CTA FINAL con el mono */}
      <section data-sticky-hide className="mx-auto max-w-6xl px-4 pt-24 sm:px-6">
        <div className="relative overflow-hidden rounded-[2.25rem] bg-banana px-6 pb-0 pt-14 text-center sm:px-16 sm:pt-16">
          <h2 className={`${H2} mx-auto max-w-3xl`}>Tu cuerpo nuevo empieza con el primer entreno.</h2>
          <Link href={SIGNUP} data-cta="final" className="pressable mt-8 inline-flex h-14 items-center gap-2 rounded-full bg-ink px-8 text-base font-extrabold text-banana shadow-lift hover:bg-black">{CTA} <ArrowRight weight="bold" className="size-5" /></Link>
          <p className="mt-4 text-sm font-semibold text-ink/80">{o.note} {o.from(FROM)}</p>
          <ul className="mx-auto mt-8 grid max-w-3xl grid-cols-1 gap-x-6 gap-y-2 text-left text-sm font-semibold text-ink sm:w-fit sm:grid-cols-2">
            {risk().map(([I, t]) => <li key={t} className="flex items-center gap-2"><I weight="duotone" aria-hidden className="size-5 shrink-0" />{t}</li>)}
          </ul>
          <Image src={POSE.salta} alt="" width={420} height={420} sizes="240px" className="mx-auto mt-8 w-44 sm:w-60" />
        </div>
      </section>

      <StickyCta note={o.note}><Link href={SIGNUP} data-cta="sticky" className="btn-primary h-12 shrink-0 px-5">{CTA} <ArrowRight className="size-4" /></Link></StickyCta>
    </>
  );
}
