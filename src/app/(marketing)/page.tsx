import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowCounterClockwise, ArrowRight, Banana, BananaFlame, Barbell, BowlFood, Check, Clock, CreditCard, MonkeyBanana, Scales, ShieldCheck, Syringe, Target, X,
} from "@/components/icons";
import { Phone } from "@/components/phone";
import { Pricing } from "@/components/pricing";
import { PLANS, annualSavingPct } from "@/lib/plans";
import { TRIAL_DAYS } from "@/lib/copy";
import { Faq, Marker } from "./parts";
import { StickyCta } from "./sticky-cta";
import { appJsonLd, social } from "./seo";
import { COMPLETO, Compare, FAQ, FaqCta, FROM, GLP1, SIGNUP, SIGNUP_GLP1, TRIAL_CTA, TRIAL_NOTE } from "./content";

const SAVE = Math.max(...PLANS.map(annualSavingPct));

const TITLE = "Banana Burn: entrenador personal con IA para bajar grasa";
const DESCRIPTION = `Rutina de gym o casa, el peso exacto de cada serie y comida latina de verdad, ajustados cada semana a tu peso real. Prueba ${TRIAL_DAYS} días gratis, sin tarjeta.`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  ...social({ title: TITLE, description: DESCRIPTION, path: "/" }),
};

/* Entrada tipo quiz: /entrar guarda `objetivo` y `programa` en cookies y /bienvenida arranca con esa meta elegida. */
const GOALS: { label: string; href: string; cta: string; icon: React.ComponentType<{ weight?: "duotone"; className?: string; "aria-hidden"?: boolean }> }[] = [
  { label: "Bajar grasa rápido", href: `${SIGNUP}&objetivo=grasa`, cta: "quiz-grasa", icon: BananaFlame },
  { label: "Bajar grasa y ganar músculo", href: `${SIGNUP}&objetivo=recomp`, cta: "quiz-recomp", icon: Scales },
  { label: "Ganar fuerza", href: `${SIGNUP}&objetivo=fuerza`, cta: "quiz-fuerza", icon: Barbell },
  { label: "Uso Ozempic o Mounjaro", href: SIGNUP_GLP1, cta: "quiz-glp1", icon: Syringe },
];

const PAINS = [
  ["Llegas al gym y no sabes qué hacer.", "Das vueltas, copias al de la máquina de al lado y te vas con la sensación de que no sirvió de nada."],
  ["Tu rutina es genérica y nunca cambia.", "El PDF o el video de TikTok no saben cuánto levantaste la semana pasada ni cuánto tiempo tienes hoy."],
  ["La dieta no se parece a lo que comes.", "Te piden salmón, quinoa y kale. Tú comes arroz con pollo, frijoles, tortillas o patacones, y se puede bajar de peso así."],
] as const;

const STEPS = [
  ["/landing/objetivo.png", "Cuéntanos tu objetivo", "Tu peso, tu meta, cuántos días entrenas, con qué equipo (gym, casa o nada) y cuánto tiempo tienes. Toma unos 2 minutos."],
  ["/landing/hoy2.png", "Abre la app y haz lo que toca hoy", "Tu rutina del día con series, repeticiones y el peso de cada serie. ¿Día apretado? Hay entrenos exprés de 10, 20 o 30 minutos."],
  ["/landing/progreso.png", "Registra y deja que se ajuste solo", "Si completas tus repeticiones, sube el peso. Cada semana el plan lee tu peso real y corrige el rumbo."],
] as const;

type Feature = { src: string; alt: string; title: string; body: string; points: string[]; tag?: string };
const FEATURES: Feature[] = [
  {
    src: "/landing/entreno.png", alt: "Pantalla de entrenamiento con el peso y las repeticiones de cada serie",
    title: "Entras al gym sabiendo exactamente qué levantar.",
    body: "Cada serie trae el peso y las repeticiones que te tocan. Si las completas, la próxima vez sube. Si te estancas, el plan ajusta.",
    points: ["Gym, casa o sin equipo, de 15 a 60 minutos por sesión", "Animación de técnica en cada ejercicio", "Rutina distinta cada día y accesorios que rotan cada semana", "Descanso cronometrado y récords personales"],
  },
  {
    src: "/landing/nutricion.png", alt: "Pantalla de comida con calorías y proteína restantes del día",
    title: "Bajas de peso comiendo arroz con pollo.",
    body: "Calorías y proteína calculadas para ti, con la comida que ya comes. Registras tu almuerzo en dos toques y ves cuánto te queda del día.",
    points: ["Comida latina de verdad: arroz con pollo, frijoles, tortillas, ceviche, patacones, arepas", "Recetas e ideas de menú para cada día", "Tus calorías se ajustan cada semana con tu peso real"],
    tag: `Incluido en ${COMPLETO.name}`,
  },
  {
    src: "/landing/progreso.png", alt: "Pantalla de progreso con la tendencia de peso",
    title: "Ves tu progreso real aunque la báscula se ponga terca.",
    body: "El peso sube y baja por agua y sal. Banana Burn te muestra la tendencia, que es lo que cuenta, junto con tu fuerza, tus medidas y tus fotos.",
    points: ["Tendencia de peso, no el número del día", "Medidas y fotos de progreso privadas", "Fuerza por ejercicio, semana a semana"],
  },
];

const UGC_BASE = "https://d8j0ntlcm91z4.cloudfront.net/user_3KlOTMXim7g88SAyF4A03SG6JZ6/";
const MASCOT = `${UGC_BASE}hf_20261022_085342_da17b2e2-18ea-4b15-9242-6fbc69476315.png`;
/** Escenas ilustrativas (persona real + Coach Banana en caricatura). No son clientes ni testimonios. */
const SCENES: [string, string][] = [
  ["hf_20261022_153719_0be6b29d-ae57-4937-a122-798fdf72baa4", "En el gym: te muestra la técnica de cada ejercicio con animación."],
  ["hf_20261022_155001_e82f1d0e-5f20-4eba-9039-6f62a9d79152", "En la casa: sin equipo y sin excusas."],
  ["hf_20261022_155041_f2cc4028-cb3a-48a8-ade4-3d6edcbbf98f", "En la cocina: comida latina que cuadra con tu meta."],
  ["hf_20261022_155041_44c51456-065c-44b4-95dc-135b1585a69a", "En el parque: te marca el ritmo."],
  ["hf_20261022_155042_171fc15e-6a39-489f-a615-de397a0bcec2", "A cualquier edad: cargas a tu nivel."],
  ["hf_20261022_155003_11f3b250-6cbe-4354-ab64-49e1d65832ec", "Cada récord se celebra."],
];

const H2 = "text-4xl sm:text-5xl font-extrabold tracking-tight text-ink text-balance";
const LEAD = "mt-4 text-lg text-muted leading-relaxed text-pretty max-w-[60ch]";

export default function Landing() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appJsonLd()).replace(/</g, "\\u003c") }} />

      {/* 1. HERO: resultado + mecanismo + para quién, un CTA y confianza inmediata */}
      <section id="hero" className="mx-auto max-w-6xl px-4 sm:px-6 pt-10 sm:pt-16 lg:pt-0 pb-14 lg:pb-0 grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-10 items-center lg:min-h-[min(calc(100dvh-4rem),760px)]">
        <div className="animate-rise lg:py-10">
          <h1 className="text-[2.6rem] leading-[1.03] sm:text-6xl lg:text-[3.5rem] font-extrabold tracking-[-0.035em] text-ink text-balance">
            Baja grasa sin perder músculo. <Marker>Tu coach IA te dice qué hacer hoy.</Marker>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted max-w-[34rem] leading-relaxed text-pretty">
            Para quien quiere resultados en el gym sin adivinar: <b className="text-ink">el peso exacto de cada serie</b>, rutina a tu nivel y comida latina de verdad. Se ajusta cada semana a tu peso real.
          </p>
          <div data-sticky-anchor className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Link href={SIGNUP} data-cta="hero" className="btn-primary h-14 px-7 text-base w-full sm:w-auto">{TRIAL_CTA} <ArrowRight className="size-5" /></Link>
            <a href="#como-funciona" data-cta="hero-secundario" className="tap font-semibold text-ink underline decoration-line decoration-2 underline-offset-4 transition-[text-decoration-color] duration-150 hover:decoration-ink">Ver cómo funciona</a>
          </div>
          <p className="mt-5 text-sm font-semibold text-ink">{TRIAL_NOTE} Después, desde {FROM} al mes con el plan anual.</p>
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            {([[CreditCard, "Sin tarjeta para probar"], [Clock, "Tu plan listo en 2 minutos"], [ArrowCounterClockwise, "Cancela cuando quieras"]] as const).map(([I, t]) => (
              <li key={t} className="inline-flex items-center gap-1.5"><I weight="duotone" aria-hidden className="size-4 text-banana-ink" />{t}</li>
            ))}
          </ul>
        </div>

        <div className="relative isolate grid place-items-center py-10 sm:py-12 lg:py-0 lg:h-[min(calc(100dvh-8rem),680px)]">
          <div aria-hidden className="absolute inset-0 sm:inset-x-8 lg:inset-x-0 lg:inset-y-6 -z-10 rounded-[2rem] bg-banana" />
          <Banana aria-hidden weight="fill" className="absolute right-6 bottom-6 -z-10 size-40 text-ink opacity-[.07] rotate-12" />
          <Phone src="/landing/entreno.png" alt="" className="hidden md:block absolute w-[190px] left-[8%] top-[16%] -rotate-6" />
          <Phone src="/landing/hoy2.png" alt="Pantalla Hoy de Banana Burn con la rutina del día y la racha" className="relative w-[230px] sm:w-[260px] lg:w-[clamp(220px,calc((100dvh-12rem)*0.44),280px)] md:translate-x-14" priority />
        </div>
      </section>

      {/* 2. QUIZ: micro-compromiso, cada objetivo entra directo al registro */}
      <section aria-labelledby="objetivo" className="border-y border-line bg-cream">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-10">
          <div>
            <h2 id="objetivo" className="text-2xl font-extrabold tracking-tight text-ink">¿Qué quieres lograr?</h2>
            <p className="mt-1 text-sm text-muted">Elige uno y empieza tu prueba gratis de {TRIAL_DAYS} días.</p>
          </div>
          <ul className="mt-5 flex flex-wrap gap-3">
            {GOALS.map(({ label, href, cta, icon: I }) => (
              <li key={cta}>
                <Link href={href} data-cta={cta} className="pressable group inline-flex items-center gap-2.5 h-12 pl-3 pr-4 rounded-full border-2 border-line bg-white font-bold text-[15px] text-ink hover:border-ink">
                  <span className="grid place-items-center size-8 rounded-full bg-banana-soft text-banana-ink transition-colors duration-150 group-hover:bg-banana group-hover:text-ink"><I weight="duotone" aria-hidden className="size-5" /></span>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 3. PROBLEMA: la realidad del gym en LATAM, y la salida */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-24 grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:gap-16 items-start">
        <div className="lg:sticky lg:top-24">
          <h2 className={H2}>Si el gym no te ha funcionado, no es falta de ganas.</h2>
          <p className={LEAD}>Te falta un plan que piense por ti. Banana Burn decide qué entrenar, cuánto levantar y qué comer, con lo que ya tienes y con la comida que ya comes.</p>
        </div>
        <ul className="border-t border-line">
          {PAINS.map(([t, d]) => (
            <li key={t} className="flex gap-4 border-b border-line py-6">
              <span aria-hidden className="grid place-items-center size-9 shrink-0 rounded-full bg-ember/10 text-ember-ink"><X weight="bold" className="size-4" /></span>
              <div>
                <p className="text-lg font-extrabold text-ink text-balance">{t}</p>
                <p className="mt-1 text-muted leading-relaxed text-pretty max-w-[60ch]">{d}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 3b. COACH EN ACCIÓN: escenas con el mono entrenando a gente real (ilustrativas) */}
      <section aria-labelledby="coach-accion" className="pt-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 grid gap-4 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <h2 id="coach-accion" className={H2}>Un coach que no te quita el ojo de encima.</h2>
          <p className="text-lg text-muted leading-relaxed text-pretty max-w-[52ch]">Coach Banana te muestra la técnica de cada ejercicio con animación, te marca el tempo y te avisa cuándo volver a la barra. En el gym, en la casa o en el parque.</p>
        </div>
        <ul tabIndex={0} aria-label="Escenas de Coach Banana entrenando" className="mt-10 flex gap-3 overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-ink snap-x snap-mandatory px-4 pb-2 [scrollbar-width:none] sm:mx-auto sm:max-w-6xl sm:px-6 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:overflow-visible">
          {SCENES.map(([id, t], i) => (
            <li key={id} className={`relative shrink-0 w-[78%] snap-center overflow-hidden rounded-[1.5rem] bg-cream aspect-[4/5] sm:w-auto ${i === 0 ? "lg:col-span-2 lg:row-span-2 lg:aspect-auto" : ""}`}>
              <Image src={`${UGC_BASE}${id}.png`} alt={t} fill sizes={i === 0 ? "(min-width: 1024px) 760px, 80vw" : "(min-width: 1024px) 380px, 80vw"} className="object-cover" />
              <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 via-ink/40 to-transparent px-4 pb-4 pt-12 text-[15px] font-bold leading-snug text-white text-balance">{t}</p>
            </li>
          ))}
        </ul>
        <p className="mx-auto max-w-6xl px-4 sm:px-6 mt-3 text-xs text-faint">Escenas ilustrativas creadas para mostrar cómo te acompaña el coach.</p>
      </section>

      {/* 4. CÓMO FUNCIONA: 3 pasos concretos con pantallas reales */}
      <section id="como-funciona" className="mx-auto max-w-6xl px-4 sm:px-6 pt-24 scroll-mt-20">
        <h2 className={`${H2} max-w-2xl`}>Tu plan listo hoy. Tus resultados, semana a semana.</h2>
        <ol className="mt-12 grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-x-16 lg:gap-y-0">
          {STEPS.map(([src, t, d], i) => (
            <li key={t} className={`grid grid-cols-[auto_1fr] gap-x-5 gap-y-6 sm:grid-cols-[auto_1fr_180px] sm:items-center lg:col-start-1 lg:grid-cols-[auto_1fr] lg:border-b lg:border-line lg:py-8 lg:first:pt-0 ${i === 0 ? "lg:row-start-1" : i === 1 ? "lg:row-start-2" : "lg:row-start-3"}`}>
              <span aria-hidden className="grid place-items-center size-11 rounded-full bg-ink text-banana text-lg font-extrabold tabular-nums">{i + 1}</span>
              <div>
                <h3 className="text-xl font-extrabold text-ink text-balance">{t}</h3>
                <p className="mt-1.5 text-muted leading-relaxed text-pretty max-w-[52ch]">{d}</p>
              </div>
              <Phone src={src} alt={`Paso ${i + 1}: ${t}`} sizes="200px" className="col-span-2 sm:col-span-1 justify-self-center w-[180px] lg:hidden" />
            </li>
          ))}
          <li aria-hidden className="hidden lg:block lg:col-start-2 lg:row-start-1 lg:row-span-3">
            <div className="relative isolate h-full min-h-[560px] rounded-[2rem] bg-cream border border-line overflow-hidden">
              <Phone src="/landing/objetivo.png" alt="" sizes="220px" className="absolute w-[210px] left-[6%] top-12 -rotate-6" />
              <Phone src="/landing/progreso.png" alt="" sizes="220px" className="absolute w-[210px] right-[6%] top-12 rotate-6" />
              <Phone src="/landing/hoy2.png" alt="" sizes="260px" className="absolute w-[240px] left-1/2 -translate-x-1/2 top-24" />
            </div>
          </li>
        </ol>
      </section>

      {/* 5. RESULTADOS, NO FUNCIONES: titular de beneficio + pantalla que lo prueba */}
      <section aria-label="Lo que logras con Banana Burn" className="mx-auto max-w-6xl px-4 sm:px-6 pt-24 space-y-20 lg:space-y-28">
        {FEATURES.map((f, i) => (
          <div key={f.src} className="grid gap-10 lg:grid-cols-2 lg:gap-16 items-center">
            <div className={i % 2 ? "lg:order-2" : ""}>
              {f.tag && <span className="chip bg-ink text-white"><BowlFood weight="duotone" aria-hidden className="size-4 text-banana" />{f.tag}</span>}
              <h2 className={`${f.tag ? "mt-4 " : ""}text-3xl sm:text-[2.6rem] sm:leading-[1.1] font-extrabold tracking-tight text-ink text-balance`}>{f.title}</h2>
              <p className={LEAD}>{f.body}</p>
              <ul className="mt-6 space-y-3">
                {f.points.map((p) => <li key={p} className="flex gap-3 text-[17px] text-ink"><Check weight="bold" aria-hidden className="mt-0.5 size-5 shrink-0 text-peel" /><span className="text-pretty">{p}</span></li>)}
              </ul>
            </div>
            <div className={`relative isolate grid place-items-center rounded-[2rem] py-10 sm:py-14 ${i === 1 ? "bg-ink" : i === 2 ? "bg-cream border border-line" : "bg-banana"}`}>
              <Phone src={f.src} alt={f.alt} sizes="(max-width: 640px) 240px, 280px" className="w-[230px] sm:w-[270px]" />
            </div>
          </div>
        ))}

        <div className="grid gap-5 lg:grid-cols-2">
          <article className="flex flex-col rounded-[2rem] bg-banana-soft overflow-hidden">
            <div className="p-7 sm:p-10">
              <h2 className="text-3xl font-extrabold tracking-tight text-ink text-balance">Un coach que te contesta a las 11 de la noche.</h2>
              <p className="mt-3 text-ink/80 leading-relaxed text-pretty max-w-[52ch]">Pregúntale qué cambiar si te duele el hombro, si no hay máquina libre o si te estancaste. Conoce tu plan y tus entrenos.</p>
              <p className="mt-3 text-sm text-ink/70 text-pretty">Es IA: puede equivocarse y no sustituye consejo médico.</p>
            </div>
            <div className="mt-auto h-[300px] overflow-hidden px-10"><Phone src="/landing/coach.png" alt="Chat con el Coach Banana" sizes="280px" className="mx-auto w-[260px]" /></div>
          </article>
          <article className="flex flex-col rounded-[2rem] bg-ink text-white overflow-hidden">
            <div className="p-7 sm:p-10">
              <h2 className="text-3xl font-extrabold tracking-tight text-balance">Vuelves mañana porque engancha.</h2>
              <p className="mt-3 text-white/80 leading-relaxed text-pretty max-w-[52ch]">Rachas, niveles, retos de 30 días y una comunidad donde compartes tus entrenos al estilo Strava. Constancia sin fuerza de voluntad.</p>
              <p className="mt-3 text-sm text-white/70">Captura con perfiles de demostración.</p>
            </div>
            <div className="mt-auto h-[300px] overflow-hidden px-10"><Phone src="/landing/comunidad.png" alt="Comunidad de Banana Burn con entrenos compartidos" sizes="280px" className="mx-auto w-[260px]" /></div>
          </article>
        </div>
        <p className="text-sm text-muted">Capturas reales de la app en modo demo, con datos de ejemplo.</p>
      </section>

      {/* 6. COMPARACIÓN honesta */}
      <Compare />

      {/* 7. SEGMENTO GLP-1 */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-24">
        <Link href="/glp1" data-cta="glp1-banda" className="group grid gap-6 sm:grid-cols-[auto_1fr] lg:grid-cols-[auto_1fr_auto] items-center rounded-[2rem] border-2 border-ink bg-white p-6 sm:p-10 transition-shadow duration-200 hover:shadow-lift focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-banana">
          <span className="grid place-items-center size-16 rounded-2xl bg-banana text-ink"><ShieldCheck weight="duotone" aria-hidden className="size-9" /></span>
          <div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink text-balance">¿Usas Ozempic o Mounjaro? Protege tu músculo.</h2>
            <p className="mt-3 text-lg text-muted max-w-2xl text-pretty">Banana Shield: fuerza y proteína pensadas para personas en {GLP1}, con modo suave en tu día de inyección y porciones que sí te entran.</p>
          </div>
          <span className="inline-flex items-center gap-2 font-bold text-ink sm:col-start-2 lg:col-start-auto">Conocer Banana Shield <ArrowRight weight="bold" className="size-5 transition-transform duration-200 ease-[cubic-bezier(.23,1,.32,1)] group-hover:translate-x-1" /></span>
        </Link>
      </section>

      {/* 8. FUNDADOR: autoridad y cercanía, sin testimonios inventados ni fotos de stock (no hay foto del fundador: va la mascota) */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-24">
        <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr] lg:gap-14 items-center rounded-[2rem] bg-ink text-white p-7 sm:p-12">
          <div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-balance">De 94 a 85 kg antes del 31 de diciembre.</h2>
            <p className="mt-4 text-lg text-white/80 leading-relaxed text-pretty max-w-[60ch]">Soy Andrés, el fundador, y soy el usuario #1 de Banana Burn. La construí porque ninguna app me decía qué hacer hoy en el gym, en español y con la comida que como todos los días.</p>
            <p className="mt-4 text-white/80 leading-relaxed text-pretty max-w-[60ch]">Banana Burn está en beta: la estamos puliendo con sus primeros usuarios. Lo que me escribas a <a href="mailto:hola@bananaburn.app" className="tap font-semibold text-banana underline underline-offset-2">hola@bananaburn.app</a> me llega directo.</p>
            <dl className="mt-8 grid grid-cols-3 divide-x divide-white/15 border-t border-white/15 pt-6 max-w-lg">
              {[["−9 kg", "mi meta"], ["4 días", "de gym por semana"], ["185 g", "de proteína al día"]].map(([v, l]) => (
                <div key={l} className="px-4 first:pl-0 last:pr-0 flex flex-col-reverse">
                  <dt className="mt-1 text-sm text-white/75 text-pretty">{l}</dt>
                  <dd className="text-2xl sm:text-3xl font-extrabold text-banana tabular-nums"><span className="whitespace-nowrap">{v}</span></dd>
                </div>
              ))}
            </dl>
          </div>
          <figure className="order-first lg:order-none flex items-center gap-4 lg:flex-col lg:items-stretch">
            <div className="relative isolate w-24 sm:w-32 lg:w-full lg:max-w-[340px] lg:mx-auto aspect-square shrink-0 overflow-hidden rounded-[1.5rem] lg:rounded-[1.75rem] bg-banana">
              <MonkeyBanana aria-hidden className="absolute inset-0 m-auto size-1/2 text-ink/25 -z-10" />
              <Image src={MASCOT} alt="Coach Banana, el chimpancé mascota de Banana Burn" fill sizes="(min-width: 1024px) 340px, 128px" className="object-cover" />
            </div>
            <figcaption className="text-sm text-white/70 text-pretty lg:text-center">Coach Banana, el entrenador que te acompaña en la app.</figcaption>
          </figure>
        </div>
      </section>

      {/* 9. PRECIOS con anual anclado + reversión de riesgo */}
      <section id="precios" className="mx-auto max-w-6xl px-4 sm:px-6 pt-24 scroll-mt-20">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h2 className={H2}>Pruébalo {TRIAL_DAYS} días gratis. Después, elige tu plan.</h2>
          <p className="mt-4 text-lg text-muted text-pretty">En la prueba tienes todo incluido y no pedimos tarjeta. Los dos planes traen tu rutina diaria, la progresión automática y el coach IA; con el pago anual ahorras {SAVE} %.</p>
        </div>
        <Pricing />
      </section>

      {/* 10. OBJECIONES */}
      <Faq id="faq" items={FAQ} aside={<FaqCta cta="faq" />} />

      {/* 11. CTA FINAL */}
      <section data-sticky-hide className="mx-auto max-w-6xl px-4 sm:px-6 pt-24">
        <div className="rounded-[2rem] bg-banana px-6 py-14 sm:p-16 text-center">
          <Target weight="duotone" aria-hidden className="mx-auto size-12 text-ink" />
          <h2 className={`${H2} mt-4 max-w-3xl mx-auto`}>Mañana entras al gym sabiendo exactamente qué hacer.</h2>
          <Link href={SIGNUP} data-cta="final" className="mt-8 btn-primary h-14 px-8 text-base">{TRIAL_CTA} <ArrowRight className="size-5" /></Link>
          <p className="mt-4 text-sm font-semibold text-ink/80">{TRIAL_NOTE} Después, desde {FROM} al mes con el plan anual.</p>
        </div>
      </section>

      <StickyCta note={TRIAL_NOTE}><Link href={SIGNUP} data-cta="sticky" className="btn-primary h-12 px-5 shrink-0">Empezar gratis <ArrowRight className="size-4" /></Link></StickyCta>
    </>
  );
}

